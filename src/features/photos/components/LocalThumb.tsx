'use client';
/** D-24: 고른 사진을 올리기 전에 바로 보여 준다 (브라우저 메모리 URL — 서버로 보내지 않음, 행이 사라지면 해제) */
export function LocalThumb({ file, alt }: { file: File | undefined; alt: string }) {
  return (
    <span className="bg-muted size-12 shrink-0 overflow-hidden rounded-md border">
      {file && typeof URL.createObjectURL === 'function' ? (
        // eslint-disable-next-line @next/next/no-img-element -- 로컬 미리보기(blob: URL)
        <img
          // React 19 ref 정리 함수: 붙을 때 URL 을 만들고 떨어질 때 해제
          ref={(el) => {
            if (!el) return;
            const u = URL.createObjectURL(file);
            el.src = u;
            return () => URL.revokeObjectURL(u);
          }}
          alt={alt}
          className="size-full object-cover"
          data-ui-key="photo-upload-thumb"
        />
      ) : null}
    </span>
  );
}
