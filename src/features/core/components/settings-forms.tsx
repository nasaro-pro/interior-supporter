'use client';
// src/features/core/components/settings-forms.tsx (A · TASK-015·016) — 업체 정보·로고·템플릿(고객 홈 전체, CR-A-10)·구성원 초대·재설정 링크
import { useActionState, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Eye, KeyRound, Upload, UserPlus, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { FormError, FormRow, SubmitButton } from '@/shared/ui/form-parts';
import { NativeSelect } from '@/shared/ui/native-fields';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { useActionErrorText } from '@/shared/ui/action-error';
import { createBrowserSupabase } from '@/shared/lib/supabase/browser';
import { FILE_RULES } from '@/shared/contracts/domain';
import type { ActionResult, AppError } from '@/shared/contracts/errors';
import type { HomeSections } from '@/shared/contracts/domain';
import { routes } from '@/shared/contracts/routes';
import { ConflictState } from '@/shared/ui/states';
import { createUploadIntent, finalizeUpload } from '@/features/files';
import { setCompanyLogo, updateCompany, updateTemplate } from '../server/company-actions';
import { changeMemberRole, createMemberInvite } from '../server/participant-actions';
import { createPasswordResetLink } from '../server/auth-actions';
import type { HomeTheme } from '../home-theme';
import { FormSheet } from './form-sheet';
import { HomeSectionsField, HomeThemeField } from './home-template-fields';
import { CustomerHomeBody } from './summary-blocks';
import { OneTimeLinkDialog } from './one-time-link';

type V = ActionResult<{ version: number }> | null;

/** 저장 후 토스트·새로고침 (실패 시 입력 보존) */
function useSaved(fn: (prev: V, form: FormData) => Promise<NonNullable<V>>) {
  const t = useTranslations('common');
  const router = useRouter();
  return useActionState(async (prev: V, form: FormData) => {
    const res = await fn(prev, form);
    if (res.ok) {
      toast.success(t('toast.saved'));
      router.refresh();
    }
    return res;
  }, null);
}

export function CompanyInfoForm({
  companyId,
  name,
  version,
  slug,
}: {
  companyId: string;
  name: string;
  version: number;
  slug: string;
}) {
  const t = useTranslations();
  const [state, action] = useSaved(updateCompany);
  const fe = state && !state.ok ? state.error.fieldErrors : undefined;
  const current = state?.ok ? state.data.version : version;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="baseVersion" value={current} />
      <FormRow label={t('settings.field.companyName')} htmlFor="co-name" errors={fe?.name} required>
        <Input
          id="co-name"
          name="name"
          defaultValue={name}
          maxLength={100}
          aria-describedby="co-name-error"
          required
        />
      </FormRow>
      <FormRow
        label={t('settings.field.slug')}
        htmlFor="co-slug"
        hint={t('settings.company.slugLocked')}
      >
        <Input id="co-slug" value={slug} readOnly disabled />
      </FormRow>
      {state && !state.ok && !fe ? <FormError error={state.error} /> : null}
      <div>
        <SubmitButton data-ui-key="company-info-submit">{t('common.action.save')}</SubmitButton>
      </div>
    </form>
  );
}

/**
 * 업체 이미지(company_logo kind, 1MB) 업로드 — 서명 URL → finalize. 성공 시 fileId.
 * 로고와 고객 홈 커버(CR-A-10)가 같이 쓴다. 업로드는 B 의 FilesApi 시그니처로만 (헌법 4.1 ④)
 */
function useCompanyImageUpload(companyId: string) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  const rule = FILE_RULES.company_logo;
  const upload = (file: File, onReady: (fileId: string) => Promise<void> | void) =>
    start(async () => {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!rule.exts.includes(ext)) return void toast.error(t('errors.FILE_TYPE_REJECTED'));
      if (file.size > rule.maxBytes) return void toast.error(t('errors.FILE_TOO_LARGE'));
      const intent = await createUploadIntent({
        kind: 'company_logo',
        projectId: null,
        companyId,
        fileName: file.name,
        sizeBytes: file.size,
        mime: file.type,
      });
      if (!intent.ok) return void toast.error(t(`errors.${intent.error.code}`));
      const up = await createBrowserSupabase()
        .storage.from(intent.data.bucket)
        .uploadToSignedUrl(intent.data.path, intent.data.token, file);
      if (up.error) return void toast.error(t('files.queue.interrupted'));
      const fin = await finalizeUpload(intent.data.fileId);
      if (!fin.ok || fin.data.status !== 'ready') return void toast.error(t('errors.FILE_CORRUPT'));
      await onReady(intent.data.fileId);
    });
  return { upload, pending, rule };
}

