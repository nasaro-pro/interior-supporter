"use client";

import { useState } from "react";
import { messages } from "@/lib/messages";

type Props = {
  companySlug: string;
  projectId?: string;
  category: "design" | "photo" | "material" | "brand";
  name?: string;
  accept?: string;
  multiple?: boolean;
};

export function Uploader({
  companySlug,
  projectId,
  category,
  name = "objectId",
  accept = "image/jpeg,image/png,image/webp,application/pdf,.skp,.dwg",
  multiple = false,
}: Props) {
  const [ids, setIds] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const next: string[] = multiple ? [...ids] : [];
    for (const file of Array.from(files)) {
      const lower = file.name.toLowerCase();
      const contentType =
        file.type && file.type !== "application/octet-stream"
          ? file.type
          : lower.endsWith(".skp")
            ? "application/x-sketchup"
            : lower.endsWith(".dwg")
              ? "application/x-dwg"
              : file.type;
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug,
          projectId,
          filename: file.name,
          contentType,
          contentLength: file.size,
          category,
        }),
      });
      const signed = (await signRes.json()) as {
        objectId?: string;
        url?: string;
        headers?: Record<string, string>;
        message?: string;
      };
      if (!signRes.ok || !signed.objectId || !signed.url) {
        setError(signed.message ?? messages.internalError);
        return;
      }
      // 로컬 스토리지 경로는 우리 앱의 내부 라우트라 세션 쿠키와 업체 슬러그가 필요하다.
      // R2 presigned PUT 은 교차 출처다 — withCredentials 나 커스텀 헤더를 붙이면
      // CORS preflight 에서 막힌다. 서명에 포함된 헤더만 보낸다 (10.1).
      const isLocalUpload = signed.url!.startsWith("/api/uploads/local/");
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signed.url!);
        if (isLocalUpload) {
          xhr.withCredentials = true;
          xhr.setRequestHeader("x-company-slug", companySlug);
        }
        for (const [key, value] of Object.entries(signed.headers ?? {})) {
          xhr.setRequestHeader(key, value);
        }
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300 ? resolve() : reject();
        xhr.onerror = () => reject();
        xhr.send(file);
      });
      const done = await fetch("/api/uploads/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectId: signed.objectId, companySlug }),
      });
      const payload = (await done.json()) as { objectId?: string; message?: string };
      if (!done.ok) {
        setError(payload.message ?? messages.fileRejected);
        return;
      }
      next.push(payload.objectId ?? signed.objectId);
    }
    setIds(multiple ? next : next.slice(-1));
    setProgress(100);
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <label className="cursor-pointer border border-dashed border-[var(--gold)] bg-[var(--paper)] px-3 py-6 text-center">
        {messages.uploadDrop}
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => void uploadFiles(e.target.files)}
        />
      </label>
      {progress > 0 ? <p>{progress}%</p> : null}
      {error ? <p className="text-destructive">{error}</p> : null}
      {ids.map((id) => (
        <input key={id} type="hidden" name={multiple ? "objectIds" : name} value={id} />
      ))}
    </div>
  );
}
