'use client';
// 공개 포트폴리오 '시공 사례' (PUB-10) — 업체가 관리 탭에서 고른 배열로 그린다
//  gallery  (C): 4:5 세로 사진 격자 (휴대폰 2열 · PC 3열) + 공간 필터(업체가 켜고 끔)
//  carousel (D): 본문 폭 안에서 옆으로 넘김 (PC 3장/4장 + 다음 카드 살짝) · 화살표 · 진행 막대 · "01 / 06"
//  list     (E): 넓은 사진 한 장씩 세로로 (PC 3:2 · 휴대폰 4:3) + 아래에 이름, 그 밑에 평형|기간
// 휴대폰 따로: 업체가 휴대폰 배열을 PC와 다르게 고르면 둘 다 그리고 화면 폭(md)으로 하나만 보인다
//   (숨은 쪽 사진은 loading=lazy 라 받지 않음) · 휴대폰 갤러리 칸 수 1/2
// 여백: '여백 개선안' 기준 — 섹션 위아래 PC 160/180 · 휴대폰 96/110 (main gap 포함), 제목 아래 72/44
// 카드: 사진 + 사례 이름 + "⌂ 45 PY | ◷ 7 Weeks" 한 줄 (값이 없으면 그 칸을 뺀다). 자세한 정보는 사례 상세에서
// 맨 위 사진 슬라이드(PortfolioSlideshow)는 페이지가 따로 그린다
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, Clock, House, ImageIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { serif } from '../brand';
import {
  filterBySpace,
  normalizeCarouselPer,
  normalizeMobileCols,
  normalizeMobileLayout,
  normalizeWorksLayout,
  spaceCounts,
  type PublicWorkCard,
  type WorksLayout,
} from '../lib/grid';
import { labelText, type PageLabels } from '../lib/labels';
import type { PortfolioSpace } from '../schema';
import { portfolioRoutes, publicImageUrl } from '../routes';
import { DraftBadge } from './PortfolioPreviewBanner';

/** 업체가 고친 작은 문구 (SELECTED WORKS · 시공 사례) — 배열 컴포넌트마다 넘기지 않고 제목에서 읽는다 */
const LabelsCtx = createContext<PageLabels | undefined>(undefined);
/** 관리자 미리보기에서 사례가 하나도 없을 때 깔아 두는 견본 칸 — 누를 수 없고 사진 대신 '사진 자리'를 그린다 */
const SampleCtx = createContext(false);

const two = (n: number) => String(n).padStart(2, '0');
const py = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function WorkCard({
  w,
  href,
  badge,
  className,
  wide = false,
}: {
  w: PublicWorkCard;
  href: string;
  badge?: ReactNode;
  className?: string;
  /** E 목록형: 넓은 사진 + 이름과 평형|기간을 한 줄 양 끝에 */
  wide?: boolean;
}) {
  const t = useTranslations('portfolio');
  const sample = useContext(SampleCtx);
  const body = (
    <>
      <div
        className={cn(
          'bg-muted relative overflow-hidden rounded-[2px]',
          wide ? 'aspect-[4/3] md:aspect-[3/2]' : 'aspect-[4/5]',
        )}
      >
        {w.cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- 공개 버킷 주소. next/image 원격 도메인 설정은 쓰지 않는다
          <img
            src={publicImageUrl(wide ? w.cover.path : w.cover.thumbPath)}
            alt=""
            width={w.cover.width}
            height={w.cover.height}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : sample ? (
          <span className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm">
            <ImageIcon aria-hidden className="size-6 stroke-[1.25] opacity-60" />
            {t('preview.sample.photo')}
          </span>
        ) : (
          <span className="text-muted-foreground absolute inset-0 grid place-items-center text-sm">
            {t('public.noCover')}
          </span>
        )}
        {sample ? (
          <span className="absolute top-3 left-3">
            <SampleBadge />
          </span>
        ) : badge ? (
          <span className="absolute top-3 left-3">{badge}</span>
        ) : null}
      </div>
      {wide ? (
        <div className="flex flex-col gap-2 pt-[18px] md:gap-2.5 md:pt-7">
          <h3
            className={cn(
              serif,
              'text-xl leading-snug group-hover:underline group-hover:underline-offset-4 md:text-2xl',
            )}
          >
            {w.title}
          </h3>
          <Spec w={w} className="mt-0" />
        </div>
      ) : (
        <>
          <h3
            className={cn(
              serif,
              'mt-4 text-lg leading-snug group-hover:underline group-hover:underline-offset-4 md:text-xl',
            )}
          >
            {w.title}
          </h3>
          <Spec w={w} />
        </>
      )}
    </>
  );
  if (sample) {
    return (
      <div data-ui-key="portfolio-work-card-sample" className={cn('block rounded-sm', className)}>
        {body}
      </div>
    );
  }
  return (
    <Link
      href={href}
      data-ui-key="portfolio-work-card"
      className={cn(
        'group focus-visible:ring-ring/50 block rounded-sm outline-none focus-visible:ring-3',
        className,
      )}
    >
      {body}
    </Link>
  );
}

