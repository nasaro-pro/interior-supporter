'use client';
// src/shared/ui/no-drag.tsx — 사이트 전체 드래그 금지 (2026-11)
// 글자 선택은 globals.css 의 user-select 로 막고, 여기서는 이미지·링크·글자를 끌어 옮기는 동작(dragstart)을 막는다.
// 입력칸 · 글 쓰는 칸 · data-allow-drag 안은 예외. 파일을 끌어다 놓는 업로드(drop)는 dragstart 가 없어서 영향 없다.
import { useEffect } from 'react';

export const DRAG_ALLOWED = 'input, textarea, select, [contenteditable="true"], [data-allow-drag]';

export function NoDrag() {
  useEffect(() => {
    const block = (e: DragEvent) => {
      const target = e.target;
      if (target instanceof Element && target.closest(DRAG_ALLOWED)) return;
      e.preventDefault();
    };
    document.addEventListener('dragstart', block, true);
    return () => document.removeEventListener('dragstart', block, true);
  }, []);
  return null;
}
