// src/shared/ui/styles.ts (A) — 컴포넌트로 감쌀 수 없는 곳의 표준 클래스 (토큰 클래스만). 서버·클라이언트 공용
/** 본문 속 텍스트 링크 */
export const linkClass =
  'text-primary rounded-sm underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none';

/** 넓은 표를 감싸는 가로 스크롤 영역 — 페이지 자체는 가로로 넘치지 않는다 (relative: 숨김 라벨 등 절대 위치 자식도 가둔다) */
export const tableScrollClass = 'relative w-full max-w-full min-w-0 overflow-x-auto';
