// 포트폴리오 관리 탭(PM-65) 순수 로직 — 대표 지정 가능 여부, 순서 바꾸기, 사례 추가 계획 (컴포넌트 테스트 대상)
import type { PortfolioSpace } from '../schema';

export interface ManageWork {
  id: string;
  version: number;
  /** 원본 프로젝트 (화면에 보이지 않음 — '사례 올리기' 단계가 고칠 수 있는지 판단용) */
  projectId: string | null;
  /** 지금 사람이 이 사례를 고칠 수 있나 (lib/access canEditWork, 서버가 채움) */
  editable: boolean;
  title: string;
  areaLabel: string;
  sizePyeong: number | null;
  durationWeeks: number | null;
  completedOn: string | null;
  status: 'draft' | 'published';
  hasConsent: boolean;
  isFeatured: boolean;
  coverThumbPath: string | null;
  photoCount: number;
  sortOrder: number;
}

/** 대표 몇 개가 지정돼 있나 / 더 지정할 수 있나 */
export function featuredState(works: ManageWork[], limit: number) {
  const count = works.filter((w) => w.isFeatured).length;
  return { count, limit, full: count >= limit, over: count > limit };
}

/** 이 사례의 별(★)을 누를 수 있나 — 해제는 언제나, 지정은 자리가 있고 대표 사진이 있을 때 */
export function canToggleFeatured(w: ManageWork, works: ManageWork[], limit: number) {
  if (w.isFeatured) return true;
  return !!w.coverThumbPath && !featuredState(works, limit).full;
}

/** 위·아래로 한 칸 옮긴 뒤 전체 순서 (sort_order 를 0..n-1 로 다시 매김) */
export function moveWork(works: ManageWork[], id: string, delta: -1 | 1) {
  const list = [...works];
  const i = list.findIndex((w) => w.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return null;
  [list[i], list[j]] = [list[j]!, list[i]!];
  return list.map((w, k) => ({ id: w.id, baseVersion: w.version, sortOrder: k }));
}

export interface PickedImage {
  sourceFileId: string;
  space: PortfolioSpace | null;
  spaceLabel: string;
  role: 'gallery' | 'before' | 'after';
}

/** 비포·애프터는 한 장씩만 — 새로 정하면 이전 것은 일반으로 */
export function setRole(
  picks: PickedImage[],
  fileId: string,
  role: PickedImage['role'],
): PickedImage[] {
  return picks.map((p) => {
    if (p.sourceFileId === fileId) return { ...p, role };
    if (role !== 'gallery' && p.role === role) return { ...p, role: 'gallery' };
    return p;
  });
}

/** 대표 사진 고르기 — 애프터 → 첫 일반 사진 (비포만 있으면 없음) */
export function chooseCover(added: { imageId: string; role: PickedImage['role'] }[]) {
  return (
    (added.find((a) => a.role === 'after') ?? added.find((a) => a.role === 'gallery') ?? null)
      ?.imageId ?? null
  );
}

/** 수정 화면 기본 정보 — 바뀐 칸만 보낸다 (낙관적 잠금 충돌을 줄이고 기록을 깔끔하게) */
export interface WorkFields {
  title: string;
  areaLabel: string;
  sizePyeong: number | null;
  durationWeeks: number | null;
  completedOn: string | null;
  spaces: string[];
  summary: string;
}
export function workPatch(before: WorkFields, after: WorkFields): Partial<WorkFields> {
  const out: Partial<WorkFields> = {};
  (Object.keys(after) as (keyof WorkFields)[]).forEach((k) => {
    const a = before[k];
    const b = after[k];
    const same =
      Array.isArray(a) && Array.isArray(b)
        ? [...a].sort().join() === [...b].sort().join()
        : a === b;
    if (!same) (out as Record<string, unknown>)[k] = b;
  });
  return out;
}

/** 입력칸 문자열 → 숫자 (비우면 null, 숫자가 아니면 NaN 을 그대로 두어 검증에서 걸리게) */
export function numOrNull(v: string): number | null {
  const s = v.trim();
  return s === '' ? null : Number(s);
}
