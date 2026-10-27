// src/features/admin/lib/bytes.ts — 저장 용량 단위 변환·표시 (사이트 설정 A6 · 업체 용량 A4·A7)
const MB = 1024 * 1024;
const GB = 1024 * MB;

/** 화면 입력(MB) → DB 값(바이트). 소수는 버린다 */
export function mbToBytes(mb: number): number {
  return Math.floor(mb * MB);
}

/** DB 값(바이트) → 화면 입력(MB). 소수 첫째 자리까지 */
export function bytesToMb(bytes: number): number {
  return Math.round((bytes / MB) * 10) / 10;
}

/** 화면 입력(GB) → 바이트. 빈 값은 null(= 사이트 기본값 또는 무제한) */
export function gbToBytes(gb: number | null): number | null {
  return gb === null ? null : Math.floor(gb * GB);
}

export function bytesToGb(bytes: number | null): number | null {
  return bytes === null ? null : Math.round((bytes / GB) * 10) / 10;
}

/** 사람이 읽는 용량 (1.5 GB · 320 MB · 12 KB) */
export function formatBytes(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** 사용량 / 한도 비율 (0~100). 한도가 없으면 null */
export function usagePercent(used: number, quota: number | null): number | null {
  if (!quota) return null;
  return Math.min(100, Math.round((used / quota) * 100));
}