/** 로고(1MB) — 업로드는 B 의 FilesApi(개발 중 STUB) 시그니처로만 (헌법 4.1 ④) */
export function LogoUploader({
  companyId,
  version,
  logoUrl,
}: {
  companyId: string;
  version: number;
  logoUrl: string | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  const { upload: uploadImage, pending, rule } = useCompanyImageUpload(companyId);

  const upload = (file: File) =>
    uploadImage(file, async (fileId) => {
      const res = await setCompanyLogo({ companyId, baseVersion: version, fileId });
      if (!res.ok) return void toast.error(t(`errors.${res.error.code}`));
      toast.success(t('settings.toast.logoUpdated'));
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="bg-muted grid size-16 place-items-center overflow-hidden rounded-md border">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- /api/files 302 서명 URL (next/image 최적화 대상 아님)
          <img src={logoUrl} alt={t('settings.field.logo')} className="size-full object-contain" />
        ) : (
          <span className="text-muted-foreground text-meta">{t('settings.company.noLogo')}</span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <input
          ref={input}
          type="file"
          accept={rule.exts.join(',')}
          className="sr-only"
          id="logo-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = '';
          }}
        />
        <Button
          variant="outline"
          disabled={pending}
          aria-busy={pending}
          onClick={() => input.current?.click()}
          data-ui-key="company-logo-upload"
        >
          <Upload aria-hidden />
          {t('common.action.upload')}
        </Button>
        <p className="text-muted-foreground text-meta">
          {t('files.dropzone.spec', { exts: rule.exts.join(', '), size: '1MB' })}
        </p>
      </div>
    </div>
  );
}

