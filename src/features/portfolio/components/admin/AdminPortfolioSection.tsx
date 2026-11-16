'use client';
// 사이트 관리자 콘솔 › 업체 상세(ADM-03) › 공개 홈페이지 (CR-PF-20)
//  - 공개 주소·공개 여부·공개 사례 수 (보기)
//  - 홈페이지 이름: 큰 제목과 왼쪽 위 이름. 비우면 업체 이름. 업체는 못 고친다
//  - 대표자·사업자등록번호: 사업자등록증과 맞는지 확인하고 잠그기 / 풀기 (확인 창)
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ExternalLink, Lock, LockOpen } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { FormRow } from '@/shared/ui/form-parts';
import { Input } from '@/shared/ui/input';
import { ToneBadge } from '@/shared/ui/tone-badge';
import type { AdminPortfolio } from '@/features/portfolio/lib/admin';
import { portfolioRoutes } from '@/features/portfolio/routes';
import {
  setPortfolioBusinessLock,
  setPortfolioSiteName,
} from '@/features/portfolio/server/admin-actions';

export function AdminPortfolioSection({
  companyId,
  data,
}: {
  companyId: string;
  data: AdminPortfolio | null;
}) {
  const t = useTranslations('portfolio.admin');
  const te = useTranslations('errors');
  const router = useRouter();
  const [name, setName] = useState(data?.siteName ?? '');
  const [pending, start] = useTransition();

  if (!data) {
    return (
      <p className="text-muted-foreground" data-ui-key="admin-portfolio-none">
        {t('none')}
      </p>
    );
  }
  const changed = name.trim() !== (data.siteName ?? '');
  const save = () =>
    start(async () => {
      const res = await setPortfolioSiteName({ companyId, siteName: name });
      if (res.ok) {
        toast.success(name.trim() ? t('siteNameSaved') : t('siteNameCleared'));
        router.refresh();
      } else toast.error(te(res.error.code));
    });
  const locked = data.businessLockedAt !== null;
  const homePath = portfolioRoutes.home(data.slug);

  return (
    <div className="flex flex-col gap-5" data-ui-key="admin-portfolio">
      <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="text-muted-foreground">{t('address')}</dt>
        <dd className="flex flex-wrap items-center gap-2">
          {data.isPublic ? (
            <a
              href={homePath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
            >
              {homePath}
              <ExternalLink aria-hidden className="size-3.5" />
              <span className="sr-only">{t('newWindow')}</span>
            </a>
          ) : (
            <span>{homePath}</span>
          )}
          <ToneBadge tone={data.isPublic ? 'positive' : 'neutral'} size="sm">
            {data.isPublic ? t('public') : t('private')}
          </ToneBadge>
        </dd>
        <dt className="text-muted-foreground">{t('publicWorks')}</dt>
        <dd data-numeric>{t('worksCount', { count: data.publicWorks })}</dd>
      </dl>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (changed) save();
        }}
      >
        <FormRow
          label={t('siteName')}
          htmlFor="admin-site-name"
          hint={t('siteNameHint', { company: data.companyName })}
        >
          <Input
            id="admin-site-name"
            value={name}
            maxLength={60}
            placeholder={data.companyName}
            onChange={(e) => setName(e.target.value)}
            className="max-w-sm"
            data-ui-key="admin-portfolio-site-name"
          />
        </FormRow>
        <div>
          <Button
            type="submit"
            size="sm"
            disabled={!changed || pending}
            aria-busy={pending}
            data-ui-key="admin-portfolio-site-name-save"
          >
            {t('siteNameSave')}
          </Button>
        </div>
      </form>

      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
        data-ui-key="admin-portfolio-business"
      >
        <div className="min-w-0 text-sm">
          <p className="flex items-center gap-1.5 font-medium">
            {locked ? (
              <Lock aria-hidden className="size-4" />
            ) : (
              <LockOpen aria-hidden className="size-4" />
            )}
            {t('business')}
          </p>
          <p className="text-muted-foreground text-meta">
            {[
              data.businessName,
              data.representative && t('rep', { name: data.representative }),
              data.businessRegNo,
            ]
              .filter(Boolean)
              .join(' · ') || t('businessEmpty')}
          </p>
          <p className="text-muted-foreground text-meta">
            {locked ? t('lockedAt', { date: data.businessLockedAt!.slice(0, 10) }) : t('unlocked')}
          </p>
        </div>
        <ConfirmDialog
          uiKey="admin-portfolio-business-lock"
          destructive={false}
          trigger={locked ? t('unlock') : t('lock')}
          title={locked ? t('unlockConfirm') : t('lockConfirm')}
          body={locked ? t('unlockBody') : t('lockBody')}
          confirmLabel={locked ? t('unlock') : t('lock')}
          successMessage={locked ? t('unlockDone') : t('lockDone')}
          action={() => setPortfolioBusinessLock({ companyId, locked: !locked })}
          onError={(e) => toast.error(te(e.code))}
        />
      </div>
    </div>
  );
}
