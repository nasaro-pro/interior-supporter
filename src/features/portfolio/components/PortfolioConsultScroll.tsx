'use client';
// 공개 페이지 머리 '상담 신청' (2026-11) — 누르면 바닥 칸의 연락처(CONTACT · FOLLOW US)로 부드럽게 내려가고, 연락처 칸을 잠깐 강조한다
// 휴대폰은 아래 고정 상담 버튼이 있어서 이 버튼은 PC(768px 이상)에서만 보인다. 움직임 줄이기 설정이면 바로 이동
import { MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CONTACT_ANCHOR } from '../lib/anchors';

export function PortfolioConsultScroll() {
  const t = useTranslations('portfolio');
  return (
    <a
      href={`#${CONTACT_ANCHOR}`}
      onClick={(e) => {
        const target = document.getElementById(CONTACT_ANCHOR);
        if (!target) return;
        e.preventDefault();
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        const box = target.querySelector<HTMLElement>('[data-ui-key="portfolio-footer-contact"]');
        if (box) {
          box.dataset.flash = 'on';
          window.setTimeout(() => {
            delete box.dataset.flash;
          }, 1600);
        }
      }}
      data-ui-key="portfolio-header-consult"
      className="focus-visible:ring-ring/50 bg-foreground text-background hover:bg-foreground/90 hidden h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-3 md:inline-flex"
    >
      <MessageCircle aria-hidden className="size-4" />
      {t('public.ctaLink')}
    </a>
  );
}
