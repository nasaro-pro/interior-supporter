// 3) 상담 유도 — 상세 맨 아래 상담 띠 + 휴대폰 화면 아래 고정 버튼 (PUB-11, 목록 PUB-10 은 고정 버튼만)
// 상담 수단은 업체가 넣은 전화·링크만 쓴다 (문의 접수함은 아직 없음: 자동 메일 제외 범위)
import { useTranslations } from 'next-intl';
import { MessageCircle, Phone } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { serif } from '../brand';
import type { PublicCompany } from '../lib/grid';

type Contact = Pick<PublicCompany, 'name' | 'contactPhone' | 'contactUrl'>;

const telHref = (phone: string) => `tel:${phone.replace(/[^0-9+]/g, '')}`;

export function PortfolioContactButtons({
  company,
  compact,
}: {
  company: Contact;
  compact?: boolean;
}) {
  const t = useTranslations('portfolio');
  const base = cn(
    'focus-visible:ring-ring/50 inline-flex items-center justify-center gap-2 rounded-md font-medium outline-none focus-visible:ring-3',
    compact ? 'h-11 flex-1 px-4 text-sm' : 'h-12 px-6',
  );
  return (
    <>
      {company.contactUrl ? (
        <a
          href={company.contactUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-ui-key="portfolio-contact-link"
          className={cn(base, 'bg-foreground text-background hover:bg-foreground/90')}
        >
          <MessageCircle aria-hidden className="size-4" />
          {t('public.ctaLink')}
        </a>
      ) : null}
      {company.contactPhone ? (
        <a
          href={telHref(company.contactPhone)}
          data-ui-key="portfolio-contact-call"
          className={cn(
            base,
            company.contactUrl
              ? 'bg-background text-foreground hover:bg-accent border'
              : 'bg-foreground text-background hover:bg-foreground/90',
          )}
        >
          <Phone aria-hidden className="size-4" />
          {compact ? t('public.call') : `${t('public.call')} ${company.contactPhone}`}
        </a>
      ) : null}
    </>
  );
}

/** 상세 맨 아래 상담 띠 */
export function PortfolioContactBand({ company }: { company: Contact }) {
  const t = useTranslations('portfolio');
  if (!company.contactPhone && !company.contactUrl) return null;
  return (
    <section
      aria-labelledby="portfolio-cta-title"
      className="bg-accent flex flex-col items-start gap-6 rounded-md px-6 py-10 md:flex-row md:items-center md:justify-between md:px-10"
    >
      <div>
        <h2 id="portfolio-cta-title" className={cn(serif, 'text-xl md:text-2xl')}>
          {t('public.ctaTitle')}
        </h2>
        <p className="text-muted-foreground mt-2">
          {t('public.ctaBody', { company: company.name })}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <PortfolioContactButtons company={company} />
      </div>
    </section>
  );
}

/** 휴대폰(<768px) 화면 아래 고정 상담 버튼 + 그 높이만큼 아래 여백 */
export function PortfolioContactBar({ company }: { company: Contact }) {
  const t = useTranslations('portfolio');
  if (!company.contactPhone && !company.contactUrl) return null;
  return (
    <>
      <div aria-hidden className="h-20 md:hidden" />
      <nav
        aria-label={t('public.contact')}
        className="bg-background fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
        data-ui-key="portfolio-contact-bar"
      >
        <PortfolioContactButtons company={company} compact />
      </nav>
    </>
  );
}
