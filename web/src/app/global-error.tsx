"use client";

import { messages } from "@/lib/messages";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, background: "#f3eadc", color: "#2c1d14" }}>
        <main style={{ margin: "0 auto", maxWidth: 480, padding: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 600 }}>{messages.errorTitle}</h1>
          <p style={{ fontSize: 14, opacity: 0.75 }}>{messages.errorHelp}</p>
          {error.digest ? (
            <p style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.6 }}>
              {messages.errorRef}: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              minHeight: 44,
              padding: "0 16px",
              border: "1px solid #8f5a32",
              background: "transparent",
              color: "#2c1d14",
            }}
          >
            {messages.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