/** REQ-052 기본 템플릿 — 신규 프로젝트 고객 홈(안내문·커버·테마·4영역) 기본값 + 미리보기 (CR-A-10) */
export function TemplateForm({
  companyId,
  version,
  value,
}: {
  companyId: string;
  version: number;
  value: {
    homeMessage: string;
    homeSections: HomeSections;
    homeTheme: HomeTheme;
    homeCoverFileId: string | null;
  };
}) {
  const t = useTranslations();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState(value.homeMessage);
  const [sections, setSections] = useState(value.homeSections);
  const [theme, setTheme] = useState(value.homeTheme);
  const [cover, setCover] = useState(value.homeCoverFileId);
  const [error, setError] = useState<AppError | null>(null);
  const [saving, start] = useTransition();
  const { upload, pending: uploading, rule } = useCompanyImageUpload(companyId);
  const fe = error?.fieldErrors;

  const save = () =>
    start(async () => {
      setError(null);
      const res = await updateTemplate({
        companyId,
        baseVersion: version,
        defaultHomeMessage: message,
        defaultHomeSections: sections,
        defaultHomeTheme: theme,
        defaultHomeCoverFileId: cover,
      });
      if (res.ok) {
        toast.success(t('settings.templates.saved'));
        router.refresh();
      } else setError(res.error);
    });

  if (error?.code === 'VERSION_CONFLICT') {
    return (
      <ConflictState
        action={
          <Button
            onClick={() => {
              // 입력은 그대로 두고 최신 version 만 다시 받는다 (HomeEditor A-06 과 같은 방식)
              setError(null);
              router.refresh();
            }}
            data-ui-key="template-reload"
          >
            {t('common.action.loadLatest')}
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-5">
        <p className="text-muted-foreground text-sm">{t('settings.templates.intro')}</p>
        <FormRow
          label={t('settings.field.homeCover')}
          htmlFor="tpl-cover-file"
          hint={t('settings.templates.coverHint', { exts: rule.exts.join(', ') })}
        >
          <div className="flex flex-col gap-2">
            <div className="bg-muted grid aspect-[16/5] w-full place-items-center overflow-hidden rounded-md border">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element -- /api/files 302 서명 URL (next/image 최적화 대상 아님)
                <img src={routes.file(cover)} alt="" className="size-full object-cover" />
              ) : (
                <span className="text-muted-foreground text-meta">
                  {t('settings.templates.noCover')}
                </span>
              )}
            </div>
            <input
              ref={input}
              type="file"
              accept={rule.exts.join(',')}
              className="sr-only"
              id="tpl-cover-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f)
                  upload(f, (fileId) => {
                    setCover(fileId);
                    toast.success(t('settings.templates.coverUploaded'));
                  });
                e.target.value = '';
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={uploading}
                aria-busy={uploading}
                onClick={() => input.current?.click()}
                data-ui-key="template-cover-upload"
              >
                <Upload aria-hidden />
                {t('common.action.upload')}
              </Button>
              {cover ? (
                <Button
                  variant="ghost"
                  onClick={() => setCover(null)}
                  data-ui-key="template-cover-remove"
                >
                  <X aria-hidden />
                  {t('settings.templates.removeCover')}
                </Button>
              ) : null}
            </div>
          </div>
        </FormRow>
        <FormRow
          label={t('settings.field.defaultHomeMessage')}
          htmlFor="tpl-msg"
          errors={fe?.defaultHomeMessage}
          hint={t('settings.templates.hint')}
        >
          <Textarea
            id="tpl-msg"
            name="defaultHomeMessage"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            rows={6}
            aria-describedby="tpl-msg-error"
          />
        </FormRow>
        <HomeThemeField
          name="tpl-theme"
          value={theme}
          onChange={setTheme}
          label={t('settings.field.homeTheme')}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('settings.field.homeSections')}</span>
          <HomeSectionsField
            sections={sections}
            onChange={setSections}
            label={t('settings.field.homeSections')}
          />
        </div>
        {error && !fe ? <FormError error={error} /> : null}
        <div>
          <Button
            onClick={save}
            disabled={saving || uploading}
            aria-busy={saving}
            data-ui-key="template-submit"
          >
            {t('common.action.save')}
          </Button>
        </div>
      </div>
      <section className="flex min-w-0 flex-col gap-2" aria-labelledby="tpl-preview-title">
        <h3 id="tpl-preview-title" className="font-semibold">
          {t('settings.templates.previewTitle')}
        </h3>
        <div className="rounded-lg border border-dashed p-3">
          <p className="text-muted-foreground text-meta mb-3 flex items-center gap-1.5">
            <Eye aria-hidden className="size-4" />
            {t('settings.templates.previewNotice')}
          </p>
          <CustomerHomeBody
            project={{
              homeMessage: message,
              homeSections: sections,
              homeTheme: theme,
              homeCoverFileId: cover,
              currentPhase: '',
              startDate: null,
              endDate: null,
            }}
            blocks={PREVIEW_BLOCKS}
          />
        </div>
      </section>
    </div>
  );
}

const EMPTY_BLOCK = { items: [], failed: false };
const PREVIEW_BLOCKS = { recent: EMPTY_BLOCK, schedule: EMPTY_BLOCK, documents: EMPTY_BLOCK };

