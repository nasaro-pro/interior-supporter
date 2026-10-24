// PM-19 견적 상세 (D4, ?v=N) — REQ-131·132·133
import { requireEditorIn } from '@/features/designs/server/access';
import { parseVersionNo } from '@/features/estimates/schema';
import { getEstimate } from '@/features/estimates/server/queries';
import { EstimateDetailView } from '@/features/estimates/components/EstimateDetailView';

export default async function EstimateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string; project: string; estimateId: string }>;
  searchParams: Promise<{ v?: string | string[] }>;
}) {
  const { company, project, estimateId } = await params;
  const access = await requireEditorIn(company, project);
  const estimate = await getEstimate(project, estimateId, parseVersionNo((await searchParams).v));
  return (
    <main data-screen-id="PM-19" className="flex min-w-0 flex-col gap-6">
      <EstimateDetailView estimate={estimate} viewer={access} />
    </main>
  );
}
