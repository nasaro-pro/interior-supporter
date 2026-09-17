"use client";

import { useState } from "react";
import { messages } from "@/lib/messages";

export function LinkPreviewField({ projectId }: { projectId: string }) {
  const [message, setMessage] = useState<string | null>(null);

  async function preview(url: string) {
    if (!url) return;
    const res = await fetch("/api/link-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, projectId }),
    });
    const data = (await res.json()) as { title?: string; domain?: string; message?: string };
    setMessage(res.ok ? (data.title ?? data.domain ?? "") : (data.message ?? messages.linkPreviewDenied));
  }

  return (
    <label className="flex flex-col gap-1 text-sm">
      {messages.externalUrlLabel}
      <input
        name="externalUrl"
        type="url"
        className="h-9 rounded-md border border-input px-3"
        onBlur={(e) => void preview(e.target.value)}
      />
      {message ? <span>{message}</span> : null}
    </label>
  );
}
