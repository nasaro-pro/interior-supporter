/**
 * 도메인 열거형·정책 상수 — DB 열거형(supabase/migrations)의 TS 사본 + POL 수치
 * 소유: A · DB 와 다르면 DB 가 원본이다 (TC-908 이 일치 여부를 검사)
 * 생성 타입: src/shared/contracts/database.types.ts (`npm run db:types` 로 생성, 직접 수정 금지)
 */

export const MEMBER_ROLES = ['owner', 'manager', 'pm'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const PARTICIPANT_ROLES = ['pm', 'customer', 'field'] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export const PROJECT_STATUSES = ['planned', 'active', 'on_hold', 'completed'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const CONFIRM_STATES = ['none', 'confirmed', 'needs_reconfirm'] as const;
export type ConfirmState = (typeof CONFIRM_STATES)[number];

export const REQUEST_STATUSES = ['open', 'in_progress', 'resolved'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
/** POL-018: 허용 전환 (편집자만). resolved → in_progress 재개 허용 */
export const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  open: ['in_progress', 'resolved'],
  in_progress: ['resolved', 'open'],
  resolved: ['in_progress'],
};

export const MATERIAL_SPACES = [
  'living',
  'kitchen',
  'bathroom',
  'bedroom',
  'entrance',
  'balcony',
  'utility',
  'common',
  'other',
] as const;
export type MaterialSpace = (typeof MATERIAL_SPACES)[number];

export const PHOTO_PHASES = [
  'demolition',
  'plumbing',
  'electrical',
  'carpentry',
  'tile',
  'paint',
  'film',
  'wallpaper',
  'flooring',
  'furniture',
  'lighting',
  'finishing',
  'other',
] as const;
export type PhotoPhase = (typeof PHOTO_PHASES)[number];

export const HOME_SECTION_KEYS = ['overview', 'recent', 'schedule', 'documents'] as const;
export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];
export type HomeSections = { key: HomeSectionKey; visible: boolean }[];

export const FILE_KINDS = [
  'design_original',
  'design_preview',
  'material_image',
  'estimate_pdf',
  'photo_original',
  'photo_thumb',
  'company_logo',
] as const;
export type FileKind = (typeof FILE_KINDS)[number];

/** POL-021 파일 규격 (서버·클라이언트 동일 값 사용) */
export const FILE_RULES: Record<
  Exclude<FileKind, 'photo_thumb'>,
  { exts: string[]; mimes: string[]; maxBytes: number }
> = {
  // D-20: 인테리어 업계 도안 형식 (2D 도면·3D 모델링·렌더 이미지·디자인 문서). 무료 요금제 기준 50MB
  design_original: {
    exts: [
      '.dwg',
      '.dxf',
      '.skp',
      '.3ds',
      '.max',
      '.obj',
      '.fbx',
      '.3dm',
      '.rvt',
      '.jpg',
      '.jpeg',
      '.png',
      '.webp',
      '.tif',
      '.tiff',
      '.heic',
      '.heif',
      '.pdf',
      '.ai',
      '.psd',
    ],
    mimes: [
      'application/octet-stream',
      'application/pdf',
      'application/postscript',
      'image/vnd.dwg',
      'image/vnd.dxf',
      'application/acad',
      'application/x-dwg',
      'application/vnd.sketchup.skp',
      'application/x-3ds',
      'model/obj',
      'model/vnd.3dm',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/tiff',
      'image/heic',
      'image/heif',
      'image/vnd.adobe.photoshop',
    ],
    maxBytes: 50 * 1024 * 1024,
  },
  design_preview: {
    exts: ['.png', '.jpg', '.jpeg', '.webp'],
    mimes: ['image/png', 'image/jpeg', 'image/webp'],
    maxBytes: 20 * 1024 * 1024,
  },
  material_image: {
    exts: ['.png', '.jpg', '.jpeg', '.webp'],
    mimes: ['image/png', 'image/jpeg', 'image/webp'],
    maxBytes: 20 * 1024 * 1024,
  },
  estimate_pdf: { exts: ['.pdf'], mimes: ['application/pdf'], maxBytes: 20 * 1024 * 1024 },
  photo_original: {
    exts: ['.png', '.jpg', '.jpeg', '.webp'],
    mimes: ['image/png', 'image/jpeg', 'image/webp'],
    maxBytes: 20 * 1024 * 1024,
  },
  company_logo: {
    exts: ['.png', '.jpg', '.jpeg', '.webp'],
    mimes: ['image/png', 'image/jpeg', 'image/webp'],
    maxBytes: 1 * 1024 * 1024,
  },
};
export const IMAGE_MAX_PIXELS = 40_000_000; // POL-021
export const PHOTO_BATCH_MAX = 20; // POL-021 한 번에 올리는 사진 수
export const THUMB_WIDTH = 640; // 썸네일 가로(px), WebP
export const PDF_PREVIEW_MAX_EDGE = 2400; // PDF 페이지 → PNG 긴 변(px)

/** POL-008·010·009 */
export const INVITE_TTL_HOURS = 72;
export const SIGNUP_RATE_LIMIT = { perIpPerHour: 5 };
export const LOGIN_RATE_LIMIT = { perIpPer15Min: 30, perEmailPer15Min: 10 };
export const PASSWORD_RULE = { min: 10, max: 72 };
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
export const RESERVED_SLUGS = [
  'app',
  'portal',
  'field',
  'api',
  'admin',
  'login',
  'signup',
  'invite',
  'auth',
  'settings',
  'www',
  'static',
  'assets',
] as const;

/** POL-023 */
export const BUSINESS_TZ = 'Asia/Seoul';
export const LOCALES = ['ko', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ko';

/** 목록 페이지 크기 (docs/03_아키텍처_데이터_보안.md 3장) */
export const PAGE_SIZE = 30;
