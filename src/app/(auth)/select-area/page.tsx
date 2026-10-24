// src/app/(auth)/select-area/page.tsx (A · REQ-007) — AUTH-05 영역 선택. 영역이 1개면 바로 이동 (REQ-002)
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Building2, Camera, Home } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getAccessContext } from '@/features/core';
import { chooseArea, logout } from '@/features/core/server/session-actions';
import { LAST_COMPANY_COOKIE } from '@/features/core/constants';
import { routes } from '@/shared/contracts/routes';
import { Button } from '@/shared/ui/button';

export default async function SelectAreaPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; stay?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await getAccessContext();
  const t = await getTranslations();
  const choices =
    ctx.memberships.length +
    (ctx.areas.includes('portal') ? 1 : 0) +
    (ctx.areas.includes('field') ? 1 : 0);

  // 영역 1개면 바로 그 영역 첫 화면 (재설정 직후 안내가 있을 때는 머문다)
  if (choices === 1 && !sp.reset && !sp.stay) {
    const m = ctx.memberships[0];
    if (m) redirect(routes.app.projects(m.slug));
    if (ctx.areas.includes('portal')) redirect(routes.portal.projects());
    if (ctx.areas.includes('field')) redirect(routes.field.photos());
  }
  // PM 업체만 여러 개 + 마지막 사용 업체 쿠키 → 그 업체로 (02 문서 4장)
  const last = (await cookies()).get(LAST_COMPANY_COOKIE)?.value;
  if (!sp.stay && !sp.reset && choices === ctx.memberships.length && last) {
    const m = ctx.memberships.find((x) => x.slug === last);
    if (m) redirect(routes.app.projects(m.slug));
  }

  const countFor = (role: 'customer' | 'field') =>
    new Set(ctx.participations.filter((p) => p.role === role).map((p) => p.projectId)).size;

  return (
    <main
      data-screen-id="AUTH-05"
      className="bg-card flex flex-col gap-5 rounded-lg border p-6 shadow-sm"
    >
      <h1 className="text-3xl font-semibold tracking-tight">{t('auth.screen.selectArea')}</h1>
      {sp.reset ? (
        <p
          role="status"
          className="bg-tone-brand-bg text-tone-brand-fg rounded-md px-3 py-2 text-sm"
        >
          {t('auth.reset.done')}
        </p>
      ) : null}
      {choices === 0 ? (
        <p className="text-muted-foreground">{t('auth.selectArea.none')}</p>
      ) : (
        <>
          <p className="text-muted-foreground">{t('auth.selectArea.intro')}</p>
          <ul className="flex flex-col gap-2">
            {ctx.memberships.map((m) => (
              <li key={m.companyId}>
                <form action={chooseArea.bind(null, 'app', m.slug)}>
                  <Button
                    type="submit"
                    variant="outline"
                    className="h-auto w-full justify-start gap-3 py-3"
                    data-ui-key="area-app-choose"
                    data-key={m.companyId}
                  >
                    <Building2 aria-hidden className="size-5" />
                    <span className="flex flex-col items-start">
                      <span className="font-medium">{m.name}</span>
                      <span className="text-muted-foreground text-meta">
                        {t('common.area.app')} · {t(`settings.memberRole.${m.role}`)}
                      </span>
                    </span>
                  </Button>
                </form>
              </li>
            ))}
            {ctx.areas.includes('portal') ? (
              <li>
                <form action={chooseArea.bind(null, 'portal', undefined)}>
                  <Button
                    type="submit"
                    variant="outline"
                    className="h-auto w-full justify-start gap-3 py-3"
                    data-ui-key="area-portal-choose"
                  >
                    <Home aria-hidden className="size-5" />
                    <span className="flex flex-col items-start">
                      <span className="font-medium">{t('common.area.portal')}</span>
                      <span className="text-muted-foreground text-meta">
                        {t('auth.selectArea.projects', { count: countFor('customer') })}
                      </span>
                    </span>
                  </Button>
                </form>
              </li>
            ) : null}
            {ctx.areas.includes('field') ? (
              <li>
                <form action={chooseArea.bind(null, 'field', undefined)}>
                  <Button
                    type="submit"
                    variant="outline"
                    className="h-auto w-full justify-start gap-3 py-3"
                    data-ui-key="area-field-choose"
                  >
                    <Camera aria-hidden className="size-5" />
                    <span className="flex flex-col items-start">
                      <span className="font-medium">{t('common.area.field')}</span>
                      <span className="text-muted-foreground text-meta">
                        {t('auth.selectArea.projects', { count: countFor('field') })}
                      </span>
                    </span>
                  </Button>
                </form>
              </li>
            ) : null}
          </ul>
        </>
      )}
      <form action={logout}>
        <Button type="submit" variant="ghost" size="sm" data-ui-key="area-logout">
          {t('common.nav.logout')}
        </Button>
      </form>
    </main>
  );
}
