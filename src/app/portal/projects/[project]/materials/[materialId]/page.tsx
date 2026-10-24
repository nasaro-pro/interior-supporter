// CL-15 자재 상세 (고객, D4) — 공개 자재, 확정은 화면 상태 (TR-07) · REQ-112·120
import { requireCustomerOf } from '@/features/designs/server/access';
import { getMaterial } from '@/features/materials/server/queries';
import { MaterialDetailView } from '@/features/materials/components/MaterialDetailView';

export default async function PortalMaterialDetailPage({
  params,
}: {
  params: Promise<{ project: string; materialId: string }>;
}) {
  const { project, materialId } = await params;
  const access = await requireCustomerOf(project);
  const material = await getMaterial(project, materialId);
  return (
    <main data-screen-id="CL-15" className="flex min-w-0 flex-col gap-6">
      <MaterialDetailView material={material} viewer={access} categories={[]} />
    </main>
  );
}
