// src/features/core/server/customer-preview.ts (A) — 담당자의 '고객 화면 미리보기' (읽기 전용)
// 담당자가 프로젝트 상단 [고객 화면 미리보기] → 쿠키(프로젝트 id) → 실제 고객 화면(/portal)을 고객 권한 규칙으로 본다.
//  - 페이지 렌더에서만 인정한다. Server Action 요청(next-action 헤더)에서는 인정하지 않는다 → 쓰기 불가
//  - 그 프로젝트의 편집 권한이 있어야 한다 (쿠키만으로는 아무것도 열리지 않는다)
//  - 화면은 access.preview 로 입력 · 확정 · 댓글을 그리지 않고, 조회는 고객 공개분만 거른다
import 'server-only';
import { cookies, headers } from 'next/headers';
import type { ProjectAccess } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { CUSTOMER_PREVIEW_COOKIE } from '@/shared/lib/supabase/server';
import { findProjectAccess } from './access';

export { CUSTOMER_PREVIEW_COOKIE };
/** 1시간 — 끝내기를 누르지 않아도 저절로 풀린다 */
export const CUSTOMER_PREVIEW_MAX_AGE = 60 * 60;

/**
 * 미리보기 시작 뒤 갈 곳 — to 가 이 프로젝트의 고객 화면 경로(/portal/projects/<id>/...)일 때만 그대로, 아니면 고객 홈.
 * 개요의 고객 화면 미리보기 안 링크([전체 보기]·도안·사진·일정)가 이 값을 넘긴다. 다른 프로젝트 · 바깥 주소로는 보내지 않는다
 */
export function previewStartPath(projectId: string, to: string | null | undefined): string {
  const home = routes.portal.project(projectId, 'home');
  if (!to) return home;
  const base = `/portal/projects/${encodeURIComponent(projectId)}/`;
  if (!to.startsWith(base)) return home;
  const rest = to.slice(base.length);
  // 경로 조각은 영문·숫자·-·_ 만 (.. · // · \ · 쿼리 · 조각 식별자 없음)
  if (!/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/.test(rest)) return home;
  return to;
}

/** 미리보기 중인 프로젝트 id (쿠키 · 페이지 요청일 때만). 권한 확인은 하지 않는다 */
export async function previewProjectId(): Promise<string | null> {
  const h = await headers();
  if (h.get('next-action')) return null; // Server Action 은 미리보기로 열지 않는다
  return (await cookies()).get(CUSTOMER_PREVIEW_COOKIE)?.value ?? null;
}

/** 미리보기 접근 — 쿠키의 프로젝트 = 요청 프로젝트이고, 그 프로젝트 편집 권한이 있을 때만 */
export async function findCustomerPreview(projectId: string): Promise<ProjectAccess | null> {
  if ((await previewProjectId()) !== projectId) return null;
  const editor = await findProjectAccess(projectId, ['editor']);
  if (!editor) return null;
  return { ...editor, as: 'customer', canConfirm: false, preview: true };
}
