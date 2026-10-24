/**
 * 담당자 간 연동 계약 — A·B·C 가 합칠 때 맞물리는 지점 전부를 여기서 정의한다.
 * 소유: A · 스타터 고정 파일. 변경 요청은 진행 기록(progress/<담당>.md)의 변경 요청(CR) (docs/00_헌법_공통규칙.md 5.9).
 * 근거: 01_A 세부문서 6장(AccessContext, ProjectShell, SummaryItem, AuditEvent/NotificationEvent, DecisionAuthority)
 */
import type { ActionResult } from './errors';
import type { FileKind, MemberRole, ParticipantRole } from './domain';
import type { ScreenId } from './screens';

/* ────────────────────────────────────────────────────────────────
 * 1. AccessContext (A 제공) — 모든 서버 코드의 첫 줄
 *    구현: src/features/core/server/access.ts
 * ──────────────────────────────────────────────────────────────── */
export interface AccessContext {
  userId: string;
  displayName: string;
  locale: 'ko' | 'en';
  /** 스태프 소속 업체 (slug → 역할) */
  memberships: { companyId: string; slug: string; name: string; role: MemberRole }[];
  /** 유효한 프로젝트 참여 */
  participations: {
    projectId: string;
    companyId: string;
    role: ParticipantRole;
    canConfirm: boolean;
  }[];
  /** 선택 가능한 영역 */
  areas: ('app' | 'portal' | 'field')[];
}

export interface ProjectAccess {
  projectId: string;
  companyId: string;
  companySlug: string;
  /** 'editor' = PM 편집권(owner/manager/pm 참여자), 'customer', 'field' */
  as: 'editor' | 'customer' | 'field';
  canConfirm: boolean;
}

/**
 * A 가 구현하는 서버 함수 시그니처 (B·C 는 import 만 한다)
 *  - getAccessContext(): 미로그인 → redirect(routes.login(next))
 *  - requireProjectAccess(projectId, allowed): 권한 없거나 없는 프로젝트 → notFound() (존재 숨김)
 *  - requireCompanyStaff(slug): 소속 아니면 notFound()
 * 주의: 이 검사는 UX·조기 차단용이다. 실제 데이터 보호는 RLS(DB)가 한다. 두 가지를 모두 거친다.
 */
export interface AccessApi {
  getAccessContext(): Promise<AccessContext>;
  requireProjectAccess(projectId: string, allowed: ProjectAccess['as'][]): Promise<ProjectAccess>;
  requireCompanyStaff(companySlug: string): Promise<{ companyId: string; role: MemberRole }>;
}

/* ────────────────────────────────────────────────────────────────
 * 2. ProjectShell (A 제공) — 프로젝트 공통 헤더·탭·전환
 *    구현: src/app/app/[company]/projects/[project]/layout.tsx, src/app/portal/projects/[project]/layout.tsx
 *    B·C 는 탭 페이지(page.tsx)만 만든다. layout 을 수정하지 않는다.
 * ──────────────────────────────────────────────────────────────── */
export interface ProjectHeaderData {
  id: string;
  name: string;
  siteAddress: string;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;
  status: 'planned' | 'active' | 'on_hold' | 'completed';
  currentPhase: string;
}

/* ────────────────────────────────────────────────────────────────
 * 3. SummaryItem (B·C 제공 → A 의 개요 PM-03 / 고객 홈 CL-03 이 표시)
 *    B 구현: src/features/designs|materials|estimates/server/summary.ts
 *    C 구현: src/features/requests|photos|schedule/server/summary.ts
 *    호출자 권한(RLS)으로 조회하므로 고객 호출 시 공개 항목만 돌아온다. 별도 필터를 또 만들지 않는다.
 * ──────────────────────────────────────────────────────────────── */
export interface SummaryItem {
  kind: 'designs' | 'materials' | 'estimate_versions' | 'requests' | 'photos' | 'schedule_events';
  id: string;
  /** 사용자 입력 원문 (번역하지 않음) */
  title: string;
  /** 정렬 기준 시각 ISO (일정은 시작 시각) */
  at: string;
  /** 보조 문구 i18n 키 + 값 (예: 'summary.newVersion', { no: 2 }) */
  subtitleKey?: string;
  subtitleValues?: Record<string, string | number>;
  screenId: ScreenId;
  /** routes.ts 로 만든 정규 경로 */
  href: string;
  thumbnailFileId?: string;
}

