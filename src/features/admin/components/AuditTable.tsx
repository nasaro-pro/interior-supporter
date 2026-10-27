// src/features/admin/components/AuditTable.tsx — 관리 기록 표 (A8). 표시만 한다
import { useTranslations } from 'next-intl';
import { DateText } from '@/shared/ui/date-text';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import type { AdminAuditRow } from '../types';

export function AuditTable({ rows }: { rows: AdminAuditRow[] }) {
  const t = useTranslations('admin.audit');
  return (
    <Table data-ui-key="admin-audit-table">
      <TableHeader>
        <TableRow>
          <TableHead>{t('when')}</TableHead>
          <TableHead>{t('actor')}</TableHead>
          <TableHead>{t('action')}</TableHead>
          <TableHead>{t('target')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <DateText value={r.occurredAt} />
            </TableCell>
            <TableCell>{r.actorName ?? '—'}</TableCell>
            <TableCell>
              {t.has(`actionName.${r.action}`)
                ? t(`actionName.${r.action}` as Parameters<typeof t>[0])
                : r.action}
            </TableCell>
            <TableCell className="text-muted-foreground text-meta wrap-anywhere">
              {r.targetType}
              {r.targetId ? ` · ${r.targetId.slice(0, 8)}` : ''}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
