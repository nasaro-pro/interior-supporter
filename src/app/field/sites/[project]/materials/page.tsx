// src/app/field/sites/[project]/materials/page.tsx — FW-06 확정 자재 (통합본 7장 F2, 보기만). 담당자가 끄면 404
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { FieldMaterialList } from '@/features/field/components/FieldMaterialList';
import { requireFieldTab } from '@/features/field/server/guard';
import { listFieldMaterials } from '@/features/field/server/queries';
import { EmptyState } from '@/shared/ui/states';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('field');
  return { title: t('screen.materials') };
}

export default async function FieldMaterialsPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project: projectId } = await params;
  await requireFieldTab(projectId, 'materials');
  const [rows, t] = await Promise.all([listFieldMaterials(projectId), getTranslations('field')]);
  return (
    <main data-screen-id="FW-06" className="flex flex-col gap-4">
      <h1 className="sr-only">{t('screen.materials')}</h1>
      {rows.length === 0 ? (
        <EmptyState title={t('materials.empty')} />
      ) : (
        <FieldMaterialList materials={rows} />
      )}
    </main>
  );
}
