// src/features/admin/components/CompanyTable.tsx — 업체 목록 표 (A4). 표시만 한다
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { routes } from '@/shared/contracts/routes';
import { DateText } from '@/shared/ui/date-text';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { formatBytes } from '../lib/bytes';
import type { AdminCompanyRow } from '../types';

export function CompanyTable({ rows }: { rows: AdminCompanyRow[] }) {
  const t = useTranslations('admin.company');
  return (
    <Table data-ui-key="admin-company-table">
      <TableHeader>
        <TableRow>
          <TableHead>{t('name')}</TableHead>
          <TableHead>{t('owner')}</TableHead>
          <TableHead className="text-end">{t('members')}</TableHead>
          <TableHead className="text-end">{t('projects')}</TableHead>
          <TableHead className="text-end">{t('storage')}</TableHead>
          <TableHead>{t('createdAt')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((c) => (
          <TableRow key={c.id}>
            <TableCell>
              <Link
                href={routes.admin.company(c.id)}
                className="font-medium underline-offset-4 hover:underline"
              >
                {c.name}
              </Link>
              <div className="text-muted-foreground text-meta">{c.slug}</div>
            </TableCell>
            <TableCell>{c.ownerName ?? t('ownerNone')}</TableCell>
            <TableCell className="text-end" data-numeric>
              {c.memberCount}
            </TableCell>
            <TableCell className="text-end" data-numeric>
              {c.projectCount}
            </TableCell>
            <TableCell className="text-end" data-numeric>
              {formatBytes(c.storageBytes)}
              {c.quotaBytes ? ` / ${formatBytes(c.quotaBytes)}` : ''}
            </TableCell>
            <TableCell>
              <DateText value={c.createdAt} kind="date" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
