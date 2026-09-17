import { markInboxReadAction } from "@/modules/notification";
import { formatSeoul } from "@/lib/datetime";
import { messages } from "@/lib/messages";

export function InboxBell({
  items,
}: {
  items: Array<{
    id: string;
    eventType: string;
    readAt: Date | null;
    createdAt: Date;
    payload: unknown;
  }>;
}) {
  const unread = items.filter((item) => !item.readAt).length;
  return (
    <details className="relative">
      <summary className="ghost-btn">
        {messages.notificationsBell}
        {unread > 0 ? (
          <span className="ml-2 bg-[var(--gold)] px-1.5 text-xs text-[var(--paper)]">
            {unread}
          </span>
        ) : null}
      </summary>
      <ul className="inbox-panel text-sm">
        {items.length === 0 ? (
          <li className="p-2 text-muted-foreground">{messages.noItems}</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="border-b py-2 last:border-0">
              <p className={item.readAt ? "text-muted-foreground" : "font-medium"}>
                {item.eventType}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatSeoul(item.createdAt)}
              </p>
              {!item.readAt ? (
                <form action={markInboxReadAction.bind(null, item.id)}>
                  <button type="submit" className="ghost-btn-sm">
                    {messages.markRead}
                  </button>
                </form>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </details>
  );
}
