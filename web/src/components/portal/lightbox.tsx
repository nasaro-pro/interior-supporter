"use client";

import { useState, type ReactNode } from "react";
import { FileImage } from "@/components/portal/file-image";

export function Lightbox({
  objectId,
  alt,
  children,
}: {
  objectId: string;
  alt: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="block w-full text-left" onClick={() => setOpen(true)}>
        {children}
      </button>
      {open ? (
        <div
          className="scrim fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <FileImage objectId={objectId} alt={alt} variant="full" className="max-h-full w-auto object-contain" />
        </div>
      ) : null}
    </>
  );
}
