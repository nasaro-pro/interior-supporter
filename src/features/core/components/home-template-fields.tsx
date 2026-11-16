'use client';
// src/features/core/components/home-template-fields.tsx (A · REQ-014·052, CR-A-10) — 고객 페이지 구성 입력 (PM-63 기본 템플릿 · PM-03 고객 홈 편집 공용)
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, Check } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import type { HomeSections } from '@/shared/contracts/domain';
import { cn } from '@/shared/lib/utils';
import { moveSection } from '../home-sections';
import { HOME_THEMES, HOME_THEME_CLASS, type HomeTheme } from '../home-theme';
import { PAGE_TONES, PAGE_TONE_SWATCH, type PageTone } from '../page-theme';
import {
  CUSTOMER_TITLE_CLASS,
  CUSTOMER_TITLE_FONTS,
  CUSTOMER_TITLE_WEIGHTS,
  customerTitleVars,
  type CustomerTitleFont,
  type CustomerTitleWeight,
} from '../customer-style';

/** 4영역 순서(위/아래)·표시 */
export function HomeSectionsField({
  sections,
  onChange,
  label,
}: {
  sections: HomeSections;
  onChange: (next: HomeSections) => void;
  label: string;
}) {
  const t = useTranslations();
  return (
    <ol className="flex flex-col gap-2" aria-label={label}>
      {sections.map((s, i) => (
        <li
          key={s.key}
          data-key={s.key}
          className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
        >
          <span className="font-medium">{t(`projects.homeSection.${s.key}`)}</span>
          <span className="flex items-center gap-1">
            <label className="me-2 inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary size-4"
                checked={s.visible}
                onChange={(e) =>
                  onChange(
                    sections.map((x) =>
                      x.key === s.key ? { ...x, visible: e.target.checked } : x,
                    ),
                  )
                }
                data-ui-key="home-section-visible-toggle"
              />
              {t('projects.home.show')}
            </label>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('projects.home.moveUp')}
              disabled={i === 0}
              onClick={() => onChange(moveSection(sections, i, -1))}
              data-ui-key="home-section-move-up"
            >
              <ArrowUp aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('projects.home.moveDown')}
              disabled={i === sections.length - 1}
              onClick={() => onChange(moveSection(sections, i, 1))}
              data-ui-key="home-section-move-down"
            >
              <ArrowDown aria-hidden />
            </Button>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** 색상 테마 — 네이티브 라디오(방향키 이동) + 토큰 견본 */
export function HomeThemeField({
  name,
  value,
  onChange,
  label,
}: {
  name: string;
  value: HomeTheme;
  onChange: (next: HomeTheme) => void;
  label: string;
}) {
  const t = useTranslations('projects');
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {HOME_THEMES.map((theme) => {
          const checked = theme === value;
          return (
            <label
              key={theme}
              className={cn(
                'focus-within:ring-ring/50 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm focus-within:ring-[3px]',
                checked && 'border-primary',
              )}
            >
              <input
                type="radio"
                name={name}
                value={theme}
                checked={checked}
                onChange={() => onChange(theme)}
                className="sr-only"
                data-ui-key="home-theme-option"
              />
              <span
                aria-hidden
                className={cn(
                  'grid size-5 place-items-center rounded-full border',
                  HOME_THEME_CLASS[theme],
                )}
              >
                {checked ? <Check className="size-3" /> : null}
              </span>
              {t(`homeTheme.${theme}`)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** 페이지 분위기(바탕색) — 네이티브 라디오 + 프리셋 견본 */
export function PageToneField({
  name,
  value,
  onChange,
  label,
  hint,
}: {
  name: string;
  value: PageTone;
  onChange: (next: PageTone) => void;
  label: string;
  hint?: string;
}) {
  const t = useTranslations('projects');
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {PAGE_TONES.map((tone) => {
          const checked = tone === value;
          return (
            <label
              key={tone}
              className={cn(
                'focus-within:ring-ring/50 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm focus-within:ring-[3px]',
                checked && 'border-primary',
              )}
            >
              <input
                type="radio"
                name={name}
                value={tone}
                checked={checked}
                onChange={() => onChange(tone)}
                className="sr-only"
                data-ui-key="page-tone-option"
              />
              <span
                aria-hidden
                className={cn(
                  'text-foreground grid size-5 place-items-center rounded-full border',
                  PAGE_TONE_SWATCH[tone],
                )}
              >
                {checked ? <Check className="size-3" /> : null}
              </span>
              {t(`pageTone.${tone}`)}
            </label>
          );
        })}
      </div>
      {hint ? <p className="text-muted-foreground text-meta">{hint}</p> : null}
    </fieldset>
  );
}

/** 고객 화면 제목 글꼴 · 굵기 — 견본 글자를 그 글꼴 · 굵기로 보여 준다 (공개 홈페이지와 같은 선택지) */
export function TitleStyleField({
  font,
  weight,
  onFont,
  onWeight,
}: {
  font: CustomerTitleFont;
  weight: CustomerTitleWeight;
  onFont: (next: CustomerTitleFont) => void;
  onWeight: (next: CustomerTitleWeight) => void;
}) {
  const t = useTranslations('projects');
  const option = (checked: boolean) =>
    cn(
      'focus-within:ring-ring/50 flex cursor-pointer flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-sm focus-within:ring-[3px]',
      checked && 'border-primary bg-accent',
    );
  return (
    // 명조 견본은 --font-brand-serif 를 쓴다 — 이 칸을 감싸는 화면(개요)이 brandFontClass 를 건다
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">{t('home.titleFontLabel')}</legend>
        <div className="flex flex-wrap gap-2">
          {CUSTOMER_TITLE_FONTS.map((f) => (
            <label key={f} className={option(f === font)}>
              <input
                type="radio"
                name="home-title-font"
                value={f}
                checked={f === font}
                onChange={() => onFont(f)}
                className="sr-only"
                data-ui-key="home-title-font-option"
              />
              <span
                className={cn('text-lg', CUSTOMER_TITLE_CLASS)}
                style={customerTitleVars(f, weight)}
              >
                {t('home.titleSample')}
              </span>
              <span className="text-muted-foreground text-meta">{t(`titleFont.${f}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">{t('home.titleWeightLabel')}</legend>
        <div className="flex flex-wrap gap-2">
          {CUSTOMER_TITLE_WEIGHTS.map((w) => (
            <label key={w} className={option(w === weight)}>
              <input
                type="radio"
                name="home-title-weight"
                value={w}
                checked={w === weight}
                onChange={() => onWeight(w)}
                className="sr-only"
                data-ui-key="home-title-weight-option"
              />
              <span
                className={cn('text-lg', CUSTOMER_TITLE_CLASS)}
                style={customerTitleVars(font, w)}
              >
                {t('home.titleSample')}
              </span>
              <span className="text-muted-foreground text-meta">{t(`titleWeight.${w}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
