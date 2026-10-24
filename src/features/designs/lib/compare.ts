// A/B 비교 슬라이더 순수 로직 (REQ-105, 02 문서 6.1) — 컴포넌트 테스트 대상
// 위치 pos = A 가 보이는 비율(%). 0 = B 전체, 50 = 절반, 100 = A 전체

export const DEFAULT_POSITION = 50;

export function clampPosition(pos: number): number {
  if (!Number.isFinite(pos)) return DEFAULT_POSITION;
  return Math.min(100, Math.max(0, Math.round(pos * 10) / 10));
}

/** 키보드: ←→ 1%, Shift+←→ 10%, Home 0%, End 100%. 처리하지 않는 키는 null */
export function positionForKey(pos: number, key: string, shift: boolean): number | null {
  const step = shift ? 10 : 1;
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      return clampPosition(pos - step);
    case 'ArrowRight':
    case 'ArrowUp':
      return clampPosition(pos + step);
    case 'Home':
      return 0;
    case 'End':
      return 100;
    default:
      return null;
  }
}

/** 포인터 x 좌표 → 위치(%) — 비교 영역 기준 */
export function positionFromPointer(clientX: number, left: number, width: number): number {
  if (width <= 0) return DEFAULT_POSITION;
  return clampPosition(((clientX - left) / width) * 100);
}

/** A 레이어 clip-path: 왼쪽 pos% 만 보인다 */
export function clipForPosition(pos: number): string {
  return `inset(0 ${100 - clampPosition(pos)}% 0 0)`;
}

export type CompareDisabledReason = 'needTwo' | 'unselected' | 'loadFailed' | 'denied';

/** 비활성 사유 4종 (우선순위: 후보 부족 → 미선택 → 접근 불가 → 로딩 실패) */
export function compareDisabledReason(input: {
  candidateCount: number;
  a: string | null;
  b: string | null;
  denied: boolean;
  loadFailed: boolean;
}): CompareDisabledReason | null {
  if (input.candidateCount < 2) return 'needTwo';
  if (!input.a || !input.b || input.a === input.b) return 'unselected';
  if (input.denied) return 'denied';
  if (input.loadFailed) return 'loadFailed';
  return null;
}