/** 견본 칸 배지 — 비공개 배지와 같은 모양 */
function SampleBadge() {
  const t = useTranslations('portfolio');
  return (
    <span className="bg-background/95 text-foreground inline-flex h-6 items-center rounded-md px-2 text-xs font-medium">
      {t('preview.sample.badge')}
    </span>
  );
}

/** "⌂ 45 PY | ◷ 7 Weeks" — 값이 없는 칸은 빼고, 둘 다 없으면 줄 자체를 안 그린다 */
function Spec({ w, className }: { w: PublicWorkCard; className?: string }) {
  const t = useTranslations('portfolio.public.spec');
  const items = [
    w.sizePyeong !== null
      ? {
          icon: <House aria-hidden />,
          n: py(w.sizePyeong),
          unit: t('py'),
          sr: t('pySr', { n: py(w.sizePyeong) }),
        }
      : null,
    w.durationWeeks
      ? {
          icon: <Clock aria-hidden />,
          n: String(w.durationWeeks),
          unit: t('weeks'),
          sr: t('weeksSr', { n: w.durationWeeks }),
        }
      : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);
  if (!items.length) return null;
  // 칸이 좁아 두 줄이 되면 아랫줄도 윗줄과 같은 왼쪽에서 시작하고, 줄 맨 앞의 구분선은 보이지 않게 한다.
  // 방법: 칸마다 앞에 구분선(::before)을 두고, 안쪽 줄을 구분선 폭만큼 왼쪽으로 당긴 뒤 바깥에서 잘라낸다.
  //       → 각 줄의 첫 칸 구분선은 잘린 영역에 들어가 안 보이고, 줄 사이의 구분선만 보인다. 단어 중간 끊김 없음.
  return (
    <p
      className={cn(
        'text-muted-foreground relative mt-2 shrink-0 overflow-hidden text-[13px] md:text-[15px]',
        className,
      )}
    >
      <span className="-ml-[21px] flex flex-wrap items-center gap-y-1 md:-ml-[33px]">
        {items.map((it, i) => (
          <span
            key={i}
            className="before:bg-border inline-flex items-center whitespace-nowrap before:mx-2.5 before:h-3.5 before:w-px before:content-[''] md:before:mx-4 [&_svg]:mr-1 [&_svg]:size-3.5 [&_svg]:stroke-[1.5] md:[&_svg]:mr-1.5 md:[&_svg]:size-4"
          >
            {it.icon}
            <span className="sr-only">{it.sr}</span>
            <span aria-hidden>
              <b className="text-foreground font-medium" data-numeric>
                {it.n}
              </b>
              <span className="ml-1">{it.unit}</span>
            </span>
          </span>
        ))}
      </span>
    </p>
  );
}

