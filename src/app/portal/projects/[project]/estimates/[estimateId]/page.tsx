// CL-19 견적 상세 (고객, D4, ?v=N) — 공개 버전만, 비공개 버전 직접 링크는 notFound · REQ-132
import { requireCustomerOf } from '@/features/designs/server/access';
import { parseVersionNo } from '@/features/estimates/schema';
import { getEstimate } from '@/features/estimates/server/queries';
import { EstimateDetailView } from '@/features/estimates/components/EstimateDetailView';

export default async function PortalEstimateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string; estimateId: string }>;
  searchParams: Promise<{ v?: string | string[] }>;
}) {
  const { project, estimateId } = await params;
  const access = await requireCustomerOf(project);
  const estimate = await getEstimate(project, estimateId, parseVersionNo((await searchParams).v));
  return (
    <main data-screen-id="CL-19" className="flex min-w-0 flex-col gap-6">
      <EstimateDetailView estimate={estimate} viewer={access} />
    </main>
  );
}