export interface SummaryProvider {
  /** 최근 갱신 항목 (최신순, limit 기본 5) */
  recent(projectId: string, viewer: ProjectAccess, limit?: number): Promise<SummaryItem[]>;
}
/** C 전용: 다음 일정 (오늘 KST 이후 가장 이른 공개/허용 일정) */
export interface NextScheduleProvider {
  next(projectId: string, viewer: ProjectAccess, limit?: number): Promise<SummaryItem[]>;
}
/** 문서 영역(고객 홈 documents 섹션): B 가 제공 — 공개 도안 현재 버전·공개 견적 최신 버전 */
export interface DocumentsProvider {
  documents(projectId: string, viewer: ProjectAccess): Promise<SummaryItem[]>;
}

/* ────────────────────────────────────────────────────────────────
 * 4. 알림 대상 해석 (B·C 제공 → A 의 알림 목록이 링크를 만들 때 사용)
 *    알림 행에는 object_type/object_id 만 있다. 제목은 현재 권한으로 다시 조회한다 (A-T07: 유출 방지).
 *    구현 위치: 각 feature 의 server/notification-target.ts, A 의 registry 에 등록
 * ──────────────────────────────────────────────────────────────── */
export interface NotificationTarget {
  title: string;
  href: string;
  screenId: ScreenId;
}
export type NotificationTargetResolver = (
  objectId: string,
  projectId: string,
  area: 'app' | 'portal' | 'field',
  companySlug: string,
) => Promise<NotificationTarget | null>; // null = 더 이상 볼 수 없음 → "볼 수 없는 항목" 표시

/** object_type → 해석기 소유자 (A 가 등록 테이블을 base 에 미리 만들어 둔다) */
export const NOTIFICATION_TARGET_OWNERS = {
  project_participants: 'A',
  designs: 'B',
  materials: 'B',
  estimate_versions: 'B',
  requests: 'C',
  photos: 'C',
  schedule_events: 'C',
} as const;

/* ────────────────────────────────────────────────────────────────
 * 5. 파일 업로드 파이프라인 (B 제공 — 기준서 D02 공통 파일 어댑터, A·C 사용) — docs/03_아키텍처_데이터_보안.md 5장
 *    구현: src/features/files/*
 * ──────────────────────────────────────────────────────────────── */
export interface UploadIntentInput {
  kind: Exclude<FileKind, 'photo_thumb'>;
  projectId: string | null; // company_logo 만 null
  companyId: string;
  fileName: string;
  sizeBytes: number;
  mime: string;
}
export interface UploadIntent {
  fileId: string;
  bucket: 'project-files';
  path: string;
  /** supabase.storage.from(bucket).uploadToSignedUrl(path, token, file) 에 사용. 2시간 유효 */
  token: string;
}
export interface FinalizedFile {
  fileId: string;
  status: 'ready' | 'rejected';
  rejectReason?: 'type' | 'size' | 'corrupt' | 'pixels';
  width?: number;
  height?: number;
  thumbFileId?: string; // photo_original 만
  /** photo_original: EXIF 촬영일 (YYYY-MM-DD, KST). 원본에서는 메타데이터 제거됨 (POL-022) */
  capturedOn?: string;
}
export interface FilesApi {
  /** Server Action. 권한·규격 1차 검사 후 files 행(pending) 생성 + 서명 업로드 URL 발급 */
  createUploadIntent(input: UploadIntentInput): Promise<ActionResult<UploadIntent>>;
  /** Server Action. 업로드 완료 후 호출. 실제 바이트 검사(형식 헤더·크기·디코딩) → ready/rejected */
  finalizeUpload(fileId: string): Promise<ActionResult<FinalizedFile>>;
}

/* ────────────────────────────────────────────────────────────────
 * 6. DecisionAuthority (A 정책 + B 실행) — 확정 가능 여부
 *    DB 함수 private.can_confirm_on(project) 가 원본. 화면은 ProjectAccess.canConfirm 으로 버튼 표시 여부만 결정.
 *    확정 실행은 B 의 RPC confirm_target 이 매번 재검사한다.
 * ──────────────────────────────────────────────────────────────── */
