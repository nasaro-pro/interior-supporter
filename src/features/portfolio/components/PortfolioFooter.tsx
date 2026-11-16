// 5) 공개 페이지 바닥 칸 — 업체가 관리 탭에서 고친다 (비운 칸은 안 보임). 화면 끝까지 칠하고 안쪽은 본문과 같은 폭
//  위: [바닥 문구 · FOLLOW US 아이콘]  [CONTACT 전화·상담 시간·이메일]
//  아래: 사업자 정보 한 줄 · © 줄 · 서비스 표시
// 색: 분위기(page_tone)를 따라가는 3가지 (same / soft / deep, brand.ts footerColors) — 21개 조합 모두 4.5:1 이상
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { routes } from '@/shared/contracts/routes';
import { cn } from '@/shared/lib/utils';
import { footerColors, normalizeFooterTone, serif } from '../brand';
import { footerRows } from '../lib/grid';
import type { PortfolioCompany } from '../lib/parse';
import { labelText } from '../lib/labels';
import { checkSns, type SnsKind } from '../lib/sns';
import { CONTACT_ANCHOR } from '../lib/anchors';

const ICON: Record<SnsKind, ReactNode> = {
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3z" />
    </svg>
  ),
  blog: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="4" width="18" height="14" rx="3" />
      <path d="M8 18l-2 3M7.5 8.5v5M7.5 11h2a1.3 1.3 0 0 1 0 2.5h-2M15.5 11a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zM12.5 8.5v5" />
    </svg>
  ),
  kakao: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 4C7 4 3 7.1 3 11c0 2.5 1.7 4.7 4.2 5.9L6.3 20l3.6-2.4c.7.1 1.4.2 2.1.2 5 0 9-3.1 9-7s-4-6.8-9-6.8z" />
    </svg>
  ),
  web: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  ),
};

export function PortfolioFooter({ company }: { company: PortfolioCompany }) {
  const t = useTranslations('portfolio');
  const tone = normalizeFooterTone(company.footerTone);
  const c = footerColors(company.pageTone, tone);
  const rows = footerRows(company);
  const links = (company.snsLinks ?? []).flatMap((u) => {
    const r = checkSns(u);
    return r.ok ? [r] : [];
  });
  const slogan = (company.footerSlogan ?? '').trim();
  const email = company.contactEmail?.trim() || null;
  const hasContact = !!(company.contactPhone || company.contactUrl || company.csHours || email);
  const year = new Date().getFullYear();
  const follow = labelText(company.labels, 'followUs', 'FOLLOW US');
  const contactLabel = labelText(company.labels, 'contact', 'CONTACT');

  return (
    <footer
      id={CONTACT_ANCHOR}
      className="mt-24 scroll-mt-4 border-t"
      style={{ background: c.bg, color: c.fg, borderTopColor: c.topLine }}
      data-ui-key="portfolio-footer"
      data-footer-tone={tone}
    >
      <div className="mx-auto max-w-[1120px] px-5 pt-14 pb-8 md:px-10 md:pt-16">
        <div className="grid gap-10 md:grid-cols-[1.3fr_1fr]">
          <div>
            <p
              className={cn(
                serif,
                'text-[clamp(26px,3.4vw,40px)] leading-[1.18] whitespace-pre-line',
              )}
            >
              {slogan
                ? slogan
                    .split('/')
                    .map((s) => s.trim())
                    .join('\n')
                : company.name}
            </p>
            {links.length ? (
              <div
                className="mt-9 flex flex-wrap items-center gap-4"
                data-ui-key="portfolio-footer-sns"
              >
                {follow ? (
                  <span
                    className="text-[11px] tracking-[0.26em]"
                    style={{ color: c.muted }}
                    aria-hidden
                  >
                    {follow}
                  </span>
                ) : null}
                <ul
                  className="flex flex-wrap items-center gap-2"
                  aria-label={t('public.footer.followUs')}
                >
                  {links.map((l) => (
                    <li key={l.url}>
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('public.footer.snsLabel', {
                          company: company.name,
                          sns: t(`public.footer.sns.${l.kind}`),
                        })}
                        className="focus-visible:ring-ring/50 grid size-10 place-items-center rounded-full opacity-85 outline-none hover:opacity-100 focus-visible:ring-3 [&_svg]:size-[21px]"
                      >
                        {ICON[l.kind]}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          {hasContact ? (
            <div
              data-ui-key="portfolio-footer-contact"
              className="-m-4 rounded-xl p-4 transition-[background-color,box-shadow] duration-700 data-[flash=on]:bg-black/[0.04] data-[flash=on]:ring-1 data-[flash=on]:ring-current/15"
            >
              {contactLabel ? (
                <h2
                  className="mb-4 text-[11px] font-semibold tracking-[0.26em]"
                  style={{ color: c.muted }}
                >
                  {contactLabel}
                </h2>
              ) : (
                <h2 className="sr-only">CONTACT</h2>
              )}
              {company.contactPhone ? (
                <p className={cn(serif, 'mb-2 text-[22px]')} data-numeric>
                  <a
                    href={`tel:${company.contactPhone.replace(/[^0-9+]/g, '')}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {company.contactPhone}
                  </a>
                </p>
              ) : null}
              {company.csHours ? <p className="mb-2 text-[15px]">{company.csHours}</p> : null}
              {company.contactUrl ? (
                <p className="mb-2 text-[15px]">
                  {/* 상담 링크 (카카오톡 채널 등) — 2026-11: 머리 '상담 신청'이 이 칸으로 내려오므로 여기서도 연결 */}
                  <a
                    href={company.contactUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
                    data-ui-key="portfolio-footer-chat"
                  >
                    {/kakao\.com/i.test(company.contactUrl)
                      ? t('public.footer.chatKakao')
                      : t('public.footer.chatOnline')}
                    <span aria-hidden>↗</span>
                  </a>
                </p>
              ) : null}
              {email ? (
                <p className="text-[15px]">
                  <a href={`mailto:${email}`} className="underline-offset-4 hover:underline">
                    {email}
                  </a>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <hr className="mt-11 mb-5 border-0 border-t" style={{ borderTopColor: c.line }} />
        <div className="text-meta" style={{ color: c.muted }}>
          {rows.length ? (
            <dl className="flex flex-col gap-1 md:flex-row md:flex-wrap md:gap-x-4">
              {rows.map(([key, value]) => (
                <div key={key} className="flex gap-1.5">
                  <dt>{t(`public.footer.${key}`)}</dt>
                  <dd data-numeric>{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className="mt-4 flex flex-wrap justify-between gap-3">
            <span data-numeric>
              © {year} {company.businessName || company.name}. All Rights Reserved.
            </span>
            <Link
              href={routes.landing()}
              className="underline underline-offset-4"
              data-ui-key="portfolio-powered-by"
            >
              {t('public.poweredBy')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
