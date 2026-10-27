/**
 * 정규 경로 빌더 — 앱 안에서 URL 문자열을 만드는 유일한 곳 (알림·캘린더·요약 카드 링크 포함)
 * 소유: A · 변경 요청은 진행 기록의 변경 요청(CR)으로만 (docs/00_헌법_공통규칙.md 5.9). 문자열 리터럴로 경로를 직접 쓰는 코드는 리뷰에서 거절한다.
 * 근거: 02-뎁스구조-설계안 8절, docs/02_화면구조_뎁스_디자인.md
 */
import type { FieldTab, PortalTab, ProjectTab } from './screens';

const enc = encodeURIComponent;

export const routes = {
  // 공개·인증
  landing: () => '/',
  login: (next?: string) => (next ? `/login?next=${enc(next)}` : '/login'),
  signup: () => '/signup',
  invite: (token: string) => `/invite/${enc(token)}`,
  resetPassword: () => '/reset-password',
  selectArea: () => '/select-area',
  authConfirm: () => '/auth/confirm',

  // PM
  app: {
    projects: (company: string, q?: { q?: string; status?: string }) => {
      const s = new URLSearchParams();
      if (q?.q) s.set('q', q.q);
      if (q?.status) s.set('status', q.status);
      const qs = s.toString();
      return `/app/${enc(company)}/projects${qs ? `?${qs}` : ''}`;
    },
    project: (company: string, project: string, tab: ProjectTab = 'overview') =>
      `/app/${enc(company)}/projects/${enc(project)}/${tab}`,
    design: (company: string, project: string, designId: string) =>
      `/app/${enc(company)}/projects/${enc(project)}/designs/${enc(designId)}`,
    material: (company: string, project: string, materialId: string) =>
      `/app/${enc(company)}/projects/${enc(project)}/materials/${enc(materialId)}`,
    request: (company: string, project: string, requestId: string) =>
      `/app/${enc(company)}/projects/${enc(project)}/requests/${enc(requestId)}`,
    photo: (company: string, project: string, photoId: string) =>
      `/app/${enc(company)}/projects/${enc(project)}/photos/${enc(photoId)}`,
    scheduleEvent: (company: string, project: string, eventId: string) =>
      `/app/${enc(company)}/projects/${enc(project)}/schedule/${enc(eventId)}`,
    estimate: (company: string, project: string, estimateId: string, versionNo?: number) =>
      `/app/${enc(company)}/projects/${enc(project)}/estimates/${enc(estimateId)}${versionNo ? `?v=${versionNo}` : ''}`,
    clients: (company: string) => `/app/${enc(company)}/clients`,
    client: (company: string, clientId: string) => `/app/${enc(company)}/clients/${enc(clientId)}`,
    calendar: (company: string, month?: string /* YYYY-MM */) =>
      `/app/${enc(company)}/calendar${month ? `?month=${month}` : ''}`,
    history: (company: string) => `/app/${enc(company)}/history`,
    historyEvent: (company: string, eventId: string | number) =>
      `/app/${enc(company)}/history/${eventId}`,
    notifications: (company: string) => `/app/${enc(company)}/notifications`,
    settings: (
      company: string,
      section: 'company' | 'members' | 'templates' | 'storage' = 'company',
    ) => `/app/${enc(company)}/settings/${section}`,
  },

  // 고객
  portal: {
    projects: () => '/portal/projects',
    project: (project: string, tab: PortalTab = 'home') =>
      `/portal/projects/${enc(project)}/${tab}`,
    design: (project: string, designId: string) =>
      `/portal/projects/${enc(project)}/designs/${enc(designId)}`,
    material: (project: string, materialId: string) =>
      `/portal/projects/${enc(project)}/materials/${enc(materialId)}`,
    request: (project: string, requestId: string) =>
      `/portal/projects/${enc(project)}/requests/${enc(requestId)}`,
    photo: (project: string, photoId: string) =>
      `/portal/projects/${enc(project)}/photos/${enc(photoId)}`,
    scheduleEvent: (project: string, eventId: string) =>
      `/portal/projects/${enc(project)}/schedule/${enc(eventId)}`,
    estimate: (project: string, estimateId: string, versionNo?: number) =>
      `/portal/projects/${enc(project)}/estimates/${enc(estimateId)}${versionNo ? `?v=${versionNo}` : ''}`,
    notifications: () => '/portal/notifications',
  },

  // 시공팀
  field: {
    /** FW-00 내 현장 카드 (F1) */
    home: () => '/field',
    /** 현장 입구 — 켜진 첫 탭(없으면 현장 사진)으로 이동 */
    siteHome: (project: string) => `/field/sites/${enc(project)}`,
    /** FW-04~06 현장 탭 — 담당자가 켠 탭만 열린다 (F2) */
    site: (project: string, tab: FieldTab) => `/field/sites/${enc(project)}/${tab}`,
    photos: (project?: string, upload = false) => {
      const s = new URLSearchParams();
      if (project) s.set('project', project);
      if (upload) s.set('upload', '1');
      const qs = s.toString();
      return `/field/photos${qs ? `?${qs}` : ''}`;
    },
    photo: (photoId: string, project: string) =>
      `/field/photos/${enc(photoId)}?project=${enc(project)}`,
    notifications: () => '/field/notifications',
  },

  // 사이트 관리 (통합본 3장 A1~A11, CR-3) — 운영자 전용, 별도 로그인 주소
  admin: {
    login: () => '/admin/login',
    dashboard: () => '/admin',
    companies: (q?: string) => (q ? `/admin/companies?q=${enc(q)}` : '/admin/companies'),
    company: (companyId: string) => `/admin/companies/${enc(companyId)}`,
    users: (q?: string) => (q ? `/admin/users?q=${enc(q)}` : '/admin/users'),
    settings: () => '/admin/settings',
    cleanup: () => '/admin/cleanup',
    audit: () => '/admin/audit',
  },

  // 약관·개인정보처리방침 (A9) · 본인 탈퇴 (A10)
  legal: {
    terms: () => '/terms',
    privacy: () => '/privacy',
  },
  withdraw: () => '/account/withdraw',

  // 파일 다운로드 (권한 재검사 후 단기 서명 URL 로 302)
  file: (fileId: string, opts?: { download?: boolean }) =>
    `/api/files/${enc(fileId)}${opts?.download ? '?download=1' : ''}`,
} as const;

/** next 파라미터 오픈 리다이렉트 방지 (SEC-012): 같은 사이트 상대 경로만 허용 */
export function safeNext(next: string | null | undefined, fallback = '/select-area'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\'))
    return fallback;
  return next;
}
