'use client';
// src/features/core/components/participants.tsx (A · TASK-007, REQ-003·018) — PM-10 참여자 구역의 대화형 부분
// [PM 배정] [고객 계정 만들기] [시공팀 계정 만들기](D-12) · 임시 비밀번호 재발송(D-16) · 이름·기간·확정권 수정 · 회수
import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Copy, KeyRound, UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { FormError, FormRow, SubmitButton } from '@/shared/ui/form-parts';
import { NativeCheckbox, NativeSelect } from '@/shared/ui/native-fields';
import { assignPm, updateParticipant } from '../server/participant-actions';
import {
  createExternalAccount,
  resendTempPassword,
  type ExternalAccountResult,
} from '../server/auth-actions';
import { FormSheet } from './form-sheet';
import type { ParticipantItem } from '../types';

export function AssignPmForm({
  projectId,
  candidates,
}: {
  projectId: string;
  candidates: { userId: string; displayName: string }[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [pending, start] = useTransition();
  if (candidates.length === 0) return null;
  return (
    <div className="flex max-w-full min-w-0 flex-wrap items-end gap-2">
      <div className="w-full min-w-0 sm:w-56">
        <label htmlFor="assign-pm" className="text-sm font-medium">
          {t('projects.participants.assignPm')}
        </label>
        <NativeSelect id="assign-pm" value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">{t('common.action.select')}</option>
          {candidates.map((c) => (
            <option key={c.userId} value={c.userId}>
              {c.displayName}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button
        variant="outline"
        disabled={!userId || pending}
        aria-busy={pending}
        data-ui-key="participant-assign-pm-submit"
        onClick={() =>
          start(async () => {
            const res = await assignPm({ projectId, userId });
            if (res.ok) {
              toast.success(t('common.toast.saved'));
              setUserId('');
              router.refresh();
            } else toast.error(t(`errors.${res.error.code}`));
          })
        }
      >
        {t('projects.participants.assignPm')}
      </Button>
    </div>
  );
}

/** 이름(고객·시공팀)·기간·확정권 수정 (확정권은 고객만) */
export function ParticipantEditSheet({ projectId, p }: { projectId: string; p: ParticipantItem }) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(
    async (prev: Awaited<ReturnType<typeof updateParticipant>> | null, form: FormData) => {
      const res = await updateParticipant(prev, form);
      if (res.ok) {
        toast.success(t('common.toast.saved'));
        setOpen(false);
        router.refresh();
      }
      return res;
    },
    null,
  );
  const fe = state && !state.ok ? state.error.fieldErrors : undefined;
  const idp = `pe-${p.id}`;
  return (
    <FormSheet
      triggerLabel={t('common.action.edit')}
      triggerVariant="ghost"
      title={`${p.displayName} · ${t(`projects.participantRole.${p.role}`)}`}
      uiKey="participant-edit"
      open={open}
      onOpenChange={setOpen}
    >
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="participantId" value={p.id} />
        <input type="hidden" name="baseVersion" value={p.version} />
        {/* 고객 · 시공팀 이름 (PM 은 업체 구성원이라 본인이 바꾼다) */}
        {p.role !== 'pm' ? (
          <FormRow
            label={t('auth.field.displayName')}
            htmlFor={`${idp}-name`}
            errors={fe?.displayName}
            required
          >
            <Input
              id={`${idp}-name`}
              name="displayName"
              defaultValue={p.displayName}
              maxLength={80}
              aria-describedby={`${idp}-name-error`}
              required
            />
          </FormRow>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <FormRow
            label={t('projects.participants.validFrom')}
            htmlFor={`${idp}-from`}
            errors={fe?.validFrom}
          >
            <Input
              id={`${idp}-from`}
              name="validFrom"
              type="date"
              defaultValue={p.validFrom ?? ''}
              aria-describedby={`${idp}-from-error`}
            />
          </FormRow>
          <FormRow
            label={t('projects.participants.validUntil')}
            htmlFor={`${idp}-until`}
            errors={fe?.validUntil}
          >
            <Input
              id={`${idp}-until`}
              name="validUntil"
              type="date"
              defaultValue={p.validUntil ?? ''}
              aria-describedby={`${idp}-until-error`}
            />
          </FormRow>
        </div>
        <p className="text-muted-foreground text-meta">{t('projects.participants.periodHint')}</p>
        {p.role === 'customer' ? (
          <NativeCheckbox
            name="canConfirm"
            label={t('projects.participants.canConfirm')}
            defaultChecked={p.canConfirm}
          />
        ) : null}
        {state && !state.ok && !fe ? <FormError error={state.error} /> : null}
        <SubmitButton data-ui-key="participant-edit-submit">{t('common.action.save')}</SubmitButton>
      </form>
    </FormSheet>
  );
}

// ── D-12·D-13·D-16 고객·시공팀 계정 만들기 (초대 링크 대체) ─────────────────────

type Shown = { email: string; tempPassword: string } | null;

/** 메일을 보내지 못했을 때만 임시 비밀번호를 한 번 보여 준다 (닫으면 다시 볼 수 없음) */
export function TempPasswordDialog({ shown, onClose }: { shown: Shown; onClose: () => void }) {
  const t = useTranslations();
  const text = shown
    ? `${t('auth.field.email')}: ${shown.email}\n${t('auth.field.tempPassword')}: ${shown.tempPassword}`
    : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('common.toast.copied'));
    } catch (e) {
      void e;
      toast.error(t('common.toast.copyFailed'));
    }
  };
  return (
    <Dialog open={shown !== null} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('projects.account.tempTitle')}</DialogTitle>
          <DialogDescription>{t('projects.account.mailNotSent')}</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t('auth.field.email')}</dt>
          <dd className="break-all">{shown?.email}</dd>
          <dt className="text-muted-foreground">{t('auth.field.tempPassword')}</dt>
          <dd className="font-mono" data-ui-key="temp-password-value">
            {shown?.tempPassword}
          </dd>
        </dl>
        <p className="text-meta text-tone-attention-fg">{t('projects.account.closeWarning')}</p>
        <DialogFooter>
          <Button onClick={copy} data-ui-key="temp-password-copy">
            <Copy aria-hidden />
            {t('projects.account.copy')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function useAccountResultToast() {
  const t = useTranslations();
  return (r: { created?: boolean; mail: ExternalAccountResult['mail'] }) => {
    if (r.created === false) toast.success(t('projects.account.assignedExisting'));
    else if (r.mail === 'sent') toast.success(t('projects.account.mailSent'));
    else toast.success(t('projects.account.created'));
  };
}

/**
 * D-12: 고객·시공팀 계정 만들기. 버튼은 역할마다 따로 (고객 / 시공팀).
 * projectId 를 주면 그 프로젝트로 고정(PM-10), projects 를 주면 프로젝트를 고른다(업체 설정, D-13).
 */
export function ExternalAccountSheet({
  role,
  projectId,
  projects,
}: {
  role: 'customer' | 'field';
  projectId?: string;
  projects?: { id: string; name: string }[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const done = useAccountResultToast();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [shown, setShown] = useState<Shown>(null);
  const [state, action] = useActionState(
    async (prev: Awaited<ReturnType<typeof createExternalAccount>> | null, form: FormData) => {
      const res = await createExternalAccount(prev, form);
      if (res.ok) {
        done(res.data);
        if (res.data.tempPassword)
          setShown({ email: res.data.email, tempPassword: res.data.tempPassword });
        setOpen(false);
        setFormKey((k) => k + 1);
        router.refresh();
      }
      return res;
    },
    null,
  );
  const fe = state && !state.ok ? state.error.fieldErrors : undefined;
  const label =
    role === 'customer' ? t('projects.account.createCustomer') : t('projects.account.createField');
  const idp = `acc-${role}${projectId ? '' : '-co'}`;
  return (
    <>
      <FormSheet
        triggerLabel={label}
        triggerVariant="outline"
        triggerIcon={<UserPlus aria-hidden />}
        title={label}
        description={t('projects.account.hint')}
        uiKey={`account-create-${role}`}
        open={open}
        onOpenChange={setOpen}
      >
        <form key={formKey} action={action} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="role" value={role} />
          {projectId ? (
            <input type="hidden" name="projectId" value={projectId} />
          ) : (
            <FormRow
              label={t('projects.account.project')}
              htmlFor={`${idp}-project`}
              errors={fe?.projectId}
              required
            >
              <NativeSelect
                id={`${idp}-project`}
                name="projectId"
                defaultValue=""
                aria-describedby={`${idp}-project-error`}
                required
              >
                <option value="" disabled>
                  {t('common.action.select')}
                </option>
                {(projects ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </FormRow>
          )}
          <FormRow
            label={t('auth.field.displayName')}
            htmlFor={`${idp}-name`}
            errors={fe?.displayName}
            required
          >
            <Input
              id={`${idp}-name`}
              name="displayName"
              maxLength={80}
              aria-describedby={`${idp}-name-error`}
              required
            />
          </FormRow>
          <FormRow
            label={t('projects.account.emailId')}
            htmlFor={`${idp}-email`}
            errors={fe?.email}
            required
          >
            <Input
              id={`${idp}-email`}
              name="email"
              type="email"
              aria-describedby={`${idp}-email-error`}
              required
            />
          </FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow
              label={t('projects.participants.validFrom')}
              htmlFor={`${idp}-from`}
              errors={fe?.validFrom}
            >
              <Input
                id={`${idp}-from`}
                name="validFrom"
                type="date"
                aria-describedby={`${idp}-from-error`}
              />
            </FormRow>
            <FormRow
              label={t('projects.participants.validUntil')}
              htmlFor={`${idp}-until`}
              errors={fe?.validUntil}
            >
              <Input
                id={`${idp}-until`}
                name="validUntil"
                type="date"
                aria-describedby={`${idp}-until-error`}
              />
            </FormRow>
          </div>
          <p className="text-muted-foreground text-meta">{t('projects.participants.periodHint')}</p>
          {role === 'customer' ? (
            <div>
              <NativeCheckbox name="canConfirm" label={t('projects.participants.canConfirm')} />
              <p className="text-muted-foreground text-meta mt-1">
                {t('projects.participants.confirmRightHint')}
              </p>
            </div>
          ) : null}
          {state && !state.ok && !fe ? <FormError error={state.error} /> : null}
          <SubmitButton data-ui-key={`account-create-${role}-submit`}>
            {t('projects.account.submit')}
          </SubmitButton>
        </form>
      </FormSheet>
      <TempPasswordDialog shown={shown} onClose={() => setShown(null)} />
    </>
  );
}

/** D-16: 임시 비밀번호 재발송 — 첫 로그인 전 계정만 (서버가 판정, 이미 바꾼 계정은 CONFLICT) */
export function ResendTempPasswordButton({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}) {
  const t = useTranslations();
  const done = useAccountResultToast();
  const [pending, start] = useTransition();
  const [shown, setShown] = useState<Shown>(null);
  return (
    <>
      <Button
        variant="ghost"
        disabled={pending}
        aria-busy={pending}
        data-ui-key="account-resend"
        onClick={() =>
          start(async () => {
            const res = await resendTempPassword({ projectId, userId });
            if (res.ok) {
              done(res.data);
              if (res.data.tempPassword)
                setShown({ email: res.data.email, tempPassword: res.data.tempPassword });
            } else if (res.error.code === 'CONFLICT')
              toast.error(t('projects.account.alreadyActive'));
            else toast.error(t(`errors.${res.error.code}`));
          })
        }
      >
        <KeyRound aria-hidden />
        {t('projects.account.resend')}
      </Button>
      <TempPasswordDialog shown={shown} onClose={() => setShown(null)} />
    </>
  );
}
