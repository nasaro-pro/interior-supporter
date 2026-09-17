import { messages } from "@/lib/messages";

export function LoadMore({ href }: { href: string }) {
  return (
    <a className="ghost-btn w-fit" href={href}>
      {messages.loadMore}
    </a>
  );
}
