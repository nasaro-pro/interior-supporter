"use client";

import { useRef, useState } from "react";
import { FileImage } from "@/components/portal/file-image";

export function BeforeAfterSlider({
  beforeId,
  afterId,
  caption,
}: {
  beforeId: string;
  afterId: string;
  caption?: string;
}) {
  const [pos, setPos] = useState(50);
  const track = useRef<HTMLDivElement | null>(null);

  function move(clientX: number) {
    const box = track.current?.getBoundingClientRect();
    if (!box) return;
    const next = Math.min(100, Math.max(0, ((clientX - box.left) / box.width) * 100));
    setPos(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={track}
        className="relative h-64 w-full overflow-hidden bg-[var(--sand)]"
        onPointerDown={(event) => {
          (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
          move(event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.buttons === 1) move(event.clientX);
        }}
      >
        <FileImage objectId={afterId} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
          <FileImage objectId={beforeId} alt="" className="h-full w-[100vw] max-w-none object-cover" />
        </div>
        <div
          className="absolute bottom-0 top-0 w-px bg-[var(--paper)]"
          style={{ left: `${pos}%` }}
        />
      </div>
      {caption ? <p className="text-sm text-muted-foreground">{caption}</p> : null}
    </div>
  );
}