/** REQ-051 구성원 초대 (PM: owner/manager, 관리자: owner) — 링크 1회 표시 */
export function MemberInviteSheet({
  companyId,
  canInviteManager,
}: {
  companyId: string;
  canInviteManager: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<{ link: string; expiresAt: string } | null>(null);
  const [state, action] = useActionState(
    async (prev: Awaited<ReturnType<typeof createMemberInvite>> | null, form: FormData) => {
      const res = await createMemberInvite(prev, form);
      if (res.ok) {
        setShown(res.data);
        setOpen(false);
        router.refresh();
      }
      return res;
    },
    null,
  );
  const fe = state && !state.ok ? state.error.fieldErrors : undefined;
  return (
    <>
      <FormSheet
        triggerLabel={t('settings.members.invite')}
        triggerIcon={<UserPlus aria-hidden />}
        title={t('settings.members.invite')}
        description={t('projects.invite.noEmailHint')}
        uiKey="member-invite"
        open={open}
        onOpenChange={setOpen}
      >
        <form action={action} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="companyId" value={companyId} />
          <FormRow label={t('auth.field.email')} htmlFor="mi-email" errors={fe?.email} required>
            <Input
              id="mi-email"
              name="email"
              type="email"
              aria-describedby="mi-email-error"
              required
            />
          </FormRow>
          <FormRow label={t('settings.field.role')} htmlFor="mi-role" errors={fe?.role}>
            <NativeSelect id="mi-role" name="role" defaultValue="pm">
              <option value="pm">{t('settings.memberRole.pm')}</option>
              {canInviteManager ? (
                <option value="manager">{t('settings.memberRole.manager')}</option>
              ) : null}
            </NativeSelect>
          </FormRow>
          {state && !state.ok && !fe ? <FormError error={state.error} /> : null}
          <SubmitButton data-ui-key="member-invite-submit">
            {t('projects.invite.create')}
          </SubmitButton>
        </form>
      </FormSheet>
      <OneTimeLinkDialog
        link={shown?.link ?? null}
        expiresAt={shown?.expiresAt}
        title={t('settings.members.invite')}
        description={t('projects.invite.created')}
        onClose={() => setShown(null)}
      />
    </>
  );
}

/** owner: manager 지정·해제 — 제어형 값, 바꾸기 전 확인, 실패하면 원래 값으로 되돌린다 (A-12) */
export function MemberRoleSelect({
  companyId,
  memberId,
  version,
  role,
  name,
}: {
  companyId: string;
  memberId: string;
  version: number;
  role: 'manager' | 'pm';
  /** 확인 대화상자에 보일 구성원 이름 */
  name?: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const errorText = useActionErrorText();
  const [value, setValue] = useState<'manager' | 'pm'>(role);
  const [asked, setAsked] = useState<'manager' | 'pm' | null>(null);
  const [busy, setBusy] = useState(false);
  // 서버 값이 바뀌면(새로고침) 화면 값도 맞춘다
  const [synced, setSynced] = useState(role);
  if (synced !== role) {
    setSynced(role);
    setValue(role);
  }
  const label = (r: 'manager' | 'pm') => t(`settings.memberRole.${r}`);
  return (
    <>
      <NativeSelect
        aria-label={name ? `${t('settings.field.role')} · ${name}` : t('settings.field.role')}
        className="w-36"
        value={asked ?? value}
        disabled={busy}
        aria-busy={busy}
        data-ui-key="member-role-select"
        onChange={(e) => {
          const next = e.target.value as 'manager' | 'pm';
          if (next !== value) setAsked(next);
        }}
      >
        <option value="manager">{label('manager')}</option>
        <option value="pm">{label('pm')}</option>
      </NativeSelect>
      <ConfirmDialog
        open={asked !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setAsked(null); // 취소 → 원래 값 유지
        }}
        destructive={false}
        uiKey="member-role-change"
        title={name ? t('settings.confirm.changeRole.title', { name }) : t('settings.field.role')}
        body={t('settings.confirm.changeRole.body', {
          from: label(value),
          to: label(asked ?? value),
        })}
        confirmLabel={t('settings.confirm.changeRole.confirm')}
        pending={busy}
        onConfirm={async () => {
          const next = asked;
          if (!next) return;
          setBusy(true);
          const res = await changeMemberRole({
            companyId,
            memberId,
            baseVersion: version,
            role: next,
          });
          if (res.ok) {
            setValue(next);
            toast.success(t('settings.toast.roleChanged'));
          } else {
            setValue(role); // 실패 → 서버 값으로 되돌림
            toast.error(errorText(res.error));
          }
          setBusy(false);
          setAsked(null);
          router.refresh();
        }}
      />
    </>
  );
}

/** REQ-005 재설정 링크 (owner/manager → 자기 업체 사용자, 소유자 제외) */
export function ResetLinkButton({
  companyId,
  targetUserId,
  name,
}: {
  companyId: string;
  targetUserId: string;
  name: string;
}) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        aria-busy={pending}
        data-ui-key="member-reset-link-create"
        onClick={() =>
          start(async () => {
            const res = await createPasswordResetLink({ companyId, targetUserId });
            if (res.ok) setLink(res.data.link);
            else toast.error(t(`errors.${res.error.code}`));
          })
        }
      >
        <KeyRound aria-hidden />
        {t('settings.members.createResetLink')}
      </Button>
      <OneTimeLinkDialog
        link={link}
        title={`${t('settings.members.createResetLink')} · ${name}`}
        description={t('settings.members.resetLinkCreated')}
        onClose={() => setLink(null)}
      />
    </>
  );
}
