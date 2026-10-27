// src/features/admin/components/StatGrid.tsx — 대시보드 숫자 칸 (A3). 표시만 한다
import type { ReactNode } from 'react';

export function StatGrid({ items }: { items: { key: string; label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-5" data-ui-key="admin-stats">
      {items.map((it) => (
        <div key={it.key} className="bg-card rounded-lg border p-4 shadow-sm">
          <dt className="text-muted-foreground text-meta">{it.label}</dt>
          <dd className="mt-1 text-2xl font-semibold" data-numeric>
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
