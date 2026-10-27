// src/app/(auth)/change-password/page.tsx (A · D-15·D-16) — AUTH-06 첫 로그인 비밀번호 변경
// 디자이너가 만든 계정은 메일로 받은 임시 비밀번호로 처음 로그인한 뒤 여기서 자기 비밀번호를 정한다.
// 이 화면은 getAccessContext 를 부르지 않는다 (그 함수가 이 화면으로 보내기 때문)
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { FirstPasswordForm } from '@/features/core/components/auth-forms';
import { getSessionUserId, loadFirstLoginState } from '@/features/core/server/access';
import { logout } from '@/features/core/server/session-actions';
import { routes } from '@/shared/contracts/routes';
import { Button } from '@/shared/ui/button';

export default async function ChangePasswordPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect(routes.login(routes.changePassword()));
  const state = await loadFirstLoginState(userId);
  if (state === 'ready') redirect(routes.selectArea());
  const t = await getTranslations('auth');
  return (
    <main
      data-screen-id="AUTH-06"
      className="bg-card flex flex-col gap-5 rounded-lg border p-6 shadow-sm"
    >
      <h1 className="text-3xl font-semibold tracking-tight">{t('screen.changePassword')}</h1>
      {state === 'expired' ? (
        <p
          role="alert"
          className="bg-tone-critical-bg text-tone-critical-fg rounded-md px-3 py-2 text-sm"
        >
          {t('firstPassword.expired')}
        </p>
      ) : (
        <>
          <p className="text-muted-foreground">{t('firstPassword.intro')}</p>
          <FirstPasswordForm />
        </>
      )}
      <form action={logout}>
        <Button type="submit" variant="ghost" size="sm" data-ui-key="first-password-logout">
          {t('firstPassword.logout')}
        </Button>
      </form>
    </main>
  );
}
