'use client';
// PM-65 공개 페이지 설정 — 공개 켜기, 주소 복사·미리보기, 소개·연락처, 분위기 7종, 대표 사례 수(1~6), 사업자 정보
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Copy, ExternalLink, Link2, Lock, Plus, X } from 'lucide-react';
import { canHide, LABEL_KEYS, LABEL_MAX } from '@/features/portfolio/lib/labels';
import { LogoField } from './LogoField';
import { Button } from '@/shared/ui/button';
import { ButtonLink } from '@/shared/ui/button-link';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { FormRow } from '@/shared/ui/form-parts';
import { SwitchField } from '@/shared/ui/switch-field';
import { ActionError } from '@/shared/ui/action-error';
import { cn } from '@/shared/lib/utils';
import type { AppError } from '@/shared/contracts/errors';
import { FEATURED_LIMIT_MAX, WORKS_LAYOUTS, type WorksLayout } from '@/features/portfolio/lib/grid';
import {
  BODY_FONTS,
  FONT_STACK,
  FOOTER_TONES,
  PORTFOLIO_TONES,
  TITLE_FONTS,
  TITLE_WEIGHTS,
  TONE_HEX,
  footerColors,
} from '@/features/portfolio/brand';
import { checkSns, SNS_MAX } from '@/features/portfolio/lib/sns';
import { portfolioRoutes } from '@/features/portfolio/routes';
import { updatePortfolioSettings } from '@/features/portfolio/server/actions';
import type { ManageSettings } from '@/features/portfolio/server/manage-queries';

const nil = (s: string) => (s.trim() === '' ? null : s.trim());

