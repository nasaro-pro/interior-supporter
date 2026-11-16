// 목록 머리(PortfolioIntro)와 사례 상세 머리(PortfolioWorkHead) — 브랜드 화면: 큰 세리프 제목, 넓은 여백
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { serif } from '../brand';
import { labelText } from '../lib/labels';
import type { PortfolioCompany, PublicWorkDetail } from '../lib/parse';

export function PortfolioIntro({ company }: { company: PortfolioCompany }) {
  const t = useTranslations('portfolio');
  const kicker = labelText(company.labels, 'introKicker', t('public.kicker'));
  return (
    <section className="pt-12 pb-8 md:pt-20 md:pb-12" aria-labelledby="portfolio-title">
      {kicker ? (
        <p
          className="text-muted-foreground mb-4 text-xs font-semibold tracking-[0.2em]"
          data-ui-key="portfolio-intro-kicker"
        >
          {kicker}
        </p>
      ) : null}
      <h1
        id="portfolio-title"
        className={cn(serif, 'text-[32px] leading-tight md:text-[52px] md:leading-[1.2]')}
      >
        {company.name}
      </h1>
      {company.intro ? (
        <p className="text-muted-foreground mt-4 max-w-[34em] text-base md:text-[17px] md:leading-[30px]">
          {company.intro}
        </p>
      ) : null}
    </section>
  );
}

export function PortfolioWorkHead({
  work,
  backHref,
}: {
  work: PublicWorkDetail;
  backHref: string;
}) {
  const t = useTranslations('portfolio');
  const ym = work.completedOn
    ? `${work.completedOn.slice(0, 4)}. ${Number(work.completedOn.slice(5, 7))}.`
    : null;
  const size =
    work.sizePyeong === null
      ? null
      : Number.isInteger(work.sizePyeong)
        ? String(work.sizePyeong)
        : work.sizePyeong.toFixed(1);
  const stats = [
    size ? { value: size, label: t('public.stat.pyeong') } : null,
    work.durationWeeks
      ? { value: String(work.durationWeeks), label: t('public.stat.weeks') }
      : null,
    ym ? { value: ym, label: t('public.stat.completed') } : null,
  ].filter((x): x is { value: string; label: string } => x !== null);

  return (
    <section className="pt-7 pb-10 md:pb-14" aria-labelledby="portfolio-work-title">
      <Link
        href={backHref}
        className="text-muted-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded-sm text-sm outline-none hover:underline focus-visible:ring-3"
        data-ui-key="portfolio-back-link"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t('public.backToList')}
      </Link>
      <div className="mt-6 grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-end md:gap-10">
        <div>
          {work.areaLabel ? (
            <p className="text-muted-foreground text-xs font-semibold tracking-[0.2em]">
              {work.areaLabel}
            </p>
          ) : null}
          <h1
            id="portfolio-work-title"
            className={cn(serif, 'mt-3 text-[30px] leading-tight md:text-[44px] md:leading-[1.25]')}
          >
            {work.title}
          </h1>
        </div>
        {/* 숫자 → 단위 순서로 읽히게 (화면 읽기: "32 평, 9 주 공사") */}
        {stats.length ? (
          <ul
            className="border-foreground grid grid-cols-3 border-t pt-4"
            data-ui-key="portfolio-work-stats"
          >
            {stats.map((s) => (
              <li key={s.label}>
                <span className={cn(serif, 'block text-2xl md:text-[30px]')} data-numeric>
                  {s.value}
                </span>
                <span className="text-muted-foreground mt-1 block text-[13px]">{s.label}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {work.summary ? (
        <p className="mt-10 max-w-[720px] text-base leading-8 whitespace-pre-line">
          {work.summary}
        </p>
      ) : null}
    </section>
  );
}
