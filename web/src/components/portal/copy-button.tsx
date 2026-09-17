"use client";

import { useState } from "react";
import { messages } from "@/lib/messages";

export function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="ghost-btn-sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setDone(true);
      }}
    >
      {done ? messages.copyDone : messages.accessCopyLink}
    </button>
  );
}
