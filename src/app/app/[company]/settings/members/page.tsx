// src/app/app/[company]/settings/members/page.tsx (A · TASK-015, REQ-051·005) — PM-62 구성원
// PM 초대(owner/manager)·관리자 초대·지정·해제·제거(owner)·재설정 링크(owner/manager, 소유자 제외). 소유자 행 변경 불가
import { getTranslations } from 'next-intl/server';
import { requireCompanyStaff } from '@/features/core';
import {
  MemberInviteSheet,
  MemberRoleSelect,
  ResetLinkButton,
} from '@/features/core/components/settings-forms';
import { Panel } from '@/features/core/components/summary-blocks';
import {
  listAssignableProjects,
  listExternalAccounts,
  listMembers,
  listPendingInvites,
} from '@/features/core/server/participant-queries';
import {
  removeMember,
  revokeCompanyAccess,
  revokeInvite,
} from '@/features/core/server/participant-actions';
import { ExternalAccountSheet } from '@/features/core/components/participants';
import {
  CreatePermissionSwitch,
  CreateRequestDecision,
} from '@/features/core/components/create-permission';
import { listCreatePermissionRequests } from '@/features/core/server/create-permission-queries';
import { getAccessContext } from '@/features/core';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { DateText } from '@/shared/ui/date-text';
import { EmptyState, ErrorState, ForbiddenState } from '@/shared/ui/states';
import { tableScrollClass } from '@/shared/ui/styles';

