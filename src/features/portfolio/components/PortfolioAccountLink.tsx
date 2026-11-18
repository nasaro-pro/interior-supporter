'use client';
// 공개 포트폴리오 머리 오른쪽 끝 (2026-11) — 로그인 안 함: '로그인' 버튼 / 로그인함: 사람 아이콘 → 이름 · 마이페이지(관리 페이지 · 내 작업 화면) · 로그아웃
// 이 업체와 관계 없는 계정도 메뉴를 보여 준다 — 로그아웃하고 다른 계정으로 바꿔 들어올 수 있게
// 마이페이지 · 관리 페이지 주소는 언제나 /c/{slug}/my 하나: 받는 쪽이 로그인 상태와 관계를 다시 확인해서 보낸다 (문구는 안내일 뿐 권한이 아니다)
// 로그아웃하면 이 메인페이지에 그대로 머문다 (logout({ next }))
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CircleUserRound, House, LayoutDashboard, LogIn, LogOut } from 'lucide-react';
import { logout } from '@/features/core/server/session-actions';
import { cn } from '@/shared/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import type { ViewerLabel } from '../lib/viewer';
import { portfolioRoutes } from '../routes';
import { getPortfolioAccount } from '../server/viewer-actions';

export function PortfolioAccountLink({ slug }: { slug: string }) {
  const t = useTranslations('portfolio.account');
  const tc = useTranslations('common.nav');
  const pathname = usePathname();
  const [account, setAccount] = useState<{ label: ViewerLabel; name: string | null }>({
    label: 'login',
    name: null,
  });
  const [, start] = useTransition();
  useEffect(() => {
    let alive = true;
    getPortfolioAccount(slug)
      .then((a) => alive && setAccount(a))
      .catch(() => undefined); // 실패하면 '로그인' 그대로
    return () => {
      alive = false;
    };
  }, [slug]);

  if (account.label === 'login') {
    return (
      <Link
        href={portfolioRoutes.my(slug)}
        prefetch={false}
        className="focus-visible:ring-ring/50 bg-card hover:bg-muted inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium outline-none focus-visible:ring-3"
        data-ui-key="portfolio-account-link"
        data-state="login"
      >
        <LogIn aria-hidden className="size-4" />
        {t('login')}
      </Link>
    );
  }
  const Go = account.label === 'myHome' ? House : LayoutDashboard; // 관리 페이지 · 내 작업 화면
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={tc('account')}
        className={cn(
          'focus-visible:ring-ring/50 hover:bg-muted grid size-9 shrink-0 place-items-center rounded-md outline-none focus-visible:ring-3',
        )}
        data-ui-key="portfolio-account-menu"
        data-state={account.label}
      >
        <CircleUserRound aria-hidden className="size-6 stroke-[1.75]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {account.name ? (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>{account.name}</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem
          render={
            <Link
              href={portfolioRoutes.my(slug)}
              prefetch={false}
              data-ui-key="portfolio-account-link"
            />
          }
        >
          <Go aria-hidden />
          {t(account.label)}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => start(() => logout({ next: pathname }))}
          data-ui-key="portfolio-logout"
        >
          <LogOut aria-hidden />
          {tc('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
