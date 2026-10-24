'use client';
// src/features/core/components/account-menu.tsx (A · TASK-001·008·015) — 헤더 계정 메뉴: 언어·비밀번호 변경·영역 전환·로그아웃
// 마이페이지 없음(1.4 제외 범위) — 개인 설정은 이 메뉴의 대화상자(화면 상태)
import { useActionState, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CircleUserRound } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { FormError, FormRow, SubmitButton } from '@/shared/ui/form-parts';
import { routes } from '@/shared/contracts/routes';
import { changePassword, logout, setLocale } from '../server/session-actions';

export function AccountMenu({
  displayName,
  canSwitchArea,
}: {
  displayName: string;
  canSwitchArea: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [pwOpen, setPwOpen] = useState(false);
  const [, start] = useTransition();

  const changeLocale = (next: string) =>
    start(async () => {
      if (next !== 'ko' && next !== 'en') return;
      const res = await setLocale({ locale: next });
      if (res.ok) {
        router.refresh();
        toast.success(t('auth.locale.changed'));
      } else toast.error(t(`errors.${res.error.code}`));
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              aria-label={t('common.nav.account')}
              data-ui-key="account-menu-open"
            />
          }
        >
          <CircleUserRound aria-hidden className="size-5" />
          <span className="hidden max-w-32 truncate lg:inline">{displayName}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t('common.nav.language')}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={locale} onValueChange={(v: string) => changeLocale(v)}>
              <DropdownMenuRadioItem value="ko" data-ui-key="account-locale-ko">
                {t('common.locale.ko')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="en" data-ui-key="account-locale-en">
                {t('common.locale.en')}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setPwOpen(true)} data-ui-key="account-password-open">
            {t('common.nav.changePassword')}
          </DropdownMenuItem>
          {canSwitchArea ? (
            <DropdownMenuItem
              render={<Link href={routes.selectArea()} data-ui-key="account-switch-area-link" />}
            >
              {t('common.nav.switchArea')}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => start(() => logout())}
            data-ui-key="account-logout"
          >
            {t('common.nav.logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </>
  );
}

/** REQ-006 비밀번호 변경 대화상자 */
function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useTranslations();
  const [state, action] = useActionState(changePassword, null);
  const fe = state && !state.ok ? state.error.fieldErrors : undefined;

  useEffect(() => {
    if (state?.ok) {
      toast.success(t('auth.account.passwordChanged'));
      onOpenChange(false);
    }
  }, [state, onOpenChange, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('auth.account.changePassword')}</DialogTitle>
          <DialogDescription>{t('auth.signup.passwordHelp')}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3" noValidate>
          <FormRow
            label={t('auth.field.currentPassword')}
            htmlFor="pw-current"
            errors={fe?.currentPassword}
            required
          >
            <Input
              id="pw-current"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              aria-describedby="pw-current-error"
              required
            />
          </FormRow>
          <FormRow
            label={t('auth.field.newPassword')}
            htmlFor="pw-new"
            errors={fe?.password}
            required
          >
            <Input
              id="pw-new"
              name="password"
              type="password"
              autoComplete="new-password"
              aria-describedby="pw-new-error"
              required
            />
          </FormRow>
          <FormRow
            label={t('auth.field.passwordConfirm')}
            htmlFor="pw-confirm"
            errors={fe?.passwordConfirm}
            required
          >
            <Input
              id="pw-confirm"
              name="passwordConfirm"
              type="password"
              autoComplete="new-password"
              aria-describedby="pw-confirm-error"
              required
            />
          </FormRow>
          {state && !state.ok && !fe ? <FormError error={state.error} /> : null}
          <DialogFooter>
            <SubmitButton data-ui-key="account-password-submit">
              {t('auth.account.submit')}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
