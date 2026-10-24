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
import { listMembers, listPendingInvites } from '@/features/core/server/participant-queries';
import { removeMember, revokeInvite } from '@/features/core/server/participant-actions';
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
  const [ctx, members, invites] = await Promise.all([
    getAccessContext(),
    listMembers(staff.companyId),
    listPendingInvites({ companyId: staff.companyId }),
  ]);

  const memberTable = (
    <div className={tableScrollClass}>
      <table className="w-full min-w-[560px] text-sm">
        <thead className="text-muted-foreground text-meta text-left">
          <tr className="border-b">
            <th className="py-2 font-medium">{t('auth.field.displayName')}</th>
            <th className="py-2 font-medium">{t('settings.field.role')}</th>
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
