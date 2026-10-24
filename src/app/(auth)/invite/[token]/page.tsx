// src/app/(auth)/invite/[token]/page.tsx (A · REQ-004) — AUTH-03 초대 수락
// 만료·폐기·없음은 같은 안내(INVITE_INVALID), 사용됨은 INVITE_USED (POL-008)
import { getTranslations } from 'next-intl/server';
import { ButtonLink } from '@/shared/ui/button-link';
import { InviteAcceptButton, InviteNewAccountForm } from '@/features/core/components/auth-forms';
import { getInvitationPreview } from '@/features/core/server/invitation-queries';
import { loadAccessContext } from '@/features/core/server/access';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { routes } from '@/shared/contracts/routes';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations();
  const preview = await getInvitationPreview(token);

  if (preview.status !== 'valid') {
    return (
      <main
        data-screen-id="AUTH-03"
        className="bg-card flex flex-col gap-4 rounded-lg border p-6 shadow-sm"
      >
        <h1 className="text-3xl font-semibold tracking-tight">{t('auth.screen.invite')}</h1>
        <p
          role="alert"
          className="bg-tone-critical-bg text-tone-critical-fg rounded-md px-3 py-2 text-sm"
        >
          {preview.status === 'used' ? t('errors.INVITE_USED') : t('errors.INVITE_INVALID')}
        </p>
        <ButtonLink href={routes.login()} data-ui-key="invite-login-link" variant="outline">
          {t('auth.screen.login')}
        </ButtonLink>
      </main>
    );
  }

  const ctx = await loadAccessContext();
  let currentEmail: string | null = null;
  if (ctx) {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getUser();
    currentEmail = data.user?.email ?? null;
  }
  const roleLabel =
    preview.area === 'app'
      ? t(`settings.memberRole.${preview.role as 'pm' | 'manager'}`)
      : t(`projects.participantRole.${preview.role as 'customer' | 'field'}`);
  const inviteHref = routes.invite(token);

  return (
    <main
      data-screen-id="AUTH-03"
      className="bg-card flex flex-col gap-5 rounded-lg border p-6 shadow-sm"
    >
      <h1 className="text-3xl font-semibold tracking-tight">{t('auth.screen.invite')}</h1>
      <div className="flex flex-col gap-1">
        <p className="text-base">
          {t('auth.invite.intro', { company: preview.companyName, role: roleLabel })}
        </p>
        <p className="text-muted-foreground">
          {t('auth.invite.forEmail', { email: preview.email })}
        </p>
      </div>
      {ctx ? (
        <>
          <p className="text-muted-foreground text-meta">
            {t('auth.invite.loggedInAs', { email: currentEmail ?? '' })}
          </p>
          <InviteAcceptButton token={token} />
        </>
      ) : (
        <>
          <p className="text-muted-foreground text-meta">{t('auth.invite.newAccount')}</p>
          <InviteNewAccountForm token={token} />
          <div className="border-t pt-4">
            <p className="text-muted-foreground text-meta mb-2">
              {t('auth.invite.existingAccount')}
            </p>
            <ButtonLink
              href={routes.login(inviteHref)}
              data-ui-key="invite-login-to-accept"
              variant="outline"
              className="w-full"
            >
              {t('auth.invite.loginToAccept')}
            </ButtonLink>
          </div>
        </>
      )}
    </main>
  );
}
