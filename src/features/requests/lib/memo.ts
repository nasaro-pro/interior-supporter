// D-32 · D-33 메모 도우미 (순수 함수)
import { REQUEST_LIMITS } from '../schema';

/** 고객은 제목을 쓰지 않는다 — 본문 첫 줄 앞부분으로 제목을 만든다 (DB 는 제목 필수) */
export const AUTO_TITLE_LENGTH = 40;
export function autoTitle(body: string): string {
  const first =
    body
      .trim()
      .split(/\r?\n/)
      .find((l) => l.trim()) ?? '';
  const flat = first.replace(/\s+/g, ' ').trim();
  const chars = Array.from(flat);
  const short =
    chars.length > AUTO_TITLE_LENGTH ? `${chars.slice(0, AUTO_TITLE_LENGTH).join('')}…` : flat;
  return Array.from(short).slice(0, REQUEST_LIMITS.title).join('') || '메모';
}

export interface UnansweredSource {
  created_at: string;
  request_replies: { created_at: string }[];
  request_corrections: { created_at: string }[];
}

/**
 * D-31 미답변: 고객이 마지막으로 쓴 글(원문 · 정정)보다 새 답변이 없다
 * (답변 뒤에 고객이 다시 정정하면 다시 미답변)
 */
export function isUnanswered(r: UnansweredSource): boolean {
  const lastCustomer = [r.created_at, ...r.request_corrections.map((c) => c.created_at)].reduce(
    (a, b) => (b > a ? b : a),
  );
  return !r.request_replies.some((x) => x.created_at >= lastCustomer);
}
