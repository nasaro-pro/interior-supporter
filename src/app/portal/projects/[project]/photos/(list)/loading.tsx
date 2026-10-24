import { ListSkeleton } from '@/shared/ui/states';

export default function Loading() {
  return (
    <main data-screen-id="CL-07" aria-busy="true" className="flex flex-col gap-4">
      <ListSkeleton variant="grid" rows={8} />
    </main>
  );
}