export function PortfolioGrid({
  slug,
  works,
  preview = false,
  draftIds = [],
  layout,
  galleryFilter = true,
  carouselPer = 3,
  mobileLayout = null,
  mobileCols = 2,
  labels,
  sample = false,
}: {
  slug: string;
  works: PublicWorkCard[];
  /** 관리자 미리보기: 카드 링크를 미리보기 주소로 (서버 → 클라이언트라 함수 대신 표시만 받는다) */
  preview?: boolean;
  /** 미리보기에서 '비공개' 배지를 붙일 사례 */
  draftIds?: string[];
  layout?: WorksLayout;
  galleryFilter?: boolean;
  carouselPer?: 3 | 4;
  /** 휴대폰 배열 (null = PC와 같게) */
  mobileLayout?: WorksLayout | null;
  /** 휴대폰 갤러리 칸 수 */
  mobileCols?: 1 | 2;
  /** 업체가 고친 문구 (company.labels) */
  labels?: PageLabels;
  /** 관리자 미리보기 전용 견본 칸 (사례가 없을 때). 공개 페이지에서는 쓰지 않는다 */
  sample?: boolean;
}) {
  return (
    <LabelsCtx.Provider value={labels}>
      <SampleCtx.Provider value={sample}>
        <GridBody
          slug={slug}
          works={works}
          preview={preview}
          draftIds={draftIds}
          layout={layout}
          galleryFilter={galleryFilter}
          carouselPer={carouselPer}
          mobileLayout={mobileLayout}
          mobileCols={mobileCols}
        />
      </SampleCtx.Provider>
    </LabelsCtx.Provider>
  );
}

function GridBody({
  slug,
  works,
  preview,
  draftIds,
  layout,
  galleryFilter,
  carouselPer,
  mobileLayout,
  mobileCols,
}: {
  slug: string;
  works: PublicWorkCard[];
  preview: boolean;
  draftIds: string[];
  layout?: WorksLayout;
  galleryFilter: boolean;
  carouselPer: 3 | 4;
  mobileLayout: WorksLayout | null;
  mobileCols: 1 | 2;
}) {
  const t = useTranslations('portfolio');
  const href = (id: string) =>
    preview ? portfolioRoutes.previewWork(slug, id) : portfolioRoutes.work(slug, id);
  const drafts = new Set(draftIds);
  const badge = (w: PublicWorkCard) => (drafts.has(w.id) ? <DraftBadge /> : null);
  const pc = normalizeWorksLayout(layout);
  const mobile = normalizeMobileLayout(mobileLayout) ?? pc;
  const cols = normalizeMobileCols(mobileCols);

  if (works.length === 0) {
    return (
      <section
        aria-labelledby="portfolio-works-title"
        className="flex flex-col gap-11 pt-8 pb-3.5 md:gap-[72px] md:pt-16 md:pb-20"
      >
        <Heading />
        <div
          role="status"
          className="text-muted-foreground flex min-h-60 items-center justify-center rounded-md border border-dashed text-sm"
        >
          {t('public.empty')}
        </div>
      </section>
    );
  }
  const view = (mode: WorksLayout, sfx: string) =>
    mode === 'carousel' ? (
      <Carousel
        works={works}
        href={href}
        badge={badge}
        per={normalizeCarouselPer(carouselPer)}
        sfx={sfx}
      />
    ) : mode === 'list' ? (
      <List works={works} href={href} badge={badge} sfx={sfx} />
    ) : (
      <Gallery
        works={works}
        href={href}
        badge={badge}
        filter={galleryFilter}
        cols={cols}
        sfx={sfx}
      />
    );
  if (mobile === pc) return view(pc, '');
  return (
    <>
      <div className="md:hidden" data-device="mobile">
        {view(mobile, '-m')}
      </div>
      <div className="hidden md:block" data-device="pc">
        {view(pc, '-pc')}
      </div>
    </>
  );
}

function Heading({ action, sfx = '' }: { action?: ReactNode; sfx?: string }) {
  const t = useTranslations('portfolio');
  const labels = useContext(LabelsCtx);
  const kicker = labelText(labels, 'worksKicker', 'Selected Works');
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {kicker ? (
          <p
            className="text-muted-foreground mb-2 text-[11px] tracking-[0.24em] uppercase"
            aria-hidden
            data-ui-key="portfolio-works-kicker"
          >
            {kicker}
          </p>
        ) : null}
        <h2 id={`portfolio-works-title${sfx}`} className={cn(serif, 'text-[30px] md:text-[40px]')}>
          {labelText(labels, 'worksTitle', t('public.worksTitle'))}
        </h2>
      </div>
      {action}
    </div>
  );
}