export default async function MembersPage({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const staff = await requireCompanyStaff(company);
  const t = await getTranslations();
  if (staff.role !== 'owner' && staff.role !== 'manager') {
    return (
      <main data-screen-id="PM-62">
        {/* A-15: E2E 는 문구 대신 표준 키(state-forbidden)로 판정 */}
        <ForbiddenState />
      </main>
    );
  }
  const isOwner = staff.role === 'owner';
  const [ctx, members, invites, externals, projects, createRequests] = await Promise.all([
    getAccessContext(),
    listMembers(staff.companyId),
    listPendingInvites({ companyId: staff.companyId }),
    listExternalAccounts(staff.companyId),
    listAssignableProjects(staff.companyId),
    listCreatePermissionRequests(staff.companyId),
  ]);

  const memberTable = (
    <div className={tableScrollClass}>
      <table className="w-full min-w-[560px] text-sm">
        <thead className="text-muted-foreground text-meta text-left">
          <tr className="border-b">
            <th className="py-2 font-medium">{t('auth.field.displayName')}</th>
            <th className="py-2 font-medium">{t('settings.field.role')}</th>
            <th className="py-2 font-medium">{t('settings.field.createPermission')}</th>
            <th className="py-2 font-medium">{t('settings.field.joinedAt')}</th>
            <th className="py-2">
              <span className="sr-only">{t('common.action.moreActions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {(members ?? []).map((m) => {
            const self = m.userId === ctx.userId;
            const locked = m.role === 'owner';
            return (
              <tr key={m.id} data-key={m.id} className="border-b last:border-0">
                <td className="py-2 font-medium">{m.displayName}</td>
                <td className="py-2">
                  {isOwner && !locked && !self ? (
                    <MemberRoleSelect
                      companyId={staff.companyId}
                      memberId={m.id}
                      version={m.version}
                      role={m.role as 'manager' | 'pm'}
                      name={m.displayName}
                    />
                  ) : (
                    t(`settings.memberRole.${m.role}`)
                  )}
                </td>
                <td className="py-2">
                  {/* D-36 · CA-07: 담당자만 켜고 끈다 — 업체관리자(소유자·관리자)는 항상 가능 */}
                  {m.role === 'pm' ? (
                    <CreatePermissionSwitch
                      companyId={staff.companyId}
                      memberId={m.id}
                      allowed={m.canCreateProjects}
                      name={m.displayName}
                    />
                  ) : (
                    <span className="text-muted-foreground text-meta">
                      {t('settings.members.createAlways')}
                    </span>
                  )}
                </td>
                <td className="py-2">
                  <DateText value={m.createdAt} kind="date" />
                </td>
                <td className="py-2 text-end">
                  {locked ? (
                    <span className="text-muted-foreground text-meta">
                      {t('settings.members.ownerLocked')}
                    </span>
                  ) : self ? null : (
                    <div className="flex justify-end gap-1">
                      <ResetLinkButton
                        companyId={staff.companyId}
                        targetUserId={m.userId}
                        name={m.displayName}
                      />
                      {isOwner ? (
                        <ConfirmDialog
                          trigger={t('settings.members.remove')}
                          triggerVariant="ghost"
                          title={t('settings.confirm.removeMember.title', { name: m.displayName })}
                          body={t('settings.confirm.removeMember.body')}
                          confirmLabel={t('settings.members.remove')}
                          successMessage={t('settings.toast.memberRemoved')}
                          action={removeMember.bind(null, {
                            companyId: staff.companyId,
                            memberId: m.id,
                            baseVersion: m.version,
                          })}
                          uiKey="member-remove"
                        />
                      ) : null}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <main data-screen-id="PM-62" className="flex flex-col gap-5">
      <Panel
        title={t('settings.screen.members')}
        action={<MemberInviteSheet companyId={staff.companyId} canInviteManager={isOwner} />}
      >
        {members === null ? (
          <ErrorState />
        ) : members.length <= 1 ? (
          <>
            {memberTable}
            <EmptyState title={t('settings.members.empty')} className="mt-3" />
          </>
        ) : (
          memberTable
        )}
      </Panel>

      {/* D-36 · CA-07: 담당자의 프로젝트 생성 권한 요청 */}
      {createRequests === null ? (
        <Panel title={t('settings.createRequests.title')}>
          <ErrorState />
        </Panel>
      ) : createRequests.length > 0 ? (
        <Panel title={t('settings.createRequests.title')}>
          <ul className="divide-y rounded-md border" data-ui-key="create-requests">
            {createRequests.map((r) => (
              <li
                key={r.id}
                data-key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block font-medium wrap-anywhere">{r.displayName}</span>
                  <span className="text-muted-foreground text-meta">
                    <DateText value={r.createdAt} />
                    {r.note ? ` · ${r.note}` : ''}
                  </span>
                </span>
                <CreateRequestDecision
                  companyId={staff.companyId}
                  requestId={r.id}
                  name={r.displayName}
                />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {/* D-13·D-17: 고객·시공팀 계정 — 업체 설정에서도 만든다(프로젝트 선택). 이 업체 접근을 한 번에 회수 */}
      <Panel
        title={t('settings.externals.title')}
        action={
          <div className="flex flex-wrap gap-2">
            <ExternalAccountSheet role="customer" projects={projects} />
            <ExternalAccountSheet role="field" projects={projects} />
          </div>
        }
      >
        {externals === null ? (
          <ErrorState />
        ) : externals.length === 0 ? (
          <EmptyState title={t('settings.externals.empty')} />
        ) : (
          <ul className="divide-y rounded-md border" data-ui-key="external-accounts">
            {externals.map((x) => (
              <li
                key={x.userId}
                data-key={x.userId}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <span className="max-w-full min-w-0">
                  <span className="block font-medium wrap-anywhere">{x.displayName}</span>
                  <span className="text-muted-foreground text-meta">
                    {x.projects
                      .map(
                        (p) =>
                          `${p.projectName} · ${t(`projects.participantRole.${p.role}`)}${
                            p.state === 'revoked'
                              ? ` (${t('projects.participants.stateRevoked')})`
                              : ''
                          }`,
                      )
                      .join(' / ')}
                  </span>
                </span>
                {x.hasActive ? (
                  <ConfirmDialog
                    trigger={t('settings.externals.revokeAll')}
                    triggerVariant="ghost"
                    title={t('settings.externals.revokeTitle', { name: x.displayName })}
                    body={t('settings.externals.revokeBody')}
                    confirmLabel={t('settings.externals.revokeAll')}
                    successMessage={t('settings.externals.revoked')}
                    action={revokeCompanyAccess.bind(null, {
                      companyId: staff.companyId,
                      userId: x.userId,
                    })}
                    uiKey="external-revoke-all"
                  />
                ) : (
                  <span className="text-muted-foreground text-meta">
                    {t('projects.participants.stateRevoked')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={t('projects.participants.pendingInvites')}>
        {invites === null ? (
          <ErrorState />
        ) : invites.length === 0 ? (
          <p className="text-muted-foreground">{t('projects.participants.noPendingInvites')}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {invites.map((i) => (
              <li
                key={i.id}
                data-key={i.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{i.email}</span>
                  <span className="text-muted-foreground text-meta">
                    {t(`settings.memberRole.${i.role as 'pm' | 'manager'}`)} ·{' '}
                    {t('projects.participants.expiresLabel')} <DateText value={i.expiresAt} />
                  </span>
                </span>
                <ConfirmDialog
                  trigger={t('projects.participants.revokeInvite')}
                  triggerVariant="ghost"
                  title={t('projects.confirm.revokeInvite.title')}
                  body={t('projects.confirm.revokeInvite.body')}
                  confirmLabel={t('projects.participants.revokeInvite')}
                  successMessage={t('projects.toast.inviteRevoked')}
                  action={revokeInvite.bind(null, { inviteId: i.id, projectId: null })}
                  uiKey="member-invite-revoke"
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </main>
  );
}
