// PM-14 도안 상세 (D4) — REQ-102·103·104·105·106·121. 버전·비교·확정 상태는 화면 상태 (D5 없음)
import { requireEditorIn } from '@/features/designs/server/access';
import { getDesignDetail, listComparablePreviews } from '@/features/designs/server/queries';
import { DesignDetailView } from '@/features/designs/components/DesignDetailView';

export default async function DesignDetailPage({
  params,
}: {
  params: Promise<{ company: string; project: string; designId: string }>;
}) {
  const { company, project, designId } = await params;
  const access = await requireEditorIn(company, project);
  const [design, candidates] = await Promise.all([
    getDesignDetail(project, designId),
    listComparablePreviews(project),
  ]);
  return (
    <main data-screen-id="PM-14" className="flex min-w-0 flex-col gap-6">
      <DesignDetailView design={design} viewer={access} candidates={candidates} />
    </main>
  );
}
