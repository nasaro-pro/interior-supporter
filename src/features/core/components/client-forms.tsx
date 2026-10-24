'use client';
// src/features/core/components/client-forms.tsx (A · TASK-013) — 고객 카드 등록·수정 Sheet, 프로젝트 연결
import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { Button } from '@/shared/ui/button';
import { FormError, FormRow, SubmitButton } from '@/shared/ui/form-parts';
import { NativeSelect } from '@/shared/ui/native-fields';
import type { ActionResult } from '@/shared/contracts/errors';
import { createClient, linkClientProject, updateClient } from '../server/client-actions';
import { FormSheet } from './form-sheet';
import type { ClientItem } from '../types';

function ClientFields({ fe, c }: { fe?: Record<string, string[]>; c?: ClientItem }) {
  const t = useTranslations('clients');
  return (
    <>
      <FormRow label={t('field.name')} htmlFor="cl-name" errors={fe?.name} required>
        <Input
          id="cl-name"
          name="name"
          defaultValue={c?.name}
          maxLength={80}
          aria-describedby="cl-name-error"
          required
        />
      </FormRow>
      <FormRow label={t('field.phone')} htmlFor="cl-phone" errors={fe?.phone}>
        <Input
          id="cl-phone"
          name="phone"
          type="tel"
          defaultValue={c?.phone}
          maxLength={30}
          aria-describedby="cl-phone-error"
        />
      </FormRow>
      <FormRow label={t('field.email')} htmlFor="cl-email" errors={fe?.email}>
        <Input
          id="cl-email"
          name="email"
          type="email"
          defaultValue={c?.email ?? ''}
          aria-describedby="cl-email-error"
        />
      </FormRow>
      <FormRow label={t('field.memo')} htmlFor="cl-memo" errors={fe?.memo}>
        <Textarea
          id="cl-memo"
          name="memo"
          defaultValue={c?.memo}
          maxLength={2000}
          rows={4}
          aria-describedby="cl-memo-error"
        />
      </FormRow>
    </>
  );
}

export function ClientCreateSheet({
  companySlug,
  defaultOpen,
}: {
  companySlug: string;
  defaultOpen?: boolean;
}) {
  const t = useTranslations();
  const [state, action] = useActionState(createClient, null);
  const [id] = useState(() => crypto.randomUUID());
  const fe = state && !state.ok ? state.error.fieldErrors : undefined;
  return (
    <FormSheet
      triggerLabel={t('clients.list.create')}
      triggerIcon={<Plus aria-hidden />}
      title={t('clients.list.create')}
      description={t('clients.detail.cardVsAccount')}
      uiKey="client-create"
      defaultOpen={defaultOpen}
    >
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="companySlug" value={companySlug} />
        <input type="hidden" name="id" value={id} />
        <ClientFields fe={fe} />
        {state && !state.ok && !fe ? <FormError error={state.error} /> : null}
        <SubmitButton data-ui-key="client-create-submit">{t('clients.list.create')}</SubmitButton>
      </form>
    </FormSheet>
  );
}

export function ClientEditSheet({
  companySlug,
  client,
}: {
  companySlug: string;
  client: ClientItem;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(
    async (prev: ActionResult<{ version: number }> | null, form: FormData) => {
      const res = await updateClient(prev, form);
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
  return (
    <FormSheet
      triggerLabel={t('common.action.edit')}
      triggerVariant="outline"
      title={client.name}
      uiKey="client-edit"
      open={open}
      onOpenChange={setOpen}
    >
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="companySlug" value={companySlug} />
        <input type="hidden" name="id" value={client.id} />
        <input type="hidden" name="baseVersion" value={client.version} />
        <ClientFields fe={fe} c={client} />
        {state && !state.ok && !fe ? <FormError error={state.error} /> : null}
        <SubmitButton data-ui-key="client-edit-submit">{t('common.action.save')}</SubmitButton>
      </form>
    </FormSheet>
  );
}

export function LinkProjectForm({
  clientId,
  options,
}: {
  clientId: string;
  options: { id: string; name: string }[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [projectId, setProjectId] = useState('');
  const [pending, start] = useTransition();
  if (options.length === 0)
    return <p className="text-muted-foreground text-meta">{t('clients.detail.noLinkable')}</p>;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-64 max-w-full">
        <label htmlFor="link-project" className="text-sm font-medium">
          {t('clients.detail.linkProject')}
        </label>
        <NativeSelect
          id="link-project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">{t('common.action.select')}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button
        variant="outline"
        disabled={!projectId || pending}
        aria-busy={pending}
        data-ui-key="client-link-project-submit"
        onClick={() =>
          start(async () => {
            const res = await linkClientProject({ clientId, projectId });
            if (res.ok) {
              toast.success(t('clients.toast.projectLinked'));
              setProjectId('');
              router.refresh();
            } else toast.error(t(`errors.${res.error.code}`));
          })
        }
      >
        {t('clients.detail.linkProject')}
      </Button>
    </div>
  );
}
