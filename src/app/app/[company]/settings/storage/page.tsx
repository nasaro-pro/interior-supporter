// src/app/app/[company]/settings/storage/page.tsx (A · TASK-016, REQ-053) — PM-64 저장공간: 사용량 / 1GB, 80% 경고 (NFR-012)
import { getTranslations } from 'next-intl/server';
import { requireCompanyStaff } from '@/features/core';
import { Panel } from '@/features/core/components/summary-blocks';
import { STORAGE_LIMIT_BYTES, getStorageUsage } from '@/features/core/server/company-queries';
import { FILE_KINDS } from '@/shared/contracts/domain';
import { ErrorState, ForbiddenState } from '@/shared/ui/states';
import { cn } from '@/shared/lib/utils';

function formatBytes(n: number, t: (k: 'size.kb' | 'size.mb', v: { value: string }) => string) {
  if (n < 1024 * 1024) return t('size.kb', { value: (n / 1024).toFixed(1) });
  return t('size.mb', { value: (n / 1024 / 1024).toFixed(1) });
}

export default async function StoragePage({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const staff = await requireCompanyStaff(company);
  if (staff.role !== 'owner' && staff.role !== 'manager') {
    return (
      <main data-screen-id="PM-64">
        <ForbiddenState />
      </main>
    );
  }
  const [usage, t, tf] = await Promise.all([
    getStorageUsage(staff.companyId),
    getTranslations('settings'),
    getTranslations('files'),
  ]);
  if (!usage) {
    return (
      <main data-screen-id="PM-64">
        <ErrorState />
      </main>
    );
  }
  const ratio = Math.min(1, usage.used / STORAGE_LIMIT_BYTES);
  const warn = ratio >= 0.8;
  const fmt = (n: number) => formatBytes(n, tf);
  return (
    <main data-screen-id="PM-64" className="flex flex-col gap-5">
      <Panel title={t('screen.storage')}>
        <p className="text-base font-medium tabular-nums">
          {t('storage.used', { used: fmt(usage.used), total: '1GB' })} ({Math.round(ratio * 100)}%)
        </p>
        <div
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(ratio * 100)}
          aria-label={t('screen.storage')}
          className="bg-muted mt-3 h-3 w-full overflow-hidden rounded-full"
        >
          <div
            className={cn('h-full', warn ? 'bg-warning' : 'bg-primary')}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        {warn ? (
          <p
            role="alert"
            className="bg-tone-attention-bg text-tone-attention-fg mt-3 rounded-md px-3 py-2"
          >
            {t('storage.warning')}
          </p>
        ) : null}
        <p className="text-muted-foreground text-meta mt-3">{t('storage.hint')}</p>
      </Panel>
      <Panel title={t('storage.byKind')}>
        <dl className="divide-y">
          {FILE_KINDS.map((k) => (
            <div key={k} className="flex items-center justify-between py-2">
              <dt>{tf(`kind.${k}`)}</dt>
              <dd className="tabular-nums">{fmt(usage.byKind[k] ?? 0)}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </main>
  );
}
