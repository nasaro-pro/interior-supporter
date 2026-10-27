'use client';
// src/features/core/components/project-forms.tsx (A · TASK-005·007) — 프로젝트 생성 Sheet(PM-01)·기본 정보 폼(PM-10)
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSearchParamState } from '@/shared/hooks/use-search-param-state';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { FormError, FormRow, SubmitButton } from '@/shared/ui/form-parts';
import { NativeCheckbox, NativeSelect } from '@/shared/ui/native-fields';
import { ConflictState } from '@/shared/ui/states';
import { PROJECT_STATUSES, type ProjectStatus } from '@/shared/contracts/domain';
import { createProject, updateProject } from '../server/project-actions';
import { FormSheet } from './form-sheet';
import type { ActionResult } from '@/shared/contracts/errors';
import type { ProjectDetail } from '../types';

function StatusSelect({ id, defaultValue }: { id: string; defaultValue: ProjectStatus }) {
  const t = useTranslations('projects');
  return (
    <NativeSelect id={id} name="status" defaultValue={defaultValue}>
      {PROJECT_STATUSES.map((s) => (
        <option key={s} value={s}>
          {t(`status.${s}`)}
        </option>
      ))}
    </NativeSelect>
  );
}

/** REQ-011: 이름·현장·기간·상태 → 생성 후 PM-03. id 는 Sheet 를 열 때 만든다 (POL-038) */
export function ProjectCreateSheet({ companySlug }: { companySlug: string }) {
  const t = useTranslations('projects');
  const [state, action] = useActionState(createProject, null);
  const [id] = useState(() => crypto.randomUUID());
  // D-02: 열림 상태를 ?mode=new 와 동기화 — 빈 화면 '생성' 링크·버튼·새로고침 모두 같은 상태
  const [mode, setMode] = useSearchParamState('mode');
  const open = mode === 'new';
  const fe = state && !state.ok ? state.error.fieldErrors : undefined;
  return (
    <FormSheet
      triggerLabel={t('list.create')}
      triggerIcon={<Plus aria-hidden />}
      title={t('list.create')}
      uiKey="project-create"
      open={open}
      onOpenChange={(next) => setMode(next ? 'new' : null)}
    >
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="companySlug" value={companySlug} />
        <input type="hidden" name="id" value={id} />
        <FormRow label={t('field.name')} htmlFor="pc-name" errors={fe?.name} required>
          <Input
            id="pc-name"
            name="name"
            maxLength={120}
            aria-describedby="pc-name-error"
            required
          />
        </FormRow>
        <FormRow label={t('field.siteAddress')} htmlFor="pc-site" errors={fe?.siteAddress}>
          <Input id="pc-site" name="siteAddress" maxLength={200} aria-describedby="pc-site-error" />
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label={t('field.startDate')} htmlFor="pc-start" errors={fe?.startDate}>
            <Input id="pc-start" name="startDate" type="date" aria-describedby="pc-start-error" />
          </FormRow>
          <FormRow label={t('field.endDate')} htmlFor="pc-end" errors={fe?.endDate}>
            <Input id="pc-end" name="endDate" type="date" aria-describedby="pc-end-error" />
          </FormRow>
        </div>
        <FormRow label={t('list.statusLabel')} htmlFor="pc-status" errors={fe?.status}>
          <StatusSelect id="pc-status" defaultValue="planned" />
        </FormRow>
        <p className="text-muted-foreground text-meta">{t('list.createHint')}</p>
        {state && !state.ok && !fe ? <FormError error={state.error} /> : null}
        <SubmitButton data-ui-key="project-create-submit">{t('list.create')}</SubmitButton>
      </form>
    </FormSheet>
  );
}

/**
 * A-06: 충돌 뒤 "최신 불러오기" 로 넘어갈 때 사용자가 입력한 값을 잠시 보관한다 (프로젝트별 1개).
 * 부모가 key={project.version} 으로 다시 그리므로 컴포넌트 상태는 사라진다 → 모듈 범위에 둔다.
 * 새 인스턴스가 마운트되면 꺼내 쓰고 지운다.
 */
const basicsDrafts = new Map<string, Record<string, string>>();

/** 테스트 전용 */
export function _basicsDraftFor(projectId: string) {
  return basicsDrafts.get(projectId);
}

function formValues(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === 'string') out[k] = v;
  });
  return out;
}

