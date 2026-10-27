'use client';
// src/features/admin/components/CleanupPanel.tsx — 정리 대상 파일 선택·정리 + 읽은 알림 정리 (A7)
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Checkbox } from '@/shared/ui/checkbox';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { DateText } from '@/shared/ui/date-text';
import { Section } from '@/shared/ui/section';
import { EmptyState } from '@/shared/ui/states';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { formatBytes } from '../lib/bytes';
import { purgeFiles, purgeReadNotifications } from '../server/actions';
import type { CleanupCandidate } from '../types';
import { useAdminErrorText } from './use-admin-error-text';

export function CleanupPanel({ files }: { files: CleanupCandidate[] }) {
  const t = useTranslations('admin.cleanup');
  const errorText = useAdminErrorText();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = files.length > 0 && selected.size === files.length;
  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-8">
      <Section title={t('filesTitle')} description={t('filesHint')} variant="card">
        {files.length === 0 ? (
          <EmptyState title={t('filesEmpty')} />
        ) : (
          <>
            <Table data-ui-key="admin-cleanup-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label={t('selectAll')}
                      checked={allSelected}
                      onCheckedChange={(v) =>
                        setSelected(v ? new Set(files.map((f) => f.id)) : new Set())
                      }
                    />
                  </TableHead>
                  <TableHead>{t('file')}</TableHead>
                  <TableHead>{t('reason')}</TableHead>
                  <TableHead className="text-end">MB</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <Checkbox
                        aria-label={f.originalName}
                        checked={selected.has(f.id)}
                        onCheckedChange={(v) => toggle(f.id, v === true)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="wrap-anywhere">{f.originalName}</div>
                      <div className="text-muted-foreground text-meta">
                        {f.companyName} · <DateText value={f.createdAt} />
                      </div>
                    </TableCell>
                    <TableCell>
                      {f.status === 'rejected' ? t('reasonRejected') : t('reasonUnattached')}
                    </TableCell>
                    <TableCell className="text-end" data-numeric>
                      {formatBytes(f.sizeBytes)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div>
              {selected.size > 0 ? (
                <ConfirmDialog
                  uiKey="admin-cleanup-purge"
                  trigger={t('purgeSelected', { count: selected.size })}
                  title={t('purgeConfirm', { count: selected.size })}
                  body={t('purgeBody')}
                  confirmLabel={t('purgeSelected', { count: selected.size })}
                  action={() => purgeFiles({ fileIds: [...selected] })}
                  onSuccess={(data) => {
                    toast.success(t('purged', { count: (data as { purged: number }).purged }));
                    setSelected(new Set());
                  }}
                  onError={(e) => toast.error(errorText(e))}
                />
              ) : null}
            </div>
          </>
        )}
      </Section>

      <Section title={t('notificationsTitle')} description={t('notificationsHint')} variant="card">
        <div>
          <ConfirmDialog
            uiKey="admin-cleanup-notifications"
            destructive={false}
            trigger={t('notificationsRun')}
            title={t('notificationsTitle')}
            body={t('notificationsHint')}
            confirmLabel={t('notificationsRun')}
            action={() => purgeReadNotifications()}
            onSuccess={(data) =>
              toast.success(
                t('notificationsPurged', { count: (data as { purged: number }).purged }),
              )
            }
            onError={(e) => toast.error(errorText(e))}
          />
        </div>
      </Section>
    </div>
  );
}
