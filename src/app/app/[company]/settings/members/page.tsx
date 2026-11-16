// src/app/app/[company]/settings/members/page.tsx (A · TASK-015, REQ-051·005) — PM-62 구성원
// PM 초대(owner/manager)·관리자 초대·지정·해제·제거(owner)·재설정 링크(owner/manager, 소유자 제외). 소유자 행 변경 불가
// 담당자별 권한: 프로젝트 생성(D-36) · 포트폴리오 단계(없음 / 사례 올리기 / 전체 관리)
import { getTranslations } from 'next-intl/server';
import { requireCompanyStaff } from '@/features/core';
import {
  MemberActionsMenu,
  MemberInviteSheet,
  MemberRoleSelect,
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
import {
  PortfolioAccessSelect,
  PortfolioRequestDecision,
} from '@/features/portfolio/components/permission';
import {
  listPortfolioAccessRequests,
  loadMemberPortfolioLevels,
} from '@/features/portfolio/server/permission-queries';
import { getAccessContext } from '@/features/core';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { DateText } from '@/shared/ui/date-text';
import { EmptyState, ErrorState, ForbiddenState } from '@/shared/ui/states';

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
  const [
    ctx,
    members,
    invites,
    externals,
    projects,
    createRequests,
    portfolioLevels,
    portfolioRequests,
  ] = await Promise.all([
    getAccessContext(),
    listMembers(staff.companyId),
    listPendingInvites({ companyId: staff.companyId }),
    listExternalAccounts(staff.companyId),
    listAssignableProjects(staff.companyId),
    listCreatePermissionRequests(staff.companyId),
    loadMemberPortfolioLevels(staff.companyId),
    listPortfolioAccessRequests(staff.companyId),
  ]);

  // 2026-11 구성원 표 개선: 이름(첫 글자 동그라미) · 역할(글자형 드롭다운) · 생성(스위치 + 가능/불가) · 포트폴리오(3칸 버튼) · 합류일 · ⋯ 메뉴
  // 휴대폰(768px 미만)은 표 대신 구성원마다 카드
  const rows = (members ?? []).map((m) => {
    const self = m.userId === ctx.userId;
    const locked = m.role === 'owner';
    const person = (
      <span className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="bg-tone-brand-bg grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold"
        >
          {m.displayName.trim().slice(0, 1)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold">{m.displayName}</span>
          {self ? (
            <span className="text-muted-foreground block text-[13px]">
              {t('settings.members.you')}
            </span>
          ) : null}
        </span>
      </span>
    );
    const role =
      isOwner && !locked && !self ? (
        <MemberRoleSelect
          companyId={staff.companyId}
          memberId={m.id}
          version={m.version}
          role={m.role as 'manager' | 'pm'}
          name={m.displayName}
        />
      ) : (
        <span className="text-muted-foreground text-sm">{t(`settings.memberRole.${m.role}`)}</span>
      );
    // D-36 · CA-07: 담당자만 켜고 끈다 — 업체관리자(소유자·관리자)는 항상 가능
    const create =
      m.role === 'pm' ? (
        <CreatePermissionSwitch
          companyId={staff.companyId}
          memberId={m.id}
          allowed={m.canCreateProjects}
          name={m.displayName}
        />
      ) : (
        <span className="text-muted-foreground text-sm">{t('settings.members.createAlways')}</span>
      );
    // 포트폴리오: 담당자만 단계를 고른다 — 업체관리자는 항상 전체 관리
    const portfolio =
      m.role === 'pm' ? (
        <PortfolioAccessSelect
          companyId={staff.companyId}
          memberId={m.id}
          level={portfolioLevels.get(m.id) ?? 'none'}
          name={m.displayName}
        />
      ) : (
        <span className="text-muted-foreground text-sm">
          {t('portfolio.permission.level.full')}
        </span>
      );
    const joined = (
      <span className="text-muted-foreground text-[13px]">
        <DateText value={m.createdAt} kind="date" />
      </span>
    );
    const actions = locked ? (
      <span className="sr-only">{t('settings.members.ownerLocked')}</span>
    ) : self ? null : (
      <MemberActionsMenu
        companyId={staff.companyId}
        targetUserId={m.userId}
        name={m.displayName}
        removeAction={
          isOwner
            ? removeMember.bind(null, {
                companyId: staff.companyId,
                memberId: m.id,
                baseVersion: m.version,
              })
            : undefined
        }
      />
    );
    return { m, person, role, create, portfolio, joined, actions };
  });
  const th = 'pb-3 text-left text-[13px] font-medium text-foreground/75';

  const memberTable = (
    <>
      <div className="hidden md:block">
        <table className="w-full table-fixed" data-ui-key="member-table">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[14%]" />
            <col className="w-[15%]" />
            <col className="w-[29%]" />
            <col className="w-[9%]" />
            <col className="w-[5%]" />
          </colgroup>
          <thead>
            <tr className="border-b">
              <th className={th}>{t('auth.field.displayName')}</th>
              <th className={th}>{t('settings.field.role')}</th>
              <th className={th}>{t('settings.field.createPermission')}</th>
              <th className={th}>{t('portfolio.permission.column')}</th>
              <th className={th}>{t('settings.field.joinedAt')}</th>
              <th className="pb-3">
                <span className="sr-only">{t('common.action.moreActions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.m.id} data-key={r.m.id} className="border-b last:border-0">
                <td className="py-3.5 pr-4">{r.person}</td>
                <td className="py-3.5">{r.role}</td>
                <td className="py-3.5">{r.create}</td>
                <td className="py-3.5">{r.portfolio}</td>
                <td className="py-3.5">{r.joined}</td>
                <td className="py-3.5 text-end">{r.actions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-3 md:hidden" data-ui-key="member-cards">
        {rows.map((r) => (
          <li key={r.m.id} data-key={r.m.id} className="rounded-xl border p-4">
            <div className="flex items-center justify-between gap-3">
              {r.person}
              {r.actions}
            </div>
            <dl className="mt-4 grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-y-3 border-t pt-4">
              <dt className="text-muted-foreground text-[13px]">{t('settings.field.role')}</dt>
              <dd className="min-w-0">{r.role}</dd>
              <dt className="text-muted-foreground text-[13px]">
                {t('settings.field.createPermission')}
              </dt>
              <dd className="min-w-0">{r.create}</dd>
              <dt className="text-muted-foreground text-[13px]">
                {t('portfolio.permission.column')}
              </dt>
              <dd className="min-w-0 overflow-x-auto">{r.portfolio}</dd>
              <dt className="text-muted-foreground text-[13px]">{t('settings.field.joinedAt')}</dt>
              <dd className="min-w-0">{r.joined}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <main data-screen-id="PM-62" className="flex flex-col gap-5">
      {/* D-36 · CA-07: 담당자의 프로젝트 생성 권한 요청 — 처리할 일이므로 구성원 표 위에 */}
      {createRequests === null ? (
        <Panel title={t('settings.createRequests.title')}>
          <ErrorState />
        </Panel>
      ) : createRequests.length > 0 ? (
        <Panel title={t('settings.createRequests.title')}>
          <ul
            className="border-tone-attention-fg/40 divide-y rounded-md border"
            data-ui-key="create-requests"
          >
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

      {/* 포트폴리오 권한 요청 — 생성 권한 요청과 같은 자리 */}
      {portfolioRequests === null ? (
        <Panel title={t('portfolio.permission.requestsTitle')}>
          <ErrorState />
        </Panel>
      ) : portfolioRequests.length > 0 ? (
        <Panel title={t('portfolio.permission.requestsTitle')}>
          <ul
            className="border-tone-attention-fg/40 divide-y rounded-md border"
            data-ui-key="portfolio-requests"
          >
            {portfolioRequests.map((r) => (
              <li
                key={r.id}
                data-key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block font-medium wrap-anywhere">
                    {r.displayName} · {t(`portfolio.permission.level.${r.level}`)}
                  </span>
                  <span className="text-muted-foreground text-meta">
                    <DateText value={r.createdAt} />
                    {r.note ? ` · ${r.note}` : ''}
                  </span>
                </span>
                <PortfolioRequestDecision
                  companyId={staff.companyId}
                  requestId={r.id}
                  name={r.displayName}
                />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

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
