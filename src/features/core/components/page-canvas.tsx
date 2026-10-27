// src/features/core/components/page-canvas.tsx (A · REQ-052, CR-A-10) — 고객 페이지 분위기(바탕색) + 페이지 이미지 + 읽기용 시트
// 실제 고객 화면(fixed: 화면 전체 뒤에 깔림)과 설정·개요 미리보기(contained: 상자 안)가 같은 컴포넌트를 쓴다.
// 이미지 위 내용은 반투명 시트에 올려 B·C 화면 구성과 상관없이 글이 읽히게 한다.
import type { ReactNode } from 'react';
import { routes } from '@/shared/contracts/routes';
import { cn } from '@/shared/lib/utils';
import { PAGE_TONE_CLASS, type PageTone } from '../page-theme';

export function PageCanvas({
  tone,
  imageFileId,
  variant,
  children,
}: {
  tone: PageTone;
  imageFileId: string | null | undefined;
  variant: 'fixed' | 'contained';
  children: ReactNode;
}) {
  const styled = tone !== 'default' || !!imageFileId;
  // 기본 분위기 + 이미지 없음 = 기존 화면과 같은 모양
  if (!styled) return <div className="flex flex-col gap-5">{children}</div>;
  const fixed = variant === 'fixed';
  return (
    <div
      className={cn(
        PAGE_TONE_CLASS[tone],
        'relative',
        !fixed && 'isolate min-h-[28rem] overflow-hidden rounded-xl border p-3 sm:p-5',
      )}
      data-ui-key="page-canvas"
      data-tone={tone}
    >
      <div
        aria-hidden
        className={cn('-z-10 bg-(--page-canvas)', fixed ? 'fixed inset-0' : 'absolute inset-0')}
      >
        {imageFileId ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${routes.file(imageFileId)})` }}
              data-ui-key="page-image"
            />
            {/* 아래로 갈수록 분위기 색으로 이어지게 — 사진이 밝거나 복잡해도 시트 경계가 자연스럽다 */}
            <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent via-40% to-(--page-canvas)" />
          </>
        ) : null}
      </div>
      <div className={cn(imageFileId && (fixed ? 'pt-[16vh] sm:pt-[22vh]' : 'pt-24 sm:pt-32'))}>
        <div className="flex flex-col gap-5 rounded-2xl bg-(--page-surface)/92 p-4 shadow-sm backdrop-blur-sm sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
