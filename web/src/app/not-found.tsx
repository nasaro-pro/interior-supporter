import Link from "next/link";
import { messages } from "@/lib/messages";

export default function NotFound() {
  return (
    <main className="page-wrap max-w-md">
      <p className="gold-label">{messages.notFoundTitle}</p>
      <h1 className="mt-3 text-4xl">{messages.notFoundTitle}</h1>
      <p className="mt-4 text-sm text-muted-foreground">{messages.notFoundHelp}</p>
      <Link href="/" className="ghost-btn mt-6 w-fit">
        {messages.goHome}
      </Link>
    </main>
  );
}
