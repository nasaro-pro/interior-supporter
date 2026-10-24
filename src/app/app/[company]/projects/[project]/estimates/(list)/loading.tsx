// PM-09 로딩 상태 (Skeleton) — 목록 전용((list) 그룹). 상세(D4)는 감싸지 않는다 → 상세 notFound() 는 실제 404
import { ListSkeleton } from '@/shared/ui/states';

export default function Loading() {
  return (
    <main data-screen-id="PM-09" aria-busy="true" className="flex min-w-0 flex-col gap-6">
      <ListSkeleton variant="list" rows={5} />
    </main>
  );
}
