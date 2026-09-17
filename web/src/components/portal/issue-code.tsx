"use client";

import { useState } from "react";
import { CopyButton } from "@/components/portal/copy-button";
import { messages } from "@/lib/messages";

export function IssueCodePanel({
  action,
}: {
  action: () => Promise<{ code: string }>;
}) {
  const [code, setCode] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="ghost-btn"
        onClick={async () => {
          const result = await action();
          setCode(result.code);
        }}
      >
        {messages.issueCode}
      </button>
      {code ? (
        <div className="rounded-md border bg-muted p-3 text-sm">
          <p className="font-mono text-lg tracking-widest">{code}</p>
          <p className="mt-1 text-muted-foreground">{messages.issueCodeOnce}</p>
          <CopyButton value={code} />
        </div>
      ) : null}
    </div>
  );
}
