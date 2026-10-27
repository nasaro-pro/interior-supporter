// src/app/field/sites/[project]/schedule/page.tsx — FW-04 현장 일정 (통합본 7장 F2, 보기만). 담당자가 끄면 404
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { FieldScheduleList } from '@/features/field/components/FieldScheduleList';
import { requireFieldTab } from '@/features/field/server/guard';
import { listFieldSchedule } from '@/features/field/server/queries';
import { EmptyState } from '@/shared/ui/states';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('field');
  return { title: t('screen.schedule') };
}

export default async function FieldSchedulePage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project: projectId } = await params;
  await requireFieldTab(projectId, 'schedule');
  const [rows, t] = await Promise.all([listFieldSchedule(projectId), getTranslations('field')]);
  return (
    <main data-screen-id="FW-04" className="flex flex-col gap-4">
      <h1 className="sr-only">{t('screen.schedule')}</h1>
      {rows.length === 0 ? (
        <EmptyState title={t('schedule.empty')} />
      ) : (
        <FieldScheduleList items={rows} />
      )}
    </main>
  );
}
