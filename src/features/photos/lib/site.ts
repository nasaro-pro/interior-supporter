// 시공팀 현장 선택 (02 문서 6.3) — 0개 안내 / 1개 자동 선택 / 여러 개 선택 요구. 순수 함수.
export interface FieldSite {
  projectId: string;
  name: string;
  siteAddress: string;
}

export type SitePick =
  | { kind: 'none' }
  | { kind: 'choose' }
  | { kind: 'selected'; site: FieldSite }
  | { kind: 'denied' };

export function pickSite(sites: FieldSite[], requested: string | null): SitePick {
  if (sites.length === 0) return { kind: 'none' };
  if (requested) {
    const site = sites.find((s) => s.projectId === requested);
    return site ? { kind: 'selected', site } : { kind: 'denied' };
  }
  if (sites.length === 1) return { kind: 'selected', site: sites[0]! };
  return { kind: 'choose' };
}