export function PortfolioSettingsForm({
  companyId,
  slug,
  value,
  featuredCount,
}: {
  companyId: string;
  slug: string;
  value: ManageSettings;
  featuredCount: number;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [v, setV] = useState(value);
  const [error, setError] = useState<AppError | null>(null);
  const [device, setDevice] = useState<'pc' | 'mobile'>('pc');
  const [saving, start] = useTransition();
  const fe = error?.fieldErrors;
  const set = <K extends keyof ManageSettings>(k: K, x: ManageSettings[K]) =>
    setV((p) => ({ ...p, [k]: x }));
  const publicPath = portfolioRoutes.home(slug);

  const save = () =>
    start(async () => {
      setError(null);
      const res = await updatePortfolioSettings({
        companyId,
        baseVersion: value.version,
        isPublic: v.isPublic,
        intro: v.intro,
        contactPhone: nil(v.contactPhone ?? ''),
        contactUrl: nil(v.contactUrl ?? ''),
        pageTone: v.pageTone,
        featuredLimit: v.featuredLimit,
        businessName: v.businessName,
        representative: v.representative,
        businessRegNo: nil(v.businessRegNo ?? ''),
        address: v.address,
        csHours: v.csHours,
        footerSlogan: v.footerSlogan,
        contactEmail: nil(v.contactEmail ?? ''),
        mailOrderNo: nil(v.mailOrderNo ?? ''),
        snsLinks: v.snsLinks,
        footerTone: v.footerTone,
        worksLayout: v.worksLayout,
        galleryFilter: v.galleryFilter,
        carouselPer: v.carouselPer,
        titleFont: v.titleFont,
        titleWeight: v.titleWeight,
        bodyFont: v.bodyFont,
        mobileWorksLayout: v.mobileWorksLayout,
        mobileGalleryCols: v.mobileGalleryCols,
        pageLabels: v.labels,
        logoHidden: v.logoHidden,
      });
      if (res.ok) {
        toast.success(t('portfolio.manage.saved'));
        router.refresh();
      } else setError(res.error);
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${publicPath}`);
      toast.success(t('portfolio.manage.copied'));
    } catch {
      toast.error(t('portfolio.manage.copyFailed'));
    }
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      data-ui-key="portfolio-settings-form"
    >
      <ActionError error={error} onReload={() => setError(null)} />
      <SwitchField
        id="pf-public"
        label={t('portfolio.manage.isPublic')}
        description={t('portfolio.manage.isPublicHint')}
        checked={v.isPublic}
        onCheckedChange={(c: boolean) => set('isPublic', c)}
        uiKey="portfolio-settings-public"
      />

      <FormRow label={t('portfolio.manage.publicAddress')} htmlFor="pf-address-url">
        <div className="flex flex-wrap gap-2">
          <Input
            id="pf-address-url"
            readOnly
            value={publicPath}
            className="bg-muted min-w-0 flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={copy}
            data-ui-key="portfolio-settings-copy"
          >
            <Copy aria-hidden />
            {t('portfolio.manage.copy')}
          </Button>
          <ButtonLink
            href={portfolioRoutes.preview(slug)}
            variant="outline"
            data-ui-key="portfolio-settings-preview"
          >
            <ExternalLink aria-hidden />
            {t('portfolio.manage.preview')}
          </ButtonLink>
        </div>
      </FormRow>

      {/* 이름 · 로고 — 이름은 사이트 관리자만 (보기만), 로고는 첨부하면 바로 적용 */}
      <fieldset className="flex flex-col gap-4" data-ui-key="portfolio-settings-identity">
        <legend className="mb-1.5 text-sm font-medium">
          {t('portfolio.manage.identity.title')}
        </legend>
        <div className="flex flex-col gap-1">
          <span className="text-sm">{t('portfolio.manage.identity.siteName')}</span>
          <p
            className="bg-muted flex items-center gap-2 rounded-md px-3 py-2 text-sm"
            data-ui-key="portfolio-settings-site-name"
          >
            <Lock aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
            <span className="font-semibold">{value.siteName ?? value.companyName}</span>
          </p>
          <p className="text-muted-foreground text-meta">
            {t('portfolio.manage.identity.siteNameHint')}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm">{t('portfolio.manage.identity.logo')}</span>
          <LogoField
            companyId={companyId}
            name={value.siteName ?? value.companyName}
            customLogoPath={value.customLogoPath}
            companyLogoPath={value.companyLogoPath}
            hidden={v.logoHidden}
            onHiddenChange={(h) => set('logoHidden', h)}
          />
        </div>
      </fieldset>

      <FormRow
        label={t('portfolio.manage.intro')}
        htmlFor="pf-intro"
        errors={fe?.intro}
        hint={`${v.intro.length}/300`}
      >
        <Textarea
          id="pf-intro"
          value={v.intro}
          maxLength={300}
          rows={2}
          onChange={(e) => set('intro', e.target.value)}
        />
      </FormRow>

      {/* 작은 문구 — 비우면 기본 문구, '숨기기' 로 칸을 뺀다 ('시공 사례' 제목은 숨길 수 없음) */}
      <fieldset className="flex flex-col gap-3" data-ui-key="portfolio-settings-labels">
        <legend className="mb-1 text-sm font-medium">{t('portfolio.manage.labels.title')}</legend>
        <p className="text-muted-foreground text-meta -mt-1">{t('portfolio.manage.labels.hint')}</p>
        {LABEL_KEYS.map((k) => {
          const cur = v.labels[k];
          const hidden = cur === false;
          const id = `pf-label-${k}`;
          return (
            <div
              key={k}
              className="grid gap-1.5 sm:grid-cols-[11rem_1fr_auto] sm:items-center sm:gap-3"
            >
              <label htmlFor={id} className="text-sm">
                {t(`portfolio.manage.labels.${k}`)}
              </label>
              <Input
                id={id}
                value={typeof cur === 'string' ? cur : ''}
                placeholder={t(`portfolio.manage.labels.default.${k}`)}
                maxLength={LABEL_MAX[k]}
                disabled={hidden}
                onChange={(e) => set('labels', { ...v.labels, [k]: e.target.value })}
                aria-describedby={`${id}-hint`}
              />
              {canHide(k) ? (
                <label className="flex items-center gap-1.5 text-sm whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={hidden}
                    onChange={(e) => {
                      const next = { ...v.labels };
                      if (e.target.checked) next[k] = false;
                      else delete next[k];
                      set('labels', next);
                    }}
                    data-ui-key="portfolio-settings-label-hide"
                  />
                  {t('portfolio.manage.labels.hide')}
                </label>
              ) : (
                <span />
              )}
              <span id={`${id}-hint`} className="sr-only">
                {t('portfolio.manage.labels.defaultIs', {
                  text: t(`portfolio.manage.labels.default.${k}`),
                })}
              </span>
            </div>
          );
        })}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow
          label={t('portfolio.manage.contactPhone')}
          htmlFor="pf-phone"
          errors={fe?.contactPhone}
        >
          <Input
            id="pf-phone"
            inputMode="tel"
            value={v.contactPhone ?? ''}
            onChange={(e) => set('contactPhone', e.target.value)}
          />
        </FormRow>
        <FormRow
          label={t('portfolio.manage.contactUrl')}
          htmlFor="pf-url"
          errors={fe?.contactUrl}
          hint={t('errors.field.httpsOnly')}
        >
          <Input
            id="pf-url"
            type="url"
            placeholder="https://"
            value={v.contactUrl ?? ''}
            onChange={(e) => set('contactUrl', e.target.value)}
          />
        </FormRow>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">{t('portfolio.manage.pageTone')}</legend>
        <div
          role="radiogroup"
          aria-label={t('portfolio.manage.pageTone')}
          className="flex flex-wrap gap-3"
        >
          {PORTFOLIO_TONES.map((tone) => (
            <button
              key={tone}
              type="button"
              role="radio"
              aria-checked={v.pageTone === tone}
              onClick={() => set('pageTone', tone)}
              data-ui-key="portfolio-settings-tone"
              className="focus-visible:ring-ring/50 flex flex-col items-center gap-1.5 rounded-md text-xs outline-none focus-visible:ring-3"
            >
              <span
                className={cn(
                  'size-11 rounded-md border',
                  v.pageTone === tone && 'ring-foreground ring-2 ring-offset-2',
                )}
                style={{ background: TONE_HEX[tone].canvas }}
              />
              <span className={v.pageTone === tone ? 'font-semibold' : 'text-muted-foreground'}>
                {t(`portfolio.manage.tone.${tone}`)}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* 글꼴 — 제목·본문 따로 (PC·휴대폰 같음). 견본은 그 글꼴로 그린다 (설정 페이지가 brandFontClass 를 붙임) */}
      <fieldset className="flex flex-col gap-4" data-ui-key="portfolio-settings-font">
        <legend className="mb-1.5 text-sm font-medium">{t('portfolio.manage.font.title')}</legend>
        {(
          [
            [
              'titleFont',
              TITLE_FONTS,
              t('portfolio.manage.font.titleLabel'),
              t('portfolio.manage.font.titleSample'),
            ],
            [
              'bodyFont',
              BODY_FONTS,
              t('portfolio.manage.font.bodyLabel'),
              t('portfolio.manage.font.bodySample'),
            ],
          ] as const
        ).map(([key, list, label, sample]) => (
          <div key={key} className="flex flex-col gap-1.5">
            <span className="text-sm" id={`pf-${key}-label`}>
              {label}
            </span>
            <div
              role="radiogroup"
              aria-labelledby={`pf-${key}-label`}
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {list.map((f) => {
                const on = v[key] === f;
                return (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set(key, f as never)}
                    data-ui-key="portfolio-settings-font-option"
                    className={cn(
                      'focus-visible:ring-ring/50 flex flex-col items-start gap-1 rounded-md border px-3 py-2.5 text-left outline-none focus-visible:ring-3',
                      on ? 'border-foreground ring-foreground ring-1' : 'hover:bg-muted',
                    )}
                  >
                    <span
                      aria-hidden
                      className="truncate text-lg leading-tight"
                      style={{
                        fontFamily: FONT_STACK[f],
                        fontWeight: key === 'titleFont' ? v.titleWeight : 400,
                      }}
                    >
                      {sample}
                    </span>
                    <span
                      className={cn('text-meta', on ? 'font-semibold' : 'text-muted-foreground')}
                    >
                      {t(`portfolio.manage.font.${f}`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm" id="pf-weight-label">
            {t('portfolio.manage.font.weightLabel')}
          </span>
          <div
            role="radiogroup"
            aria-labelledby="pf-weight-label"
            className="grid grid-cols-3 gap-2 sm:w-max sm:grid-cols-[repeat(3,minmax(9rem,auto))]"
          >
            {TITLE_WEIGHTS.map((w) => {
              const on = v.titleWeight === w;
              return (
                <button
                  key={w}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set('titleWeight', w)}
                  data-ui-key="portfolio-settings-title-weight"
                  className={cn(
                    'focus-visible:ring-ring/50 flex flex-col items-start gap-1 rounded-md border px-3 py-2.5 text-left outline-none focus-visible:ring-3',
                    on ? 'border-foreground ring-foreground ring-1' : 'hover:bg-muted',
                  )}
                >
                  <span
                    aria-hidden
                    className="truncate text-lg leading-tight"
                    style={{ fontFamily: FONT_STACK[v.titleFont], fontWeight: w }}
                  >
                    {t('portfolio.manage.font.titleSample')}
                  </span>
                  <span className={cn('text-meta', on ? 'font-semibold' : 'text-muted-foreground')}>
                    {t(`portfolio.manage.font.weight${w}`)}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-muted-foreground text-meta">{t('portfolio.manage.font.weightHint')}</p>
        </div>
        {v.titleFont === 'system' || v.bodyFont === 'system' ? (
          <p className="text-muted-foreground text-meta">{t('portfolio.manage.font.systemHint')}</p>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">
          {t('portfolio.manage.featuredLimit')}
        </legend>
        <div
          role="radiogroup"
          aria-label={t('portfolio.manage.featuredLimit')}
          className="inline-flex w-max overflow-hidden rounded-md border"
        >
          {Array.from({ length: FEATURED_LIMIT_MAX }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={v.featuredLimit === n}
              onClick={() => set('featuredLimit', n)}
              data-ui-key="portfolio-settings-featured-limit"
              className={cn(
                'focus-visible:ring-ring/50 h-9 w-11 border-r text-sm outline-none last:border-r-0 focus-visible:ring-3 focus-visible:ring-inset',
                v.featuredLimit === n
                  ? 'bg-foreground text-background font-semibold'
                  : 'bg-card hover:bg-muted',
              )}
              data-numeric
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-meta">{t('portfolio.manage.featuredLimitHint')}</p>
        {featuredCount > v.featuredLimit ? (
          <p role="status" className="text-tone-attention-fg text-meta">
            {t('portfolio.manage.featuredLimitOver', {
              count: featuredCount,
              limit: v.featuredLimit,
            })}
          </p>
        ) : null}
      </fieldset>

      {/* 시공 사례 배열 — [PC | 휴대폰] 따로. 휴대폰 기본은 'PC와 같게'(null) */}
      <fieldset className="flex flex-col gap-3" data-ui-key="portfolio-settings-layout">
        <legend className="mb-1.5 text-sm font-medium">{t('portfolio.manage.layout.title')}</legend>
        <div
          role="tablist"
          aria-label={t('portfolio.manage.layout.device')}
          className="bg-muted inline-flex w-max gap-1 rounded-md p-1"
        >
          {(['pc', 'mobile'] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              id={`pf-dev-${d}`}
              aria-selected={device === d}
              aria-controls="pf-dev-panel"
              onClick={() => setDevice(d)}
              data-ui-key="portfolio-settings-device"
              className={cn(
                'focus-visible:ring-ring/50 h-8 rounded px-4 text-sm outline-none focus-visible:ring-3',
                device === d
                  ? 'bg-card font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`portfolio.manage.layout.${d}`)}
              {d === 'mobile' ? (
                <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                  {v.mobileWorksLayout
                    ? t(`portfolio.manage.layout.${v.mobileWorksLayout}`)
                    : t('portfolio.manage.layout.sameAsPc')}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div
          id="pf-dev-panel"
          role="tabpanel"
          aria-labelledby={`pf-dev-${device}`}
          className="flex flex-col gap-3"
        >
          {device === 'pc' ? (
            <>
              <div
                role="radiogroup"
                aria-label={t('portfolio.manage.layout.title')}
                className="grid gap-3 sm:grid-cols-3"
              >
                {WORKS_LAYOUTS.map((l) => {
                  const on = v.worksLayout === l;
                  return (
                    <button
                      key={l}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set('worksLayout', l)}
                      data-ui-key="portfolio-settings-layout-option"
                      className={cn(
                        'focus-visible:ring-ring/50 flex items-center gap-3 rounded-md border p-3 text-left outline-none focus-visible:ring-3',
                        on ? 'border-foreground ring-foreground ring-1' : 'hover:bg-muted',
                      )}
                    >
                      <LayoutIcon kind={l} />
                      <span className="min-w-0">
                        <span className={cn('block text-sm', on && 'font-semibold')}>
                          {t(`portfolio.manage.layout.${l}`)}
                        </span>
                        <span className="text-muted-foreground text-meta block">
                          {t(`portfolio.manage.layout.${l}Hint`)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {v.worksLayout === 'list' ? null : v.worksLayout === 'gallery' ? (
                <SwitchField
                  id="pf-gallery-filter"
                  label={t('portfolio.manage.layout.filter')}
                  description={t('portfolio.manage.layout.filterHint')}
                  checked={v.galleryFilter}
                  onCheckedChange={(c: boolean) => set('galleryFilter', c)}
                  uiKey="portfolio-settings-gallery-filter"
                />
              ) : (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium" id="pf-per-label">
                    {t('portfolio.manage.layout.per')}
                  </span>
                  <div
                    role="radiogroup"
                    aria-labelledby="pf-per-label"
                    className="inline-flex w-max overflow-hidden rounded-md border"
                  >
                    {([3, 4] as const).map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={v.carouselPer === n}
                        onClick={() => set('carouselPer', n)}
                        data-ui-key="portfolio-settings-carousel-per"
                        className={cn(
                          'focus-visible:ring-ring/50 h-9 border-r px-4 text-sm outline-none last:border-r-0 focus-visible:ring-3 focus-visible:ring-inset',
                          v.carouselPer === n
                            ? 'bg-foreground text-background font-semibold'
                            : 'bg-card hover:bg-muted',
                        )}
                      >
                        {t('portfolio.manage.layout.perN', { n })}
                      </button>
                    ))}
                  </div>
                  <span className="text-muted-foreground text-meta">
                    {t('portfolio.manage.layout.perHint')}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <div
                role="radiogroup"
                aria-label={t('portfolio.manage.layout.mobileTitle')}
                className="grid gap-3 sm:grid-cols-2"
              >
                {([null, ...WORKS_LAYOUTS] as const).map((l) => {
                  const on = v.mobileWorksLayout === l;
                  return (
                    <button
                      key={l ?? 'same'}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set('mobileWorksLayout', l)}
                      data-ui-key="portfolio-settings-mobile-layout"
                      className={cn(
                        'focus-visible:ring-ring/50 flex items-center gap-3 rounded-md border p-3 text-left outline-none focus-visible:ring-3',
                        on ? 'border-foreground ring-foreground ring-1' : 'hover:bg-muted',
                      )}
                    >
                      {l ? (
                        <LayoutIcon kind={l} />
                      ) : (
                        <Link2 aria-hidden className="text-muted-foreground size-6 shrink-0" />
                      )}
                      <span className="min-w-0">
                        <span className={cn('block text-sm', on && 'font-semibold')}>
                          {l
                            ? t(`portfolio.manage.layout.${l}`)
                            : t('portfolio.manage.layout.sameAsPc')}
                        </span>
                        <span className="text-muted-foreground text-meta block">
                          {l
                            ? t(`portfolio.manage.layout.${l}Hint`)
                            : t('portfolio.manage.layout.sameAsPcHint', {
                                layout: t(`portfolio.manage.layout.${v.worksLayout}`),
                              })}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {(v.mobileWorksLayout ?? v.worksLayout) === 'gallery' ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium" id="pf-cols-label">
                    {t('portfolio.manage.layout.cols')}
                  </span>
                  <div
                    role="radiogroup"
                    aria-labelledby="pf-cols-label"
                    className="inline-flex w-max overflow-hidden rounded-md border"
                  >
                    {([1, 2] as const).map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={v.mobileGalleryCols === n}
                        onClick={() => set('mobileGalleryCols', n)}
                        data-ui-key="portfolio-settings-mobile-cols"
                        className={cn(
                          'focus-visible:ring-ring/50 h-9 border-r px-4 text-sm outline-none last:border-r-0 focus-visible:ring-3 focus-visible:ring-inset',
                          v.mobileGalleryCols === n
                            ? 'bg-foreground text-background font-semibold'
                            : 'bg-card hover:bg-muted',
                        )}
                      >
                        {t(`portfolio.manage.layout.cols${n}`)}
                      </button>
                    ))}
                  </div>
                  <span className="text-muted-foreground text-meta">
                    {t('portfolio.manage.layout.filterShared')}
                  </span>
                </div>
              ) : (v.mobileWorksLayout ?? v.worksLayout) === 'carousel' ? (
                <span className="text-muted-foreground text-meta">
                  {t('portfolio.manage.layout.mobileCarouselHint')}
                </span>
              ) : null}
            </>
          )}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t pt-5">
        <legend className="sr-only">{t('portfolio.manage.footerSection')}</legend>
        <div>
          <p className="text-sm font-semibold">{t('portfolio.manage.footerSection')}</p>
          <p className="text-muted-foreground text-meta">{t('portfolio.manage.footerHint')}</p>
        </div>
        {v.businessLocked ? (
          <p
            id="pf-biz-lock"
            className="bg-muted text-muted-foreground text-meta flex items-start gap-2 rounded-md px-3 py-2"
            data-ui-key="portfolio-settings-business-locked"
          >
            <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {t('portfolio.manage.businessLocked')}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow
            label={t('portfolio.manage.businessName')}
            htmlFor="pf-bn"
            errors={fe?.businessName}
          >
            <Input
              id="pf-bn"
              value={v.businessName}
              onChange={(e) => set('businessName', e.target.value)}
            />
          </FormRow>
          <FormRow
            label={t('portfolio.manage.representative')}
            htmlFor="pf-rep"
            errors={fe?.representative}
          >
            <Input
              id="pf-rep"
              value={v.representative}
              onChange={(e) => set('representative', e.target.value)}
              readOnly={v.businessLocked}
              aria-describedby={v.businessLocked ? 'pf-biz-lock' : undefined}
              className={cn(v.businessLocked && 'bg-muted text-muted-foreground')}
            />
          </FormRow>
          <FormRow
            label={t('portfolio.manage.businessRegNo')}
            htmlFor="pf-brn"
            errors={fe?.businessRegNo}
          >
            <Input
              id="pf-brn"
              placeholder="000-00-00000"
              value={v.businessRegNo ?? ''}
              onChange={(e) => set('businessRegNo', e.target.value)}
              readOnly={v.businessLocked}
              aria-describedby={v.businessLocked ? 'pf-biz-lock' : undefined}
              className={cn(v.businessLocked && 'bg-muted text-muted-foreground')}
            />
          </FormRow>
          <FormRow label={t('portfolio.manage.csHours')} htmlFor="pf-hours" errors={fe?.csHours}>
            <Input
              id="pf-hours"
              value={v.csHours}
              onChange={(e) => set('csHours', e.target.value)}
            />
          </FormRow>
        </div>
        <FormRow label={t('portfolio.manage.address')} htmlFor="pf-addr" errors={fe?.address}>
          <Input id="pf-addr" value={v.address} onChange={(e) => set('address', e.target.value)} />
        </FormRow>
        <FormRow
          label={t('portfolio.manage.footer.mailOrderNo')}
          htmlFor="pf-mail"
          errors={fe?.mailOrderNo}
          hint={t('portfolio.manage.footer.optional')}
        >
          <Input
            id="pf-mail"
            maxLength={40}
            placeholder={t('portfolio.manage.footer.mailOrderNoPlaceholder')}
            value={v.mailOrderNo ?? ''}
            onChange={(e) => set('mailOrderNo', e.target.value)}
          />
        </FormRow>
      </fieldset>

      {/* 바닥 칸 — 비운 칸은 공개 페이지에서 안 보인다 */}
      <fieldset
        className="flex flex-col gap-4 border-t pt-5"
        data-ui-key="portfolio-settings-footer"
      >
        <legend className="sr-only">{t('portfolio.manage.footer.title')}</legend>
        <div>
          <p className="text-sm font-semibold">{t('portfolio.manage.footer.title')}</p>
          <p className="text-muted-foreground text-meta">{t('portfolio.manage.footer.hint')}</p>
        </div>
        <FormRow
          label={t('portfolio.manage.footer.slogan')}
          htmlFor="pf-slogan"
          errors={fe?.footerSlogan}
          hint={t('portfolio.manage.footer.sloganHint')}
        >
          <Input
            id="pf-slogan"
            maxLength={60}
            placeholder={t('portfolio.manage.footer.sloganPlaceholder')}
            value={v.footerSlogan}
            onChange={(e) => set('footerSlogan', e.target.value)}
          />
        </FormRow>
        <FormRow
          label={t('portfolio.manage.footer.email')}
          htmlFor="pf-email"
          errors={fe?.contactEmail}
        >
          <Input
            id="pf-email"
            type="email"
            inputMode="email"
            maxLength={120}
            placeholder="hello@example.com"
            value={v.contactEmail ?? ''}
            onChange={(e) => set('contactEmail', e.target.value)}
          />
        </FormRow>

        <div className="flex flex-col gap-2" role="group" aria-labelledby="pf-sns-label">
          <p id="pf-sns-label" className="text-sm font-medium">
            {t('portfolio.manage.footer.sns')}{' '}
            <span className="text-muted-foreground font-normal" data-numeric>
              {v.snsLinks.length}/{SNS_MAX}
            </span>
          </p>
          <p className="text-muted-foreground text-meta">{t('portfolio.manage.footer.snsHint')}</p>
          {v.snsLinks.map((u, i) => {
            const r = u.trim() ? checkSns(u) : null;
            const err = r && !r.ok ? t(`portfolio.manage.footer.snsError.${r.error}`) : null;
            return (
              <div key={i} className="grid grid-cols-[1fr_auto] items-start gap-2">
                <div>
                  <Input
                    aria-label={t('portfolio.manage.footer.snsN', { n: i + 1 })}
                    aria-invalid={err ? true : undefined}
                    aria-describedby={`pf-sns-${i}-note`}
                    placeholder="https://instagram.com/…"
                    maxLength={300}
                    value={u}
                    onChange={(e) =>
                      set(
                        'snsLinks',
                        v.snsLinks.map((x, k) => (k === i ? e.target.value : x)),
                      )
                    }
                  />
                  <p
                    id={`pf-sns-${i}-note`}
                    className={cn(
                      'text-meta mt-1',
                      err ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {err ?? (r && r.ok ? t(`portfolio.public.footer.sns.${r.kind}`) : '')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('portfolio.manage.footer.snsRemove', { n: i + 1 })}
                  onClick={() =>
                    set(
                      'snsLinks',
                      v.snsLinks.filter((_, k) => k !== i),
                    )
                  }
                >
                  <X aria-hidden />
                </Button>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-max"
            disabled={v.snsLinks.length >= SNS_MAX}
            onClick={() => set('snsLinks', [...v.snsLinks, ''])}
            data-ui-key="portfolio-settings-sns-add"
          >
            <Plus aria-hidden />
            {t('portfolio.manage.footer.snsAdd')}
          </Button>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">
            {t('portfolio.manage.footer.tone')}
          </legend>
          <div
            role="radiogroup"
            aria-label={t('portfolio.manage.footer.tone')}
            className="flex flex-wrap gap-3"
          >
            {FOOTER_TONES.map((ft) => {
              const c = footerColors(v.pageTone, ft);
              const on = v.footerTone === ft;
              return (
                <button
                  key={ft}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set('footerTone', ft)}
                  data-ui-key="portfolio-settings-footer-tone"
                  className="focus-visible:ring-ring/50 flex flex-col items-center gap-1.5 rounded-md text-xs outline-none focus-visible:ring-3"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'grid h-11 w-16 place-items-center rounded-md border text-[11px]',
                      on && 'ring-foreground ring-2 ring-offset-2',
                    )}
                    style={{
                      background: c.bg,
                      color: c.fg,
                      borderColor: c.topLine === 'transparent' ? 'transparent' : c.topLine,
                    }}
                  >
                    가나다
                  </span>
                  <span className={on ? 'font-semibold' : 'text-muted-foreground'}>
                    {t(`portfolio.manage.footer.toneName.${ft}`)}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-muted-foreground text-meta">{t('portfolio.manage.footer.toneHint')}</p>
        </fieldset>
      </fieldset>

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="outline"
          disabled={saving}
          aria-busy={saving}
          data-ui-key="portfolio-settings-submit"
        >
          {saving ? t('portfolio.manage.saving') : t('portfolio.manage.save')}
        </Button>
      </div>
    </form>
  );
}

/** 배열 선택지 그림 — 갤러리(격자) / 가로 넘김(한 줄 + 진행 막대) / 목록형(넓은 사진 + 한 줄) */
function LayoutIcon({ kind }: { kind: WorksLayout }) {
  if (kind === 'list')
    return (
      <svg viewBox="0 0 48 36" aria-hidden className="text-muted-foreground h-9 w-12 shrink-0">
        <rect x="2" y="2" width="44" height="13" rx="1" fill="currentColor" opacity=".35" />
        <rect x="2" y="17" width="20" height="1.5" fill="currentColor" />
        <rect x="34" y="17" width="12" height="1.5" fill="currentColor" opacity=".5" />
        <rect x="2" y="21" width="44" height="13" rx="1" fill="currentColor" opacity=".35" />
      </svg>
    );
  return kind === 'gallery' ? (
    <svg viewBox="0 0 48 36" aria-hidden className="text-muted-foreground h-9 w-12 shrink-0">
      {[0, 1, 2].map((c) =>
        [0, 1].map((r) => (
          <rect
            key={`${c}${r}`}
            x={2 + c * 15}
            y={2 + r * 17}
            width="13"
            height="15"
            rx="1"
            fill="currentColor"
            opacity=".35"
          />
        )),
      )}
    </svg>
  ) : (
    <svg viewBox="0 0 48 36" aria-hidden className="text-muted-foreground h-9 w-12 shrink-0">
      {[0, 1, 2].map((c) => (
        <rect
          key={c}
          x={2 + c * 14}
          y="6"
          width="12"
          height="18"
          rx="1"
          fill="currentColor"
          opacity=".35"
        />
      ))}
      <rect x="44" y="6" width="4" height="18" rx="1" fill="currentColor" opacity=".18" />
      <rect x="2" y="30" width="16" height="1.5" fill="currentColor" />
      <rect x="18" y="30" width="28" height="1" fill="currentColor" opacity=".3" />
    </svg>
  );
}
