import Link from "next/link";
import { messages } from "@/lib/messages";

export default function UnauthorizedPage() {
  return (
    <main className="page-wrap max-w-md">
      <p className="gold-label">{messages.unauthorized}</p>
      <h1 className="mt-3 text-4xl">{messages.unauthorized}</h1>
      <Link href="/login" className="ghost-btn mt-6 w-fit">
        {messages.loginTitle}
      </Link>
    </main>
  );
}
