'use client';
// 포트폴리오 권한 (프로젝트 생성 권한 create-permission.tsx 와 같은 방식)
//  - 업체관리자: 구성원 표에서 담당자별 단계 고르기(없음 / 사례 올리기 / 전체 관리), 대기 요청 승인·거절
//  - 담당자: 포트폴리오 탭에서 권한 요청 (지금보다 높은 단계만)
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Check, Clock, KeyRound, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { useActionErrorText } from '@/shared/ui/action-error';
import { PORTFOLIO_LEVELS, requestableLevels, type PortfolioLevel } from '../lib/access';
import {
  decidePortfolioAccess,
  requestPortfolioAccess,
  setPortfolioAccess,
} from '../server/permission-actions';

/** 업체관리자: 담당자 한 명의 포트폴리오 단계 */
export function PortfolioAccessSelect({
  companyId,
  memberId,
  level,
  name,
}: {
  companyId: string;
  memberId: string;
  level: PortfolioLevel;
  name: string;
}) {
  const t = useTranslations('portfolio.permission');
  const router = useRouter();
  const errorText = useActionErrorText();
  const [value, setValue] = useState(level);
  const [synced, setSynced] = useState(level);
  if (synced !== level) {
    setSynced(level);
    setValue(level);
  }
  const [busy, start] = useTransition();
  const choose = (next: PortfolioLevel) => {
    if (next === value || busy) return;
    start(async () => {
      const res = await setPortfolioAccess({ companyId, memberId, level: next });
      if (!res.ok) {
        toast.error(errorText(res.error)); // 실패 → 서버 값 그대로
        return;
      }
      setValue(next);
      toast.success(t('changed', { name, level: t(`level.${next}`) }));
      router.refresh();
    });
  };
  // 2026-11 구성원 표 개선: 드롭다운 대신 3칸 버튼 묶음 (고른 칸 = 흰 바탕 + ✓). 방향키로 옮겨 다닐 수 있는 라디오 묶음
  return (
    <div
      role="radiogroup"
      aria-label={t('levelFor', { name })}
      aria-busy={busy}
      className="bg-muted inline-flex rounded-lg p-0.5 text-[13px]"
      data-ui-key="member-portfolio-access"
      data-value={value}
    >
      {PORTFOLIO_LEVELS.map((l, i) => {
        const on = l === value;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={busy}
            onClick={() => choose(l)}
            onKeyDown={(e) => {
              const step =
                e.key === 'ArrowRight' || e.key === 'ArrowDown'
                  ? 1
                  : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                    ? -1
                    : 0;
              if (!step) return;
              e.preventDefault();
              const next =
                PORTFOLIO_LEVELS[(i + step + PORTFOLIO_LEVELS.length) % PORTFOLIO_LEVELS.length]!;
              choose(next);
              (
                e.currentTarget.parentElement?.children[PORTFOLIO_LEVELS.indexOf(next)] as
                  HTMLElement | undefined
              )?.focus();
            }}
            className={cn(
              'focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 whitespace-nowrap outline-none focus-visible:ring-2 disabled:opacity-60',
              on
                ? 'bg-background font-medium shadow-[0_1px_2px_rgb(0_0_0/0.08)]'
                : 'text-muted-foreground hover:text-foreground',
            )}
            data-ui-key={`member-portfolio-access-${l}`}
          >
            {on ? <Check aria-hidden className="size-3" /> : null}
            {t(`level.${l}`)}
          </button>
        );
      })}
    </div>
  );
}

/** 업체관리자: 대기 요청 승인·거절 */
export function PortfolioRequestDecision({
  companyId,
  requestId,
  name,
}: {
  companyId: string;
  requestId: string;
  name: string;
}) {
  const t = useTranslations('portfolio.permission');
  const router = useRouter();
  const errorText = useActionErrorText();
  const [busy, start] = useTransition();
  const decide = (approve: boolean) =>
    start(async () => {
      const res = await decidePortfolioAccess({ companyId, requestId, approve });
      if (!res.ok) {
        toast.error(errorText(res.error));
        return;
      }
      toast.success(approve ? t('approved') : t('rejected'));
      router.refresh();
    });
  return (
    <span className="flex gap-1">
      <Button
        size="sm"
        disabled={busy}
        aria-label={t('approveFor', { name })}
        data-ui-key="portfolio-request-approve"
        onClick={() => decide(true)}
      >
        <Check aria-hidden />
        {t('approve')}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        aria-label={t('rejectFor', { name })}
        data-ui-key="portfolio-request-reject"
        onClick={() => decide(false)}
      >
        <X aria-hidden />
        {t('reject')}
      </Button>
    </span>
  );
}

/** 담당자: 권한 요청 (포트폴리오 탭 위쪽) */
export function PortfolioAccessRequest({
  companyId,
  level,
  pending,
}: {
  companyId: string;
  level: PortfolioLevel;
  pending: 'works' | 'full' | null;
}) {
  const t = useTranslations('portfolio.permission');
  const router = useRouter();
  const errorText = useActionErrorText();
  const [busy, start] = useTransition();
  const options = requestableLevels(level);
  if (!options.length) return null;
  const ask = (l: 'works' | 'full') =>
    start(async () => {
      const res = await requestPortfolioAccess({ companyId, level: l, note: '' });
      if (!res.ok) {
        toast.error(errorText(res.error));
        return;
      }
      toast.success(t('requested'));
      router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-2" data-ui-key="portfolio-access-request">
      {pending ? (
        <span
          className="text-muted-foreground text-meta inline-flex items-center gap-1"
          data-ui-key="portfolio-access-pending"
        >
          <Clock aria-hidden className="size-3.5" />
          {t('pending', { level: t(`level.${pending}`) })}
        </span>
      ) : null}
      {options
        .filter((l) => l !== pending)
        .map((l) => (
          <Button
            key={l}
            variant="outline"
            size="sm"
            disabled={busy}
            aria-busy={busy}
            onClick={() => ask(l)}
            data-ui-key={`portfolio-access-request-${l}`}
          >
            <KeyRound aria-hidden />
            {t(`request.${l}`)}
          </Button>
        ))}
    </div>
  );
}
