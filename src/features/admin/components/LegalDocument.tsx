// src/features/admin/components/LegalDocument.tsx — 약관·개인정보처리방침 본문 (A9). 문안은 messages/*/admin.json legal.*
import { useTranslations } from 'next-intl';

const SECTIONS = { terms: 7, privacy: 6 } as const;

export function LegalDocument({ kind }: { kind: keyof typeof SECTIONS }) {
  const t = useTranslations('admin.legal');
  const ids = Array.from({ length: SECTIONS[kind] }, (_, i) => `s${i + 1}`);
  return (
    <article className="flex flex-col gap-5">
      <p
        role="note"
        className="bg-tone-caution-bg text-tone-caution-fg rounded-md px-3 py-2 text-sm"
      >
        {t('draftNotice')}
      </p>
      {ids.map((id) => (
        <section key={id} className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">
            {t(`${kind}.${id}Title` as Parameters<typeof t>[0])}
          </h2>
          <p className="leading-relaxed">{t(`${kind}.${id}` as Parameters<typeof t>[0])}</p>
        </section>
      ))}
      <p className="text-muted-foreground text-meta">{t('effective')}</p>
    </article>
  );
}
