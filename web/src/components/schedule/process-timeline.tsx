import { formatSeoul } from "@/lib/datetime";
import { processLabels } from "@/lib/messages";

export function ProcessTimeline({
  items,
}: {
  items: Array<{
    id: string;
    title: string;
    startAt: Date;
    endAt: Date | null;
    processCategory: string | null;
    type: string;
  }>;
}) {
  const processRows = items.filter((row) => row.type === "process");
  if (processRows.length === 0) return null;
  const starts = processRows.map((row) => row.startAt.getTime());
  const ends = processRows.map((row) => (row.endAt ?? row.startAt).getTime());
  const min = Math.min(...starts);
  const max = Math.max(...ends, min + 86_400_000);
  const span = Math.max(max - min, 1);
  return (
    <div className="flex flex-col gap-3 border border-[var(--sand)] bg-[var(--paper)] p-4">
      {processRows.map((row) => {
        const left = ((row.startAt.getTime() - min) / span) * 100;
        const width = Math.max(
          (((row.endAt ?? row.startAt).getTime() - row.startAt.getTime()) / span) * 100,
          4,
        );
        return (
          <div key={row.id} className="grid grid-cols-[8rem_1fr] items-center gap-3">
            <p className="truncate text-xs uppercase tracking-[0.14em]">
              {row.processCategory
                ? processLabels[row.processCategory as keyof typeof processLabels]
                : row.title}
            </p>
            <div className="relative h-8 bg-[var(--paper)]">
              <div
                className="absolute top-1 h-6 bg-[var(--gold)]"
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`${row.title} ${formatSeoul(row.startAt)}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
