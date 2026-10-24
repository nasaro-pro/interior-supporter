'use client';
// src/features/core/components/participants.tsx (A · TASK-007, REQ-003·018) — PM-10 참여자 구역의 대화형 부분
// [PM 배정] [고객 초대] [시공팀 초대] → 링크 1회 표시 · 기간·확정권 수정 · 회수 · 초대 폐기 (02 문서 6.7)
import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { FormError, FormRow, SubmitButton } from '@/shared/ui/form-parts';
import { NativeCheckbox, NativeSelect } from '@/shared/ui/native-fields';
import { assignPm, createProjectInvite, updateParticipant } from '../server/participant-actions';
import { FormSheet } from './form-sheet';
import { OneTimeLinkDialog } from './one-time-link';
import type { ParticipantItem } from '../types';

export function InviteParticipantSheet({
  projectId,
  role,
}: {
  projectId: string;
  role: 'customer' | 'field';
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [shown, setShown] = useState<{ link: string; expiresAt: string } | null>(null);
  const [state, action] = useActionState(
    async (prev: Awaited<ReturnType<typeof createProjectInvite>> | null, form: FormData) => {
      const res = await createProjectInvite(prev, form);
      if (res.ok) {
        setShown(res.data);
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
    role === 'customer'
      ? t('projects.participants.inviteCustomer')
      : t('projects.participants.inviteField');
  const idp = `inv-${role}`;
  return (
    <>
      <FormSheet
        triggerLabel={label}
        triggerVariant="outline"
        triggerIcon={<UserPlus aria-hidden />}
        title={label}
        description={t('projects.invite.noEmailHint')}
        uiKey={`participant-invite-${role}`}
        open={open}
        onOpenChange={setOpen}
      >
        <form key={formKey} action={action} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="role" value={role} />
          <FormRow
            label={t('auth.field.email')}
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
          <p className="text-muted-foreground text-meta">{t('projects.invite.reissueHint')}</p>
          {state && !state.ok && !fe ? <FormError error={state.error} /> : null}
          <SubmitButton data-ui-key={`participant-invite-${role}-submit`}>
            {t('projects.invite.create')}
          </SubmitButton>
        </form>
      </FormSheet>
      <OneTimeLinkDialog
        link={shown?.link ?? null}
        expiresAt={shown?.expiresAt}
        title={label}
        description={t('projects.invite.created')}
        onClose={() => setShown(null)}
      />
    </>
  );
}

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

/** 기간·확정권 수정 (확정권은 고객만) */
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
