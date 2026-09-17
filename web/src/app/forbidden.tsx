import { messages } from "@/lib/messages";

export default function ForbiddenPage() {
  return (
    <main className="page-wrap max-w-md">
      <p className="gold-label">{messages.forbidden}</p>
      <h1 className="mt-3 text-4xl">{messages.forbidden}</h1>
    </main>
  );
}
