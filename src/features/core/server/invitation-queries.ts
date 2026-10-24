// src/features/core/server/invitation-queries.ts (A · REQ-004 · A-08) — 초대 미리보기 조회 (server-only)
// A-08: 예전에는 'use server' 파일(auth-actions.ts)의 export 라서 누구나 부를 수 있는 공개 Server Action 이었다
//       (service_role 조회·요청 제한 없음). 이제 server-only 모듈의 일반 함수 — 서버 컴포넌트(AUTH-03)와
//       auth-actions.ts 내부에서만 부른다. 액션 manifest 에 나타나지 않는다.
// service_role 허용 파일 확장: TC-909 목록(eslint.config.mjs, 고정 파일)에 이 파일 추가를 CR-A-09 로 요청.
//       admin 은 아래 getInvitationPreview 한 곳에서만, 토큰 해시 일치 1행 + 업체 이름만 읽는다 (헌법 9.3).
import 'server-only';
import { createHash } from 'node:crypto';
// eslint-disable-next-line no-restricted-imports -- A-08 CR-A-09: auth-actions.ts 에서 옮긴 초대 미리보기 (TC-909 허용 목록 추가 요청)
import { createAdminSupabase } from '@/shared/lib/supabase/admin';
import type { MemberRole, ParticipantRole } from '@/shared/contracts/domain';

export const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export type InvitationPreview =
  | {
      status: 'valid';
      companyName: string;
      email: string;
      role: MemberRole | ParticipantRole;
      area: 'app' | 'portal' | 'field';
    }
  | { status: 'used' | 'invalid' };

/** /invite/[token] 화면 표시용. 토큰 원문은 저장·로그하지 않는다 (POL-008) */
export async function getInvitationPreview(token: string): Promise<InvitationPreview> {
  if (!INVITE_TOKEN_RE.test(token)) return { status: 'invalid' };
  const admin = createAdminSupabase();
  const { data: inv } = await admin
    .from('invitations')
    .select(
      'company_id, project_id, email, member_role, participant_role, expires_at, accepted_at, revoked_at',
    )
    .eq('token_hash', sha256(token))
    .maybeSingle();
  if (!inv) return { status: 'invalid' };
  if (inv.accepted_at) return { status: 'used' };
  if (inv.revoked_at || new Date(inv.expires_at).getTime() <= Date.now())
    return { status: 'invalid' };
  const { data: company } = await admin
    .from('companies')
    .select('name')
    .eq('id', inv.company_id)
    .maybeSingle();
  const role = (inv.member_role ?? inv.participant_role) as MemberRole | ParticipantRole;
  return {
    status: 'valid',
    companyName: company?.name ?? '',
    email: inv.email,
    role,
    area: inv.project_id ? (inv.participant_role === 'customer' ? 'portal' : 'field') : 'app',
  };
}
