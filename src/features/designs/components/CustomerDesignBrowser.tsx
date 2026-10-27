// CU-03 · CU-04 고객 도안 화면 (CL-04) — 디자이너가 정한 공간 · 대표 · 순서(D-26~28)를 그대로 보여 준다
// ① 처음: 대표 도안 1개를 크게 (없거나 이미지가 없으면 이미지가 있는 최근 공개 도안)
// ② 대표 도안을 누르면: 공간 칩(전체 · 거실 · 주방 …) + 공간별 도안. 공간 순서 = 디자이너가 정한 순서
// 상태는 ?space= 로 (새 뎁스 아님 · 뒤로 가기로 돌아옴)
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ProjectAccess } from '@/shared/contracts/integration';
import { MATERIAL_SPACES } from '@/shared/contracts/domain';
import { routes } from '@/shared/contracts/routes';
import { cn } from '@/shared/lib/utils';
import { EmptyState } from '@/shared/ui/states';
import { DesignList } from '@/features/designs/components/DesignList';
import { MainBadge } from '@/features/designs/components/StateBadges';
import { groupBySpace, parseSpaceParam, pickHero } from '@/features/designs/lib/order';
import { withQuery } from '@/features/designs/lib/query';
import type { DesignListItem } from '@/features/designs/types';

const spaceKey = (s: DesignListItem['space']) => s ?? 'whole';

export async function CustomerDesignBrowser({
  items,
  viewer,
  spaceParam,
}: {
  items: DesignListItem[];
  viewer: ProjectAccess;
  spaceParam: string | undefined;
}) {
  const t = await getTranslations('designs');
  const tm = await getTranslations('materials');
  if (items.length === 0) return <EmptyState title={t('list.emptyCustomer')} />;
  const base = routes.portal.project(viewer.projectId, 'designs');
  const groups = groupBySpace(items);
  const state = parseSpaceParam(spaceParam, MATERIAL_SPACES);
  const hero = pickHero(items);
  const label = (s: DesignListItem['space']) => (s ? tm(`space.${s}`) : t('customer.wholeHome'));

  // ① 대표 화면 — 대표 이미지가 하나도 없으면 바로 공간별 목록
  if (state.mode === 'hero' && hero) {
    return (
      <section
        aria-label={t('customer.heroLabel')}
        className="flex flex-col gap-3"
        data-ui-key="design-hero"
      >
        <Link
          href={withQuery(base, { space: 'all' })}
          className="bg-card group focus-visible:ring-ring/50 flex flex-col gap-3 overflow-hidden rounded-xl border shadow-sm outline-none focus-visible:ring-3"
          data-ui-key="design-hero-open"
        >
          <div className="bg-muted flex max-h-[70svh] items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- 권한 재검사 라우트(302) */}
            <img
              src={routes.file(hero.previewFileId!)}
              alt={hero.title}
              className="max-h-[70svh] w-full object-contain"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-4">
            <span className="flex min-w-0 items-center gap-2">
              {hero.isMain ? <MainBadge label={t('main.badge')} /> : null}
              <span className="truncate text-lg font-semibold">{hero.title}</span>
            </span>
            <span className="text-primary text-sm font-medium group-hover:underline">
              {t('customer.browseSpaces', { count: groups.length })}
            </span>
          </div>
        </Link>
        <p className="text-muted-foreground text-meta">{t('customer.heroHint')}</p>
      </section>
    );
  }

  // ② 공간별 — 칩 + 선택한 공간의 도안 (전체면 공간별 묶음)
  const selected = state.mode === 'space' ? groups.filter((g) => g.space === state.space) : groups;
  const shown = selected.flatMap((g) => g.items);
  const chip = (href: string, text: string, active: boolean, key: string) => (
    <li key={key}>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        data-ui-key="design-space-chip"
        data-key={key}
        className={cn(
          'focus-visible:ring-ring/50 inline-flex h-9 items-center rounded-full border px-4 text-sm whitespace-nowrap outline-none focus-visible:ring-3',
          active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-accent',
        )}
      >
        {text}
      </Link>
    </li>
  );
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {hero ? (
        <Link
          href={base}
          className="text-muted-foreground text-meta self-start hover:underline"
          data-ui-key="design-hero-back"
        >
          {t('customer.backToHero')}
        </Link>
      ) : null}
      <nav aria-label={t('customer.spaceNav')} className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2 pb-1">
          {chip(
            withQuery(base, { space: 'all' }),
            t('customer.allSpaces'),
            state.mode !== 'space',
            'all',
          )}
          {groups.map((g) =>
            chip(
              withQuery(base, { space: spaceKey(g.space) }),
              `${label(g.space)} ${g.items.length}`,
              state.mode === 'space' && state.space === g.space,
              spaceKey(g.space),
            ),
          )}
        </ul>
      </nav>
      {shown.length === 0 ? (
        <EmptyState title={t('customer.spaceEmpty')} />
      ) : (
        <DesignList items={shown} viewer={viewer} />
      )}
    </div>
  );
}
