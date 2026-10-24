// 확정 기록 (REQ-112: 누가·언제·어느 리비전, 무효화 사유) — 서버 컴포넌트
import { getLocale, getTranslations } from 'next-intl/server';
import { formatDateTime } from '@/shared/lib/dates';
import type { ConfirmationRecord } from '@/features/designs/types';

export async function ConfirmRecord({
  records,
  showHistory,
}: {
  records: ConfirmationRecord[];
  /** 편집자만 무효화된 과거 기록까지 본다 */
  showHistory: boolean;
}) {
  const t = await getTranslations('designs');
  const locale = (await getLocale()) === 'en' ? 'en' : 'ko';
  const visible = showHistory ? records : records.filter((r) => !r.invalidatedAt);
  if (visible.length === 0) return null;
  return (
    <section aria-label={t('record.title')} className="flex flex-col gap-2 text-sm">
      <h2 className="text-base font-semibold">{t('record.title')}</h2>
      <ul className="flex flex-col gap-1">
        {visible.map((r) => (
          <li
            key={r.id}
            data-key={r.id}
            className={r.invalidatedAt ? 'text-muted-foreground line-through' : ''}
          >
            {t('record.line', {
              name: r.confirmedByName ?? t('record.someone'),
              at: formatDateTime(r.confirmedAt, locale),
              revision: r.targetRevision,
            })}
            {r.invalidatedAt ? (
              <span className="ml-1 no-underline">
                ({t('record.invalidated', { reason: reasonLabel(r.invalidatedReason, t) })})
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 현재 유효한 확정 기록 한 줄 — "○○님이 2026-10-06 14:20 확정(리비전 2)" (ConfirmButton confirmed 상태, 02 문서 6.5) */
export async function confirmedLine(records: ConfirmationRecord[]): Promise<string | null> {
  const valid = records.find((r) => !r.invalidatedAt);
  if (!valid) return null;
  const t = await getTranslations('designs');
  const locale = (await getLocale()) === 'en' ? 'en' : 'ko';
  return t('record.line', {
    name: valid.confirmedByName ?? t('record.someone'),
    at: formatDateTime(valid.confirmedAt, locale),
    revision: valid.targetRevision,
  });
}

function reasonLabel(
  reason: string | null,
  t: Awaited<ReturnType<typeof getTranslations<'designs'>>>,
): string {
  if (!reason) return '';
  if (reason === 'core_changed') return t('record.reasonCoreChanged');
  if (reason === 'new_version') return t('record.reasonNewVersion');
  if (reason.startsWith('pm_request: ')) return t('record.reasonPm', { reason: reason.slice(12) });
  return reason;
}
