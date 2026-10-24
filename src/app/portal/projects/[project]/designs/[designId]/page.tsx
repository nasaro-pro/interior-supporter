// CL-14 도안 상세 (고객, D4) — 공개 도안의 현재 버전만, 확정은 화면 상태 · REQ-103·105·120
import { requireCustomerOf } from '@/features/designs/server/access';
import { getDesignDetail, listComparablePreviews } from '@/features/designs/server/queries';
import { DesignDetailView } from '@/features/designs/components/DesignDetailView';

export default async function PortalDesignDetailPage({
  params,
}: {
  params: Promise<{ project: string; designId: string }>;
}) {
  const { project, designId } = await params;
  const access = await requireCustomerOf(project);
  const [design, candidates] = await Promise.all([
    getDesignDetail(project, designId),
    listComparablePreviews(project),
  ]);
  return (
    <main data-screen-id="CL-14" className="flex min-w-0 flex-col gap-6">
      <DesignDetailView design={design} viewer={access} candidates={candidates} />
    </main>
  );
}
