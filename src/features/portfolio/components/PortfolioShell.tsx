// 공개 포트폴리오 틀 (PUB-10·11 공통, 관리자 미리보기도 같은 틀)
// 브랜드 토큰(brand.ts)을 이 div 안에만 적용 → 머리(로고·업체명·상담·로그인/마이홈) → 내용 → 바닥(사업자 정보) → 휴대폰 고정 상담
// 레이아웃(layout.tsx)이 그리므로 목록↔상세 이동 때 머리·바닥은 다시 그리지 않는다.
import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/shared/lib/utils';
import { brandStyle, fontStyle, serif } from '../brand';
import type { PortfolioCompany } from '../lib/parse';
import { publicImageUrl } from '../routes';
import { PortfolioConsultScroll } from './PortfolioConsultScroll';
import { PortfolioContactBar } from './PortfolioContact';
import { PortfolioFooter } from './PortfolioFooter';

export function PortfolioShell({
  company,
  homeHref,
  banner,
  fontClassName,
  contactBar = true,
  account,
  children,
}: {
  company: PortfolioCompany;
  homeHref: string;
  /** 관리자 미리보기 띠 등 (머리 위) */
  banner?: ReactNode;
  /** next/font 가 만든 글꼴 변수 클래스 (font.ts brandFontClass) */
  fontClassName?: string;
  /** 휴대폰 아래 고정 상담 버튼 (미리보기는 앱 아래 탭과 겹치므로 끈다) */
  contactBar?: boolean;
  /** 머리 오른쪽 끝: 로그인 / 마이홈 / 관리 페이지 (공개 페이지만, 미리보기는 없음) */
  account?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        ...brandStyle(company.pageTone),
        ...fontStyle(company.titleFont, company.bodyFont, company.titleWeight),
      }}
      className={cn('min-h-dvh [word-break:keep-all]', fontClassName)}
      data-ui-key="portfolio-shell"
      data-tone={company.pageTone}
      data-title-font={company.titleFont ?? 'serif'}
      data-body-font={company.bodyFont ?? 'pretendard'}
    >
      {banner}
      <header className="border-border border-b">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-3 px-5 md:h-[72px] md:px-10">
          <Link
            href={homeHref}
            className="focus-visible:ring-ring/50 flex min-w-0 items-center gap-2.5 rounded-sm outline-none focus-visible:ring-3"
            data-ui-key="portfolio-home-link"
          >
            {company.logoHidden ? null : company.logoPath ? (
              // eslint-disable-next-line @next/next/no-img-element -- 공개 버킷 주소(로고 공개용 사본)
              <img
                src={publicImageUrl(company.logoPath)}
                alt=""
                width={32}
                height={32}
                className="size-8 rounded-md object-contain"
              />
            ) : (
              <span
                aria-hidden
                className={cn(
                  serif,
                  'bg-foreground text-background grid size-8 place-items-center rounded-md text-sm',
                )}
              >
                {company.name.slice(0, 1)}
              </span>
            )}
            <span className="truncate font-semibold">{company.name}</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {/* 2026-11: 머리 오른쪽은 '상담 신청(누르면 바닥 연락처로) · 로그인(계정)' 두 개만 */}
            {company.contactPhone ||
            company.contactUrl ||
            company.csHours ||
            company.contactEmail ||
            company.snsLinks?.length ? (
              <PortfolioConsultScroll />
            ) : null}
            {account}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1120px] px-5 md:px-10">{children}</div>
      {/* 바닥 칸은 화면 끝까지 칠한다 (안쪽 폭은 본문과 같음) */}
      <PortfolioFooter company={company} />
      {contactBar ? <PortfolioContactBar company={company} /> : null}
    </div>
  );
}
