'use client';
// 일정 등록(?mode=new)·수정(?mode=edit) Sheet — REQ-231. 시각 없으면 종일, 종료일 포함, KST 달력 값
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Pencil, Plus } from 'lucide-react';
import type { AppError } from '@/shared/contracts/errors';
import { routes } from '@/shared/contracts/routes';
import { useSearchParamState } from '@/shared/hooks/use-search-param-state';
import { ActionError } from '@/shared/ui/action-error';
import { Button } from '@/shared/ui/button';
import { FormField } from '@/shared/ui/form-parts';
import { FormSheet } from '@/shared/ui/form-sheet';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-fields';
import { SwitchField } from '@/shared/ui/switch-field';
import { Textarea } from '@/shared/ui/textarea';
import { createScheduleEvent, updateScheduleEvent } from '../server/actions';
import type { RelatedOption } from '../server/related';
import {
  RELATED_TYPES,
  SCHEDULE_PROGRESS,
  SCHEDULE_LIMITS,
  scheduleFormSchema,
  type RelatedType,
  type ScheduleFormValues,
} from '../schema';
import type { ScheduleEvent } from '../types';

const FIELDS = [
  'title',
  'description',
  'startDate',
  'startTime',
  'endDate',
  'endTime',
  'isPublic',
  'progress',
  'relatedType',
  'relatedId',
] as const;
const nullable = (v: string) => (v === '' ? null : v);

