// 사진 표시 이름 (C-11) — 사진에는 제목이 없다. 개요 요약·알림 대상·일정 관련 항목이 모두 이 규칙을 쓴다
// 설명(사용자 입력) → 촬영일(KST 달력 값) → 등록일(KST) → id 앞 8자. 빈 제목은 만들지 않는다
import { toKstDate } from '@/shared/lib/dates';

export type PhotoLabelSource = {
  id: string;
  description?: string | null;
  captured_on?: string | null;
  created_at?: string | null;
};

export function photoLabel(p: PhotoLabelSource): string {
  const description = p.description?.trim();
  if (description) return description;
  if (p.captured_on) return p.captured_on;
  if (p.created_at) return toKstDate(p.created_at);
  return p.id.slice(0, 8);
}
