// PM-15 자재 상세 (D4) — REQ-111·112·113·121 · TR-03·04
import { requireEditorIn } from '@/features/designs/server/access';
import { getMaterial, listMaterialCategories } from '@/features/materials/server/queries';
import { MaterialDetailView } from '@/features/materials/components/MaterialDetailView';

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ company: string; project: string; materialId: string }>;
}) {
  const { company, project, materialId } = await params;
  const access = await requireEditorIn(company, project);
  const [material, categories] = await Promise.all([
    getMaterial(project, materialId),
    listMaterialCategories(project),
  ]);
  return (
    <main data-screen-id="PM-15" className="flex min-w-0 flex-col gap-6">
      <MaterialDetailView material={material} viewer={access} categories={categories} />
    </main>
  );
}
