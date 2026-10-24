// 요청 스레드 — 원문 → 정정 → 답변을 서버 시각순으로 (POL-019). 순수 함수.
import type { RequestThreadEntry, RequestThreadKind } from '../types';

interface RawEntry {
  id: string;
  body: string;
  authorId: string;
  createdAt: string;
}

const KIND_ORDER: Record<RequestThreadKind, number> = { original: 0, correction: 1, reply: 2 };

export function buildRequestThread(
  original: RawEntry,
  corrections: RawEntry[],
  replies: RawEntry[],
  names: Map<string, string>,
): RequestThreadEntry[] {
  const tag =
    (kind: RequestThreadKind) =>
    (e: RawEntry): RequestThreadEntry => ({
      kind,
      id: e.id,
      body: e.body,
      authorId: e.authorId,
      authorName: names.get(e.authorId) ?? null,
      createdAt: e.createdAt,
    });
  const all = [
    tag('original')(original),
    ...corrections.map(tag('correction')),
    ...replies.map(tag('reply')),
  ];
  return all.sort((a, b) => {
    const t = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    if (t !== 0) return t;
    const k = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (k !== 0) return k;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
