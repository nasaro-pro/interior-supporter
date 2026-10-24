'use client';
// src/features/core/components/home-template-fields.tsx (A · REQ-014·052, CR-A-10) — 고객 홈 구성 입력 (PM-63 기본 템플릿 · PM-03 고객 홈 편집 공용)
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, Check } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import type { HomeSections } from '@/shared/contracts/domain';
import { cn } from '@/shared/lib/utils';
import { moveSection } from '../home-sections';
import { HOME_THEMES, HOME_THEME_CLASS, type HomeTheme } from '../home-theme';

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
