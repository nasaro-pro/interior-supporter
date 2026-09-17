"use client";

import { useEffect } from "react";
import Link from "next/link";
import { messages } from "@/lib/messages";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(JSON.stringify({ level: "error", event: "client.error", digest: error.digest }));
  }, [error]);

  return (
    <main className="page-wrap max-w-md">
      <p className="gold-label">{messages.errorTitle}</p>
      <h1 className="mt-3 text-4xl">{messages.errorTitle}</h1>
      <p className="mt-4 text-sm text-muted-foreground">{messages.errorHelp}</p>
      {error.digest ? (
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          {messages.errorRef}: {error.digest}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" onClick={reset} className="ghost-btn">
          {messages.retry}
        </button>
        <Link href="/" className="ghost-btn">
          {messages.goHome}
        </Link>
      </div>
    </main>
  );
}
