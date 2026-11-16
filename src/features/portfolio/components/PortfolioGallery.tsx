'use client';
// 공개 사례 상세 갤러리 (PUB-11 제안)
// 1) 맨 위 비포·애프터 슬라이더 (CompareSlider 재사용, 공개 주소)
// 2) 공간 탭 [전체 | 거실 | 침실A | 침실B | 욕실A …] — 화살표 키로 탭 이동 (WAI-ARIA tabs)
// 여백: 비포·애프터 ↔ 사진 PC 112px · 탭 아래 40px · 사진 사이 PC 24px / 휴대폰 12px (양옆 여백은 본문과 같음)
// 3) 썸네일을 누르면 크게 보기 (dialog) — "3 / 42", ←→ 넘기기(끝에서 처음으로), Esc 닫기
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { CompareSlider } from '@/features/designs/components/CompareSlider';
import { cn } from '@/shared/lib/utils';
import {
  beforeAfterPair,
  buildSpaceTabs,
  stepIndex,
  type PublicWorkImage,
  type SpaceTab,
} from '../lib/grid';
import { serif } from '../brand';
import { publicImageUrl } from '../routes';

export function PortfolioGallery({ title, images }: { title: string; images: PublicWorkImage[] }) {
  const t = useTranslations('portfolio');
  const tm = useTranslations('materials');
  const pair = beforeAfterPair(images);
  const tabs = buildSpaceTabs(images);
  const [tabKey, setTabKey] = useState(tabs[0]?.key ?? 'all');
  const tab = tabs.find((x) => x.key === tabKey) ?? tabs[0];
  const [open, setOpen] = useState<number | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const tabName = (x: SpaceTab) =>
    x.key === 'all'
      ? t('public.all')
      : x.spaceLabel || (x.space ? tm(`space.${x.space}`) : t('public.otherSpace'));

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const next =
      e.key === 'ArrowRight'
        ? stepIndex(i, 1, tabs.length)
        : e.key === 'ArrowLeft'
          ? stepIndex(i, -1, tabs.length)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? tabs.length - 1
              : null;
    if (next === null) return;
    e.preventDefault();
    setTabKey(tabs[next]!.key);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-20 md:gap-28">
      {pair ? (
        <section aria-label={t('public.beforeAfter')} className="flex flex-col gap-3">
          <h2 className={cn(serif, 'text-xl md:text-2xl')}>{t('public.beforeAfter')}</h2>
          <CompareSlider
            fixedPair
            fit="cover"
            uiKey="portfolio-compare"
            initialA={pair.after.id}
            initialB={pair.before.id}
            sideLabels={{ a: t('public.after'), b: t('public.before') }}
            images={[pair.after, pair.before].map((img) => ({
              id: img.id,
              src: publicImageUrl(img.path),
              label: img.caption || (img.role === 'after' ? t('public.after') : t('public.before')),
              designTitle: title,
              versionNo: null,
              pdfPage: null,
            }))}
          />
        </section>
      ) : null}

      {tab ? (
        <section aria-label={t('public.photos')} className="flex flex-col gap-7 md:gap-10">
          <div
            role="tablist"
            aria-label={t('public.spaceTabs')}
            className="-mx-1 flex gap-1 overflow-x-auto border-b px-1"
          >
            {tabs.map((x, i) => {
              const selected = x.key === tab.key;
              return (
                <button
                  key={x.key}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`pf-tab-${i}`}
                  aria-selected={selected}
                  aria-controls="pf-tabpanel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setTabKey(x.key)}
                  onKeyDown={(e) => onTabKey(e, i)}
                  data-ui-key="portfolio-space-tab"
                  className={cn(
                    'focus-visible:ring-ring/50 -mb-px inline-flex h-11 items-center gap-1.5 border-b-2 px-3 text-sm whitespace-nowrap outline-none focus-visible:ring-3',
                    selected
                      ? 'border-foreground text-foreground font-semibold'
                      : 'text-muted-foreground border-transparent',
                  )}
                >
                  {tabName(x)}
                  <span className="text-muted-foreground font-normal" data-numeric>
                    {x.items.length}
                  </span>
                </button>
              );
            })}
          </div>

          <ul
            id="pf-tabpanel"
            role="tabpanel"
            aria-labelledby={`pf-tab-${tabs.indexOf(tab)}`}
            className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-3"
          >
            {tab.items.map((img, i) => (
              <li key={img.id} data-key={img.id}>
                <button
                  type="button"
                  onClick={() => setOpen(i)}
                  aria-label={t('public.openPhoto', { current: i + 1, total: tab.items.length })}
                  data-ui-key="portfolio-photo-open"
                  className="group focus-visible:ring-ring/50 block w-full overflow-hidden rounded-[4px] outline-none focus-visible:ring-3"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- 공개 버킷 주소 */}
                  <img
                    src={publicImageUrl(img.thumbPath)}
                    alt={img.caption || title}
                    width={img.thumbWidth}
                    height={img.thumbHeight}
                    loading="lazy"
                    decoding="async"
                    className="bg-muted aspect-[4/3] h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab && open !== null ? (
        <Lightbox
          items={tab.items}
          index={open}
          title={title}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          label={(i) => tabName(tab) + ` · ${i + 1} / ${tab.items.length}`}
        />
      ) : null}
    </div>
  );
}

