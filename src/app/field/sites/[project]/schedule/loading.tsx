import { ListSkeleton } from '@/shared/ui/states';

export default function Loading() {
  return (
    <main data-screen-id="FW-04" aria-busy="true" className="flex flex-col gap-4">
      <ListSkeleton variant="list" rows={5} />
    </main>
  );
}
