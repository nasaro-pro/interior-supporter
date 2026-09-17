import { sundayMonthCells } from "@/lib/datetime";
import { messages } from "@/lib/messages";

const WEEKDAYS = [
  messages.weekdaySun,
  messages.weekdayMon,
  messages.weekdayTue,
  messages.weekdayWed,
  messages.weekdayThu,
  messages.weekdayFri,
  messages.weekdaySat,
];

export function SundayMonthCalendar({
  monthValue,
  items,
}: {
  monthValue: string;
  items: Array<{ id: string; title: string; startAt: Date; type: string }>;
}) {
  const cells = sundayMonthCells(monthValue);
  const grouped = new Map<string, typeof items>();
  for (const item of items) {
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(item.startAt);
    const list = grouped.get(day) ?? [];
    list.push(item);
    grouped.set(day, list);
  }
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[640px] grid-cols-7 border-t border-l border-[var(--sand)]">
        {WEEKDAYS.map((label) => (
          <div key={label} className="border-b border-r border-[var(--sand)] px-2 py-2 text-xs uppercase tracking-[0.16em]">
            {label}
          </div>
        ))}
        {cells.map((cell) => (
          <div
            key={cell.date}
            className={`min-h-24 border-b border-r border-[var(--sand)] px-2 py-2 ${
              cell.inMonth ? "bg-[var(--paper)]" : "bg-[var(--void)] text-muted-foreground"
            }`}
          >
            <p className="text-xs">{cell.date.slice(8)}</p>
            <ul className="mt-1 flex flex-col gap-1">
              {(grouped.get(cell.date) ?? []).map((item) => (
                <li key={item.id} className="truncate text-xs">
                  {item.title}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