export function ScheduleFormSheet({
  mode,
  projectId,
  companySlug,
  event,
  defaultDate,
  relatedOptions,
  projectNames,
}: {
  mode: 'new' | 'edit';
  projectId: string;
  companySlug: string;
  event?: ScheduleEvent;
  /** 새 일정 시작일 기본값 (선택한 날 또는 오늘, KST) */
  defaultDate: string;
  relatedOptions: RelatedOption[];
  /** 관련 항목 선택지를 프로젝트별로 묶을 때 쓰는 이름 (편집 가능한 프로젝트, 다른 프로젝트 연결 허용) */
  projectNames: Record<string, string>;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [param, setParam] = useSearchParamState('mode');
  const open = param === mode;
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [serverError, setServerError] = useState<AppError | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      title: event?.title ?? '',
      description: event?.description ?? '',
      startDate: event?.startDate ?? defaultDate,
      startTime: event?.startTime ?? null,
      endDate: event?.endDate ?? null,
      endTime: event?.endTime ?? null,
      isPublic: event?.isPublic ?? false,
      progress: event?.progress ?? 'planned',
      relatedType: event?.relatedType ?? null,
      relatedId: event?.relatedId ?? null,
    },
  });
  const { errors } = form.formState;
  const relatedType = useWatch({ control: form.control, name: 'relatedType' });
  const err = (key: (typeof FIELDS)[number], max?: number) => {
    const msg = errors[key]?.message;
    return msg ? t(`errors.${msg}`, { max: max ?? 0 }) : undefined;
  };

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res =
        mode === 'new'
          ? await createScheduleEvent({ id: clientId, projectId, ...values })
          : await updateScheduleEvent({
              eventId: event!.id,
              projectId,
              baseVersion: event!.version,
              ...values,
            });
      if (!res.ok) {
        setServerError(res.error);
        for (const [field, keys] of Object.entries(res.error.fieldErrors ?? {})) {
          if ((FIELDS as readonly string[]).includes(field)) {
            form.setError(field as (typeof FIELDS)[number], { message: keys[0] });
          }
        }
        return; // 입력 보존
      }
      setServerError(null);
      if (mode === 'new') {
        toast.success(t('schedule.toast.created'));
        const id = clientId;
        setClientId(crypto.randomUUID());
        form.reset();
        router.push(routes.app.scheduleEvent(companySlug, projectId, id));
      } else {
        toast.success(t('schedule.toast.updated'));
        setParam(null);
        router.refresh();
      }
    }),
  );

  const titleError = err('title', SCHEDULE_LIMITS.title);
  const descError = err('description', SCHEDULE_LIMITS.description);
  const startDateError = err('startDate');
  const endDateError = err('endDate');
  const endTimeError = err('endTime');
  const relatedError = err('relatedId');
  const options = relatedOptions.filter((o) => o.type === relatedType);
  // 현재 프로젝트를 먼저, 나머지 프로젝트는 이름순으로 묶는다
  // Object.groupBy 는 iOS Safari 16 에 없어 직접 묶는다 (NFR-005)
  const byProject = new Map<string, RelatedOption[]>();
  for (const o of options) byProject.set(o.projectId, [...(byProject.get(o.projectId) ?? []), o]);
  const groups = [...byProject]
    .map(([pid, list]) => ({ pid, list, name: projectNames[pid] ?? '' }))
    .sort((a, b) =>
      a.pid === projectId ? -1 : b.pid === projectId ? 1 : a.name.localeCompare(b.name),
    );

  return (
    <>
      <Button
        variant={mode === 'new' ? 'default' : 'outline'}
        onClick={() => setParam(mode)}
        data-ui-key={mode === 'new' ? 'schedule-create-open' : 'schedule-edit-open'}
      >
        {mode === 'new' ? <Plus aria-hidden /> : <Pencil aria-hidden />}
        {mode === 'new' ? t('schedule.action.create') : t('schedule.action.edit')}
      </Button>
      <FormSheet
        open={open}
        onOpenChange={(next) => setParam(next ? mode : null)}
        busy={pending}
        uiKey={mode === 'new' ? 'schedule-create-sheet' : 'schedule-edit-sheet'}
        title={mode === 'new' ? t('schedule.action.create') : t('schedule.action.edit')}
        description={t('schedule.form.timeHint')}
        footer={
          <>
            <Button variant="outline" onClick={() => setParam(null)} disabled={pending}>
              {t('common.action.cancel')}
            </Button>
            <Button
              type="submit"
              form="schedule-form"
              pending={pending}
              data-ui-key="schedule-form-submit"
            >
              {t('common.action.save')}
            </Button>
          </>
        }
      >
        <form id="schedule-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <ActionError error={serverError} />
          <FormField
            id="schedule-title"
            label={t('schedule.field.title')}
            required
            requiredLabel={t('common.field.required')}
            error={titleError}
          >
            <Input maxLength={SCHEDULE_LIMITS.title} {...form.register('title')} />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              id="schedule-start-date"
              label={t('schedule.field.startDate')}
              required
              requiredLabel={t('common.field.required')}
              error={startDateError}
            >
              <Input type="date" {...form.register('startDate')} />
            </FormField>
            <FormField id="schedule-start-time" label={t('schedule.field.startTime')}>
              <Input type="time" {...form.register('startTime', { setValueAs: nullable })} />
            </FormField>
            <FormField
              id="schedule-end-date"
              label={t('schedule.field.endDate')}
              hint={t('schedule.form.endDateHint')}
              error={endDateError}
            >
              <Input type="date" {...form.register('endDate', { setValueAs: nullable })} />
            </FormField>
            <FormField
              id="schedule-end-time"
              label={t('schedule.field.endTime')}
              error={endTimeError}
            >
              <Input type="time" {...form.register('endTime', { setValueAs: nullable })} />
            </FormField>
          </div>
          <FormField id="schedule-desc" label={t('schedule.field.description')} error={descError}>
            <Textarea
              rows={4}
              maxLength={SCHEDULE_LIMITS.description}
              {...form.register('description')}
            />
          </FormField>
          {/* D-30 진행 상태 */}
          <FormField
            id="schedule-progress"
            label={t('schedule.field.progress')}
            error={err('progress')}
          >
            <NativeSelect data-ui-key="schedule-progress-select" {...form.register('progress')}>
              {SCHEDULE_PROGRESS.map((p) => (
                <option key={p} value={p}>
                  {t(`schedule.progress.${p}`)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <Controller
            control={form.control}
            name="isPublic"
            render={({ field }) => (
              <SwitchField
                id="schedule-public"
                label={t('common.visibility.label')}
                description={t('schedule.form.publishHint')}
                checked={field.value}
                onCheckedChange={field.onChange}
                uiKey="schedule-public-toggle"
              />
            )}
          />
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium">{t('schedule.field.related')}</legend>
            <FormField id="schedule-related-type" label={t('schedule.field.relatedType')}>
              <NativeSelect
                value={relatedType ?? ''}
                onChange={(e) => {
                  form.setValue('relatedType', (e.target.value || null) as RelatedType | null);
                  form.setValue('relatedId', null);
                }}
              >
                <option value="">{t('schedule.form.relatedNone')}</option>
                {RELATED_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`schedule.relatedType.${type}`)}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            {relatedType ? (
              <FormField
                id="schedule-related-id"
                label={t('schedule.form.relatedItem')}
                error={relatedError}
                hint={options.length === 0 ? t('schedule.form.relatedEmpty') : undefined}
              >
                <NativeSelect {...form.register('relatedId', { setValueAs: nullable })}>
                  <option value="">{t('common.action.select')}</option>
                  {groups.map((g) => (
                    <optgroup
                      key={g.pid}
                      label={
                        g.pid === projectId
                          ? t('schedule.form.currentProject', { name: g.name })
                          : g.name
                      }
                    >
                      {g.list.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </NativeSelect>
              </FormField>
            ) : null}
          </fieldset>
        </form>
      </FormSheet>
    </>
  );
}
