// 화면용 타입 (camelCase)

export interface EstimateListItem {
  id: string;
  title: string;
  updatedAt: string;
  archivedAt: string | null;
  /** 호출자가 볼 수 있는 버전 수 (고객 = 공개 버전 수) */
  versionCount: number;
  hasPublic: boolean;
  latest: { versionNo: number; versionLabel: string; isPublic: boolean; createdAt: string } | null;
}

export interface EstimateVersionItem {
  id: string;
  versionNo: number;
  versionLabel: string;
  changeNote: string;
  isPublic: boolean;
  publishedAt: string | null;
  createdAt: string;
  fileId: string;
  fileName: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  /** 낙관적 잠금용 행 버전 */
  version: number;
}

export interface EstimateDetail {
  id: string;
  title: string;
  archivedAt: string | null;
  /** 견적 묶음의 낙관적 잠금용 행 버전 (보관·복원) */
  version: number;
  versions: EstimateVersionItem[];
  /** ?v=N 으로 고른 버전 (없으면 최신) */
  selected: EstimateVersionItem | null;
}
