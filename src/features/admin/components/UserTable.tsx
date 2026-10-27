// src/features/admin/components/UserTable.tsx — 계정 목록 표 (A5). 처리 버튼은 UserActions
import { useTranslations } from 'next-intl';
import { DateText } from '@/shared/ui/date-text';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { ToneBadge, type Tone } from '@/shared/ui/tone-badge';
import type { AdminUserRow } from '../types';
import { UserActions } from './UserActions';

function statusOf(u: AdminUserRow): { key: 'anonymized' | 'suspended' | 'active'; tone: Tone } {
  if (u.anonymizedAt) return { key: 'anonymized', tone: 'neutral' };
  if (u.suspendedAt) return { key: 'suspended', tone: 'critical' };
  return { key: 'active', tone: 'positive' };
}

export function UserTable({ rows }: { rows: AdminUserRow[] }) {
  const t = useTranslations('admin');
  return (
    <Table data-ui-key="admin-user-table">
      <TableHeader>
        <TableRow>
          <TableHead>{t('user.name')}</TableHead>
          <TableHead>{t('user.affiliation')}</TableHead>
          <TableHead>{t('user.lastSignIn')}</TableHead>
          <TableHead>{t('user.status')}</TableHead>
          <TableHead>{t('user.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((u) => {
          const status = statusOf(u);
          return (
            <TableRow key={u.id}>
              <TableCell>
                <div className="font-medium">
                  {u.displayName}
                  {u.isAdmin ? (
                    <span className="text-muted-foreground text-meta ms-2">{t('user.admin')}</span>
                  ) : null}
                </div>
                <div className="text-muted-foreground text-meta">{u.email}</div>
              </TableCell>
              <TableCell>
                {u.memberships.map((m) => (
                  <div key={m.slug}>
                    {m.company} · {t(`company.role.${m.role}` as Parameters<typeof t>[0])}
                  </div>
                ))}
                {u.participationCount > 0 ? (
                  <div className="text-muted-foreground text-meta">
                    {t('user.participations', { count: u.participationCount })}
                  </div>
                ) : null}
              </TableCell>
              <TableCell>
                {u.lastSignInAt ? <DateText value={u.lastSignInAt} /> : t('user.never')}
              </TableCell>
              <TableCell>
                <ToneBadge tone={status.tone} size="sm" data-status={status.key}>
                  {t(`user.${status.key}`)}
                </ToneBadge>
              </TableCell>
              <TableCell>
                <UserActions user={u} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