/* ── C 갤러리 + 공간 필터 ─────────────────────────────────────── */
function Gallery({
  works,
  href,
  badge,
  filter,
  cols,
  sfx,
}: {
  works: PublicWorkCard[];
  href: (id: string) => string;
  badge?: (w: PublicWorkCard) => ReactNode;
  filter: boolean;
  cols: 1 | 2;
  sfx: string;
}) {
  const t = useTranslations('portfolio');
  const tm = useTranslations('materials');
  const [space, setSpace] = useState<PortfolioSpace | null>(null);
  const counts = spaceCounts(works);
  const showFilter = filter && counts.length > 1; // 공간이 하나뿐이면 필터가 의미 없다
  const shown = filterBySpace(works, showFilter ? space : null);
  return (
    <section
      aria-labelledby={`portfolio-works-title${sfx}`}
      className="flex flex-col gap-11 pt-8 pb-3.5 md:gap-[72px] md:pt-16 md:pb-20"
      data-layout="gallery"
      data-cols={cols}
    >
      <Heading sfx={sfx} />
      {showFilter ? (
        <div
          role="group"
          aria-label={t('public.filterLabel')}
          className="-mt-2 flex flex-wrap gap-2"
          data-ui-key="portfolio-space-filter"
        >
          {[{ space: null as PortfolioSpace | null, count: works.length }, ...counts].map((c) => {
            const on = space === c.space;
            return (
              <button
                key={c.space ?? 'all'}
                type="button"
                aria-pressed={on}
                onClick={() => setSpace(c.space)}
                className={cn(
                  'focus-visible:ring-ring/50 h-9 rounded-full border px-4 text-sm outline-none focus-visible:ring-3',
                  on
                    ? 'bg-foreground text-background border-foreground'
                    : 'hover:bg-muted border-border',
                )}
              >
                {c.space ? tm(`space.${c.space}`) : t('public.all')}
                <span className="sr-only"> ({c.count})</span>
              </button>
            );
          })}
        </div>
      ) : null}
      <p role="status" className="sr-only">
        {t('public.countShown', { n: shown.length })}
      </p>
      <ul
        className={cn(
          'grid md:grid-cols-3 md:gap-x-8 md:gap-y-[72px]',
          cols === 1 ? 'grid-cols-1 gap-y-12' : 'grid-cols-2 gap-x-3 gap-y-6',
        )}
      >
        {shown.map((w) => (
          <li key={w.id} data-key={w.id}>
            <WorkCard w={w} href={href(w.id)} badge={badge?.(w)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── E 목록형 (넓은 사진 한 장씩) ─────────────────────────────── */
function List({
  works,
  href,
  badge,
  sfx,
}: {
  works: PublicWorkCard[];
  href: (id: string) => string;
  badge?: (w: PublicWorkCard) => ReactNode;
  sfx: string;
}) {
  return (
    <section
      aria-labelledby={`portfolio-works-title${sfx}`}
      className="flex flex-col gap-11 pt-8 pb-3.5 md:gap-[72px] md:pt-16 md:pb-20"
      data-layout="list"
    >
      <Heading sfx={sfx} />
      <ul className="flex flex-col gap-[72px] md:gap-32">
        {works.map((w) => (
          <li key={w.id} data-key={w.id}>
            <WorkCard w={w} href={href(w.id)} badge={badge?.(w)} wide />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── D 가로 넘김 (본문 폭 안에서) ───────────────────────────────── */
function Carousel({
  works,
  href,
  badge,
  per,
  sfx,
}: {
  works: PublicWorkCard[];
  href: (id: string) => string;
  badge?: (w: PublicWorkCard) => ReactNode;
  per: 3 | 4;
  sfx: string;
}) {
  const t = useTranslations('portfolio');
  const rail = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState({ first: 1, left: 0, width: 100, atStart: true, atEnd: false });

  const update = useCallback(() => {
    const r = rail.current;
    if (!r || !r.firstElementChild) return;
    const max = r.scrollWidth - r.clientWidth;
    const vis = r.scrollWidth > 0 ? r.clientWidth / r.scrollWidth : 1;
    const step =
      (r.firstElementChild as HTMLElement).offsetWidth +
      parseFloat(getComputedStyle(r).columnGap || '0');
    setPos({
      first: step > 0 ? Math.min(works.length, Math.round(r.scrollLeft / step) + 1) : 1,
      width: vis * 100,
      left: max > 0 ? (r.scrollLeft / max) * (100 - vis * 100) : 0,
      atStart: r.scrollLeft < 4,
      atEnd: r.scrollLeft > max - 4,
    });
  }, [works.length]);

  useEffect(() => {
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [update]);

  const go = (d: -1 | 1) => {
    const r = rail.current;
    if (!r || !r.firstElementChild) return;
    const step =
      (r.firstElementChild as HTMLElement).offsetWidth +
      parseFloat(getComputedStyle(r).columnGap || '0');
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    r.scrollBy({ left: d * step, behavior: smooth ? 'smooth' : 'auto' });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    }
  };

  const nav = (
    <div className="flex gap-2">
      {([-1, 1] as const).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => go(d)}
          disabled={d < 0 ? pos.atStart : pos.atEnd}
          aria-label={d < 0 ? t('public.carouselPrev') : t('public.carouselNext')}
          aria-controls={`portfolio-works-rail${sfx}`}
          className="focus-visible:ring-ring/50 border-foreground grid size-11 place-items-center rounded-full border outline-none focus-visible:ring-3 disabled:opacity-30 [&_svg]:size-4"
          data-ui-key={d < 0 ? 'portfolio-rail-prev' : 'portfolio-rail-next'}
        >
          {d < 0 ? <ArrowLeft aria-hidden /> : <ArrowRight aria-hidden />}
        </button>
      ))}
    </div>
  );

  return (
    <section
      aria-labelledby={`portfolio-works-title${sfx}`}
      className="flex flex-col gap-11 pt-8 pb-3.5 md:gap-[72px] md:pt-16 md:pb-20"
      data-layout="carousel"
      data-per={per}
    >
      <Heading action={nav} sfx={sfx} />
      <div>
        <ul
          id={`portfolio-works-rail${sfx}`}
          ref={rail}
          tabIndex={0}
          onScroll={update}
          onKeyDown={onKey}
          aria-label={t('public.carouselLabel')}
          className={cn(
            // relative: 카드 속 화면 읽기 글자(sr-only, absolute)가 넘김 줄 밖 페이지를 가로로 늘리지 않게 이 줄 안에 가둔다
            'focus-visible:ring-ring/50 relative flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain rounded-sm outline-none focus-visible:ring-3 md:gap-10',
            '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            // 한 화면 장수 + 다음 카드 살짝 (휴대폰 1.2장 · PC 3.25 / 4.25장)
            '[&>li]:shrink-0 [&>li]:basis-[calc((100%-1rem*0.2)/1.2)]',
            per === 4
              ? 'md:[&>li]:basis-[calc((100%-2.5rem*3.25)/4.25)]'
              : 'md:[&>li]:basis-[calc((100%-2.5rem*2.25)/3.25)]',
          )}
        >
          {works.map((w) => (
            <li key={w.id} data-key={w.id} className="snap-start">
              <WorkCard w={w} href={href(w.id)} badge={badge?.(w)} />
            </li>
          ))}
        </ul>
        <div className="mt-7 flex items-center gap-4" aria-hidden>
          <div className="bg-border relative h-px flex-1">
            <div
              className="bg-foreground absolute -top-px h-[3px] transition-[left,width] duration-300"
              style={{ left: `${pos.left}%`, width: `${pos.width}%` }}
            />
          </div>
          <span
            className={cn(serif, 'text-muted-foreground min-w-14 text-right text-[13px]')}
            data-numeric
          >
            {two(pos.first)} / {two(works.length)}
          </span>
        </div>
      </div>
    </section>
  );
}
