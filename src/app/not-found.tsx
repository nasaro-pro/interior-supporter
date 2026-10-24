// src/app/not-found.tsx (A · REQ-012) — SYS-404 없음·권한 없음(존재 숨김). 다른 프로젝트로 묵시 이동하지 않는다
import { getTranslations } from 'next-intl/server';
import { ButtonLink } from '@/shared/ui/button-link';
import { NotFoundState } from '@/shared/ui/states';
import { routes } from '@/shared/contracts/routes';

export default async function NotFound() {
  const t = await getTranslations('common');
  return (
    <main
      data-screen-id="SYS-404"
      className="page-container flex min-h-[60dvh] items-center justify-center py-10"
    >
      <div className="w-full max-w-lg">
        <NotFoundState
          titleAs="h1"
          action={
            <ButtonLink
              href={routes.selectArea()}
              data-ui-key="notfound-home-link"
              variant="outline"
            >
              {t('action.goHome')}
            </ButtonLink>
          }
        />
      </div>
    </main>
  );
}
