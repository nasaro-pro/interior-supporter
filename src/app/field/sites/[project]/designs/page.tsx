// src/app/field/sites/[project]/designs/page.tsx — FW-05 확정 도안 (통합본 7장 F2, 보기만). 담당자가 끄면 404
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { FieldDesignList } from '@/features/field/components/FieldDesignList';
import { requireFieldTab } from '@/features/field/server/guard';
import { listFieldDesigns } from '@/features/field/server/queries';
import { EmptyState } from '@/shared/ui/states';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('field');
  return { title: t('screen.designs') };
}

export default async function FieldDesignsPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project: projectId } = await params;
  await requireFieldTab(projectId, 'designs');
  const [rows, t] = await Promise.all([listFieldDesigns(projectId), getTranslations('field')]);
  return (
    <main data-screen-id="FW-05" className="flex flex-col gap-4">
      <h1 className="sr-only">{t('screen.designs')}</h1>
      {rows.length === 0 ? (
        <EmptyState title={t('designs.empty')} />
      ) : (
        <FieldDesignList designs={rows} />
      )}
    </main>
  );
}