/** REQ-017: 기본 정보·현재 공정·고객 공개 (PM-10 기본 정보 구역) — 부모는 key={project.version} 을 준다 */
export function ProjectBasicsForm({ project }: { project: ProjectDetail }) {
  const t = useTranslations();
  const router = useRouter();
  // A-06: 성공한 저장의 version 을 상태로 기억한다. 이후 검증 오류가 나도 baseVersion 이 되돌아가지 않는다
  const [baseVersion, setBaseVersion] = useState(project.version);
  const [conflict, setConflict] = useState(false);
  const [draft, setDraft] = useState(() => basicsDrafts.get(project.id) ?? null);
  useEffect(() => {
    basicsDrafts.delete(project.id); // 한 번 꺼내 쓴 입력은 지운다
  }, [project.id]);

  const [state, action] = useActionState(
    async (prev: ActionResult<{ version: number }> | null, form: FormData) => {
      const res = await updateProject(prev, form);
      if (res.ok) {
        setBaseVersion(res.data.version);
        toast.success(t('common.toast.saved'));
        router.refresh();
      } else if (res.error.code === 'VERSION_CONFLICT') {
        const values = formValues(form);
        basicsDrafts.set(project.id, values);
        setDraft(values);
        setConflict(true);
      }
      return res;
    },
    null,
  );
  const fe = state && !state.ok ? state.error.fieldErrors : undefined;
  const v = (name: string, fallback: string) => draft?.[name] ?? fallback;

  if (conflict) {
    return (
      <ConflictState
        action={
          <Button
            onClick={() => {
              // 최신 내용으로 다시 그린다(부모 key 변경 → 새 인스턴스가 보관한 입력을 채운다).
              // 버전이 그대로면(행을 볼 수 없게 됨 등) 같은 인스턴스에서 폼으로 돌아간다
              setConflict(false);
              router.refresh();
            }}
            data-ui-key="project-basics-reload"
          >
            {t('common.action.loadLatest')}
          </Button>
        }
      />
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="projectId" value={project.id} />
      <input type="hidden" name="baseVersion" value={baseVersion} />
      <FormRow label={t('projects.field.name')} htmlFor="pb-name" errors={fe?.name} required>
        <Input
          id="pb-name"
          name="name"
          defaultValue={v('name', project.name)}
          maxLength={120}
          aria-describedby="pb-name-error"
          required
        />
      </FormRow>
      <FormRow label={t('projects.field.siteAddress')} htmlFor="pb-site" errors={fe?.siteAddress}>
        <Input
          id="pb-site"
          name="siteAddress"
          defaultValue={v('siteAddress', project.siteAddress)}
          maxLength={200}
          aria-describedby="pb-site-error"
        />
      </FormRow>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormRow label={t('projects.field.startDate')} htmlFor="pb-start" errors={fe?.startDate}>
          <Input
            id="pb-start"
            name="startDate"
            type="date"
            defaultValue={v('startDate', project.startDate ?? '')}
            aria-describedby="pb-start-error"
          />
        </FormRow>
        <FormRow label={t('projects.field.endDate')} htmlFor="pb-end" errors={fe?.endDate}>
          <Input
            id="pb-end"
            name="endDate"
            type="date"
            defaultValue={v('endDate', project.endDate ?? '')}
            aria-describedby="pb-end-error"
          />
        </FormRow>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormRow label={t('projects.list.statusLabel')} htmlFor="pb-status" errors={fe?.status}>
          <StatusSelect
            id="pb-status"
            defaultValue={(draft?.status as ProjectStatus | undefined) ?? project.status}
          />
        </FormRow>
        <FormRow
          label={t('projects.field.currentPhase')}
          htmlFor="pb-phase"
          errors={fe?.currentPhase}
          hint={t('projects.settings.phaseHint')}
        >
          <Input
            id="pb-phase"
            name="currentPhase"
            defaultValue={v('currentPhase', project.currentPhase)}
            maxLength={60}
            aria-describedby="pb-phase-error"
          />
        </FormRow>
      </div>
      <div className="bg-muted/50 flex flex-col gap-1 rounded-md p-3">
        <NativeCheckbox
          name="isPublic"
          label={t('projects.field.isPublic')}
          defaultChecked={draft ? draft.isPublic === 'on' : project.isPublic}
          data-ui-key="project-public-toggle"
        />
        <p className="text-muted-foreground text-meta">{t('projects.settings.publicHint')}</p>
      </div>
      {state && !state.ok && !fe && state.error.code !== 'VERSION_CONFLICT' ? (
        <FormError error={state.error} />
      ) : null}
      <div>
        <SubmitButton data-ui-key="project-basics-submit">{t('common.action.save')}</SubmitButton>
      </div>
    </form>
  );
}
