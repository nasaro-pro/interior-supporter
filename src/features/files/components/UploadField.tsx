'use client';
// 업로드 필드 묶음 (B 로컬 어댑터) — 라벨 · UploadQueue · 선택된 파일 이름 · 필드 오류(role=alert)
// 표준 FormField 는 자식 컨트롤 하나에 id·aria 를 주입하는데, 업로드 큐는 여러 컨트롤의 묶음이라
// <label htmlFor> 대신 group + aria-labelledby/aria-describedby 로 연결한다. group 역할은 aria-invalid 를 지원하지 않으므로 오류는 role=alert 문구 + describedby 로 전달 (P3 보고: 표준에 "그룹 필드" 없음)
import { useId, type ReactNode } from 'react';

export function UploadField({
  label,
  required,
  hint,
  error,
  fileName,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  /** 이미 번역된 오류 문구 */
  error?: string;
  /** 올라간 파일 이름 */
  fileName?: string | null;
  /** <UploadQueue …/> */
  children: ReactNode;
}) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      aria-describedby={describedBy || undefined}
      className="flex flex-col gap-1.5"
    >
      <span id={`${id}-label`} className="text-sm font-medium">
        {label}
        {required ? (
          <span aria-hidden className="text-destructive ms-0.5">
            *
          </span>
        ) : null}
      </span>
      {children}
      {fileName ? <p className="text-meta text-muted-foreground truncate">{fileName}</p> : null}
      {hint ? (
        <p id={`${id}-hint`} className="text-meta text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-meta text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
