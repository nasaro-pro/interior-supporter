"use client";

import { useState } from "react";
import { CopyButton } from "@/components/portal/copy-button";
import { messages } from "@/lib/messages";

export function InvitePanel({
  action,
}: {
  action: () => Promise<{ url: string }>;
}) {
  const [url, setUrl] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="ink-btn"
        onClick={async () => {
          const result = await action();
          setUrl(result.url);
        }}
      >
        {messages.accessInvite}
      </button>
      {url ? (
        <>
          <code className="max-w-full break-all text-xs">{url}</code>
          <CopyButton value={url} />
        </>
      ) : null}
    </div>
  );
}
