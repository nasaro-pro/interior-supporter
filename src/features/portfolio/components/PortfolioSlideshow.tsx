'use client';
// 공개 목록 맨 위 사진 슬라이드 — 천천히 겹쳐 바뀐다 (7초마다, 1.4초 동안 투명도만. 확대·이동 없음)
// 접근성 (WCAG 2.2.2 움직이는 콘텐츠): 멈춤/재생 버튼 항상 표시 · 마우스를 올리거나 키보드로 안에 들어오면 잠시 멈춤
//   · 운영체제 '동작 줄이기'면 자동으로 넘기지 않음 · 브라우저 탭이 안 보이면 멈춤 · 자동 넘김 중에는 화면 읽기에 알리지 않음
// 참고: Stitch 브랜드 시스템은 '자동 넘김 슬라이드'를 금지하지만 제품 결정으로 쓰기로 함 → 위 조건으로 완화
import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { serifOnPhoto } from '../brand';
import { stepIndex, type PublicImage } from '../lib/grid';
import { publicImageUrl } from '../routes';

export interface Slide {
  id: string;
  title: string;
  href: string;
  image: PublicImage;
}

export const SLIDE_INTERVAL_MS = 7000;
export const SLIDE_FADE_MS = 1400;

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
function subscribeReduced(on: () => void) {
  const mq = window.matchMedia?.(REDUCED_QUERY);
  mq?.addEventListener?.('change', on);
  return () => mq?.removeEventListener?.('change', on);
}
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia?.(REDUCED_QUERY)?.matches ?? false,
    () => false,
  );
}

export function PortfolioSlideshow({ slides }: { slides: Slide[] }) {
  const t = useTranslations('portfolio');
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false); // 사용자가 누른 멈춤 (계속 유지)
  const [hold, setHold] = useState(false); // 마우스·키보드가 안에 있는 동안 잠시 멈춤
  const [hidden, setHidden] = useState(false);
  const reduced = usePrefersReducedMotion();
  const multi = slides.length > 1;
  const running = multi && !paused && !hold && !hidden && !reduced;

  useEffect(() => {
    const on = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(
      () => setIndex((i) => stepIndex(i, 1, slides.length)),
      SLIDE_INTERVAL_MS,
    );
    return () => window.clearInterval(id);
  }, [running, slides.length]);

  if (!slides.length) return null;
  const current = slides[index] ?? slides[0]!;
  const go = (d: number) => setIndex((i) => stepIndex(i, d, slides.length));

  return (
    <section
      aria-roledescription={t('slideshow.roledescription')}
      aria-label={t('slideshow.label')}
      className="relative"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHold(false);
      }}
      data-ui-key="portfolio-slideshow"
    >
      <div className="bg-muted relative aspect-[4/3] overflow-hidden rounded-[4px] md:aspect-[21/9]">
        {/* 자동 넘김 중에는 알리지 않고(off), 멈췄을 때만 바뀐 사진을 알린다(polite) */}
        <div aria-live={running ? 'off' : 'polite'} className="absolute inset-0">
          {slides.map((s, i) => {
            const active = i === index;
            return (
              <div
                key={s.id}
                role="group"
                aria-roledescription={t('slideshow.slide')}
                aria-label={t('slideshow.position', { current: i + 1, total: slides.length })}
                aria-hidden={!active}
                style={{ transitionDuration: `${SLIDE_FADE_MS}ms` }}
                className={cn(
                  'absolute inset-0 transition-opacity ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                  active ? 'opacity-100' : 'pointer-events-none opacity-0',
                )}
                data-testid="portfolio-slide"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- 공개 버킷 주소 */}
                <img
                  src={publicImageUrl(s.image.path)}
                  alt={s.image.caption || s.title}
                  width={s.image.width}
                  height={s.image.height}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>
            );
          })}
        </div>

        {/* 아래 40% 먹색 그라데이션 위 사례 이름 (Stitch 인증 사진 패널과 같은 처리) */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/55 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white md:p-8">
          <Link
            href={current.href}
            className="group pointer-events-auto rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-white/70"
            data-ui-key="portfolio-slide-link"
          >
            <span className={cn(serifOnPhoto, 'block text-xl md:text-[28px] md:leading-tight')}>
              {current.title}
            </span>
            <span className="mt-1.5 inline-flex items-center gap-1 text-sm text-white/90 group-hover:underline">
              {t('slideshow.viewDetail')}
              <ArrowRight
                aria-hidden
                className="size-4 transition-transform duration-150 group-hover:translate-x-1 motion-reduce:transition-none"
              />
            </span>
          </Link>
          {multi ? (
            <div className="flex shrink-0 items-center gap-1">
              <SlideButton
                label={t('public.prev')}
                onClick={() => go(-1)}
                uiKey="portfolio-slide-prev"
              >
                <ChevronLeft aria-hidden className="size-5" />
              </SlideButton>
              <SlideButton
                label={paused ? t('slideshow.play') : t('slideshow.pause')}
                onClick={() => setPaused((p) => !p)}
                uiKey="portfolio-slide-toggle"
                pressed={paused}
              >
                {paused ? (
                  <Play aria-hidden className="size-4" />
                ) : (
                  <Pause aria-hidden className="size-4" />
                )}
              </SlideButton>
              <SlideButton
                label={t('public.next')}
                onClick={() => go(1)}
                uiKey="portfolio-slide-next"
              >
                <ChevronRight aria-hidden className="size-5" />
              </SlideButton>
            </div>
          ) : null}
        </div>
      </div>

      {multi ? (
        <div className="mt-3 flex justify-center gap-1" data-ui-key="portfolio-slide-dots">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={t('slideshow.goTo', { n: i + 1, title: s.title })}
              aria-current={i === index ? 'true' : undefined}
              className="focus-visible:ring-ring/50 grid size-6 place-items-center rounded-full outline-none focus-visible:ring-3"
            >
              <span
                className={cn(
                  'block h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none',
                  i === index ? 'bg-foreground w-5' : 'bg-foreground/25 w-1.5',
                )}
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function SlideButton({
  label,
  onClick,
  uiKey,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  uiKey: string;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      data-ui-key={uiKey}
      className="grid size-10 place-items-center rounded-full bg-black/35 text-white outline-none hover:bg-black/50 focus-visible:ring-3 focus-visible:ring-white/70"
    >
      {children}
    </button>
  );
}
