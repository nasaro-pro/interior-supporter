// src/app/app/[company]/projects/[project]/settings/page.tsx (A · TASK-007·012) — PM-10 프로젝트 설정
// 기본 정보·공개 / 참여자(pm 배정·초대 링크·기간·회수·확정권) / 보관 — 같은 화면의 구역 (별도 /access 화면 없음, POL-007)
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireProjectAccess } from '@/features/core';
import { ProjectBasicsForm } from '@/features/core/components/project-forms';
import {
  AssignPmForm,
  InviteParticipantSheet,
  ParticipantEditSheet,
} from '@/features/core/components/participants';
import { Panel } from '@/features/core/components/summary-blocks';
import { getProject } from '@/features/core/server/project-queries';
import {
  listMembers,
  listParticipants,
  listPendingInvites,
} from '@/features/core/server/participant-queries';
import { revokeInvite, revokeParticipant } from '@/features/core/server/participant-actions';
import { setProjectArchived } from '@/features/core/server/project-actions';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { DateText, PeriodText } from '@/shared/ui/date-text';
import { EmptyState, ErrorState } from '@/shared/ui/states';
import { StatusBadge } from '@/shared/ui/status-badge';
import { tableScrollClass } from '@/shared/ui/styles';

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ company: string; project: string }>;
}) {
  const { project: projectId } = await params;
  const access = await requireProjectAccess(projectId, ['editor']);
  const project = await getProject(projectId);
  if (!project) notFound();
  const [participants, invites, members, t] = await Promise.all([
    listParticipants(projectId),
    listPendingInvites({ projectId }),
    listMembers(access.companyId),
    getTranslations(),
  ]);
  const activePm = new Set(
    (participants ?? [])
      .filter((p) => p.role === 'pm' && p.state !== 'revoked')
      .map((p) => p.userId),
  );
  const pmCandidates = (members ?? [])
    .filter((m) => !activePm.has(m.userId))
    .map((m) => ({ userId: m.userId, displayName: m.displayName }));

  const stateLabel = (s: string) =>
    s === 'revoked'
      ? t('projects.participants.stateRevoked')
      : s === 'expired'
        ? t('projects.participants.expired')
        : s === 'pending'
          ? t('projects.participants.statePending')
          : t('projects.participants.stateActive');

  return (
    <main data-screen-id="PM-10" className="flex flex-col gap-5">
      <Panel title={t('projects.settings.basic')}>
        {/* A-06: 저장·최신 불러오기로 version 이 바뀌면 폼을 새로 그린다 (충돌 화면 고착 방지) */}
        <ProjectBasicsForm key={project.version} project={project} />
      </Panel>

      <Panel title={t('projects.settings.participants')}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <AssignPmForm projectId={projectId} candidates={pmCandidates} />
            <div className="flex flex-wrap gap-2">
              <InviteParticipantSheet projectId={projectId} role="customer" />
              <InviteParticipantSheet projectId={projectId} role="field" />
            </div>
          </div>

          {participants === null ? (
            <ErrorState />
          ) : participants.length === 0 ? (
            <EmptyState title={t('projects.participants.empty')} />
          ) : (
            <div className={tableScrollClass}>
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-muted-foreground text-meta text-left">
                  <tr className="border-b">
                    <th className="py-2 font-medium">{t('auth.field.displayName')}</th>
                    <th className="py-2 font-medium">{t('settings.field.role')}</th>
                    <th className="py-2 font-medium">{t('projects.field.period')}</th>
                    <th className="py-2 font-medium">{t('projects.participants.canConfirm')}</th>
                    <th className="py-2 font-medium">{t('common.field.status')}</th>
                    <th className="py-2">
                      <span className="sr-only">{t('common.action.moreActions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => (
                    <tr key={p.id} data-key={p.id} className="border-b last:border-0">
                      <td className="py-2 font-medium wrap-anywhere">{p.displayName}</td>
                      <td className="py-2">{t(`projects.participantRole.${p.role}`)}</td>
                      <td className="py-2">
                        <PeriodText
                          from={p.validFrom}
                          until={p.validUntil}
                          emptyLabel={t('projects.participants.unlimited')}
                        />
                      </td>
                      <td className="py-2">
                        {p.role === 'customer'
                          ? p.canConfirm
                            ? t('projects.participants.yes')
                            : t('projects.participants.no')
                          : '—'}
                      </td>
                      <td className="py-2">
                        <StatusBadge
                          status={
                            p.state === 'active'
                              ? 'file_ready'
                              : p.state === 'revoked'
                                ? 'file_rejected'
                                : 'unconfirmed'
                          }
                          label={stateLabel(p.state)}
                        />
                      </td>
                      <td className="py-2 text-end">
                        {p.state !== 'revoked' ? (
                          <div className="flex justify-end gap-1">
                            <ParticipantEditSheet projectId={projectId} p={p} />
                            <ConfirmDialog
                              trigger={t('projects.participants.revokeParticipant')}
                              triggerVariant="ghost"
                              title={t('projects.confirm.revokeParticipant.title', {
                                name: p.displayName,
                              })}
                              body={t('projects.confirm.revokeParticipant.body')}
                              confirmLabel={t('projects.participants.revokeParticipant')}
                              successMessage={t('projects.toast.participantRevoked')}
                              action={revokeParticipant.bind(null, {
                                projectId,
                                participantId: p.id,
                                baseVersion: p.version,
                              })}
                              uiKey="participant-revoke"
                            />
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <h3 className="mb-2 font-semibold">{t('projects.participants.pendingInvites')}</h3>
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
                    <span className="max-w-full min-w-0">
                      <span className="block font-medium break-all">{i.email}</span>
                      <span className="text-muted-foreground text-meta">
                        {t(`projects.participantRole.${i.role as 'customer' | 'field'}`)}
                        {i.canConfirm ? ` · ${t('projects.participants.canConfirm')}` : ''} ·{' '}
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
                      action={revokeInvite.bind(null, { inviteId: i.id, projectId })}
                      uiKey="invite-revoke"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Panel>

      <Panel title={t('projects.settings.archive')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground max-w-prose">
            {project.archivedAt ? t('projects.state.archived') : t('projects.settings.archiveHint')}
          </p>
          {project.archivedAt ? (
            <ConfirmDialog
              trigger={t('common.action.restore')}
              title={t('projects.confirm.restore.title')}
              body={t('projects.confirm.restore.body')}
              confirmLabel={t('common.action.restore')}
              successMessage={t('common.toast.restored')}
              action={setProjectArchived.bind(null, {
                projectId,
                baseVersion: project.version,
                archive: false,
              })}
              uiKey="project-restore"
              destructive={false}
            />
          ) : (
            <ConfirmDialog
              trigger={t('common.action.archive')}
              title={t('projects.confirm.archive.title')}
              body={t('projects.confirm.archive.body')}
              confirmLabel={t('common.action.archive')}
              successMessage={t('common.toast.archived')}
              action={setProjectArchived.bind(null, {
                projectId,
                baseVersion: project.version,
                archive: true,
              })}
              uiKey="project-archive"
            />
          )}
        </div>
      </Panel>
    </main>
  );
}