function Lightbox({
  items,
  index,
  title,
  onIndex,
  onClose,
  label,
}: {
  items: PublicWorkImage[];
  index: number;
  title: string;
  onIndex: (i: number) => void;
  onClose: () => void;
  label: (i: number) => string;
}) {
  const t = useTranslations('portfolio');
  const ref = useRef<HTMLDialogElement>(null);
  const img = items[index]!;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    // jsdom 등 showModal 이 없는 환경 대비
    if (typeof d.showModal === 'function' && !d.open) d.showModal();
    else d.setAttribute('open', '');
    return () => {
      if (typeof d.close === 'function' && d.open) d.close();
    };
  }, []);

  const go = (delta: number) => onIndex(stepIndex(index, delta, items.length));
  const onKey = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <dialog
      ref={ref}
      aria-label={label(index)}
      onKeyDown={onKey}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-black/90 p-0 text-white backdrop:bg-black/60"
      data-ui-key="portfolio-lightbox"
    >
      <div className="flex h-full flex-col">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="text-sm" data-numeric aria-live="polite">
            {t('public.photoCounter', { current: index + 1, total: items.length })}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('public.close')}
            className="grid size-10 place-items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-white/60"
            data-ui-key="portfolio-lightbox-close"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
          {/* eslint-disable-next-line @next/next/no-img-element -- 공개 버킷 주소 */}
          <img
            key={img.id}
            src={publicImageUrl(img.path)}
            alt={img.caption || title}
            width={img.width}
            height={img.height}
            className="max-h-full max-w-full object-contain"
          />
          {items.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label={t('public.prev')}
                className="absolute left-2 grid size-11 place-items-center rounded-full bg-white/10 outline-none hover:bg-white/20 focus-visible:ring-3 focus-visible:ring-white/60"
                data-ui-key="portfolio-lightbox-prev"
              >
                <ChevronLeft aria-hidden className="size-6" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label={t('public.next')}
                className="absolute right-2 grid size-11 place-items-center rounded-full bg-white/10 outline-none hover:bg-white/20 focus-visible:ring-3 focus-visible:ring-white/60"
                data-ui-key="portfolio-lightbox-next"
              >
                <ChevronRight aria-hidden className="size-6" />
              </button>
            </>
          ) : null}
        </div>
        <p className="min-h-12 px-4 py-3 text-center text-sm text-white/80">{img.caption}</p>
      </div>
    </dialog>
  );
}
