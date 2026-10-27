'use client';
// src/features/core/components/auth-forms.tsx (A · TASK-004·008·015) — 로그인·업체 가입·초대 수락·비밀번호 재설정 폼
import { useActionState, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { FormError, FormRow, SubmitButton } from '@/shared/ui/form-parts';
import { NativeCheckbox } from '@/shared/ui/native-fields';
import type { ActionResult } from '@/shared/contracts/errors';
import { login, resetPassword } from '../server/session-actions';
import {
  acceptInvitationAsCurrentUser,
  acceptInvitationWithNewAccount,
  completeFirstPassword,
  signupCompany,
} from '../server/auth-actions';

type Errs = Record<string, string[]> | undefined;
const fieldErrors = (s: ActionResult<never> | null): Errs =>
  s && !s.ok ? s.error.fieldErrors : undefined;

// ── AUTH-01 ─────────────────────────────────────────────────────────
export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations('auth');
  const [state, action] = useActionState(login, null);
  const fe = fieldErrors(state);
  const code = state && !state.ok ? state.error.code : null;
  // D-01: 제출 후에도 입력값 유지(React 폼 액션은 제출 뒤 비제어 입력을 비움)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // 인증 실패는 어느 칸이 틀렸는지 알리지 않고 두 칸을 함께 표시(계정 존재 노출 방지, REQ-002)
  const authFailed = code === 'UNAUTHENTICATED' ? true : undefined;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next ?? ''} />
      <FormRow label={t('field.email')} htmlFor="login-email" errors={fe?.email} required>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          aria-describedby="login-email-error"
          aria-invalid={fe?.email ? true : authFailed}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </FormRow>
      <FormRow label={t('field.password')} htmlFor="login-password" errors={fe?.password} required>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-describedby="login-password-error"
          aria-invalid={fe?.password ? true : authFailed}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </FormRow>
      {code === 'UNAUTHENTICATED' ? (
        <p
          role="alert"
          className="bg-tone-critical-bg text-tone-critical-fg rounded-md px-3 py-2 text-sm"
        >
          {t('login.failed')}
        </p>
      ) : code === 'RATE_LIMITED' ? (
        <p
          role="alert"
          className="bg-tone-critical-bg text-tone-critical-fg rounded-md px-3 py-2 text-sm"
        >
          {t('login.rateLimited')}
        </p>
      ) : state && !state.ok && !fe ? (
        <FormError error={state.error} />
      ) : null}
      <SubmitButton size="lg" data-ui-key="login-form-submit">
        {t('login.submit')}
      </SubmitButton>
    </form>
  );
}

// ── AUTH-02 (REQ-001) ───────────────────────────────────────────────
export function SignupForm() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const [state, action] = useActionState(signupCompany, null);
  const fe = fieldErrors(state);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormRow
        label={t('field.companyName')}
        htmlFor="su-company"
        errors={fe?.companyName}
        required
      >
        <Input
          id="su-company"
          name="companyName"
          maxLength={100}
          aria-describedby="su-company-error"
          required
        />
      </FormRow>
      <FormRow label={t('field.displayName')} htmlFor="su-name" errors={fe?.displayName} required>
        <Input
          id="su-name"
          name="displayName"
          maxLength={80}
          autoComplete="name"
          aria-describedby="su-name-error"
          required
        />
      </FormRow>
      <FormRow
        label={t('field.email')}
        htmlFor="su-email"
        errors={fe?.email}
        hint={t('signup.noEmailVerify')}
        required
      >
        <Input
          id="su-email"
          name="email"
          type="email"
          autoComplete="email"
          aria-describedby="su-email-error"
          required
        />
      </FormRow>
      <FormRow
        label={t('field.password')}
        htmlFor="su-password"
        errors={fe?.password}
        hint={t('signup.passwordHelp')}
        required
      >
        <Input
          id="su-password"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-describedby="su-password-error"
          required
        />
      </FormRow>
      <FormRow
        label={t('field.passwordConfirm')}
        htmlFor="su-password2"
        errors={fe?.passwordConfirm}
        required
      >
        <Input
          id="su-password2"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          aria-describedby="su-password2-error"
          required
        />
      </FormRow>
      <div>
        <NativeCheckbox
          name="agree"
          label={t('signup.agree')}
          aria-invalid={fe?.agree ? true : undefined}
          aria-describedby={fe?.agree ? 'su-agree-error' : undefined}
        />
        {fe?.agree ? (
          <p id="su-agree-error" role="alert" className="text-destructive text-meta mt-1">
            {t('signup.agreeRequired')}
          </p>
        ) : null}
      </div>
      {state && !state.ok && state.error.code === 'RATE_LIMITED' ? (
        <p
          role="alert"
          className="bg-tone-critical-bg text-tone-critical-fg rounded-md px-3 py-2 text-sm"
        >
          {t('signup.rateLimited')}
        </p>
      ) : state && !state.ok && state.error.code === 'CONFLICT' ? (
        <div
          role="alert"
          className="bg-tone-caution-bg text-tone-caution-fg rounded-md px-3 py-2 text-sm"
        >
          <p>{t('signup.unavailable')}</p>
          {state.error.ref ? (
            <p className="text-meta mt-1">{tc('state.errorRef', { ref: state.error.ref })}</p>
          ) : null}
        </div>
      ) : state && !state.ok && !fe ? (
        <FormError error={state.error} />
      ) : null}
      <SubmitButton size="lg" data-ui-key="signup-form-submit">
        {t('signup.submit')}
      </SubmitButton>
    </form>
  );
}

// ── AUTH-03 (REQ-004) ───────────────────────────────────────────────
export function InviteNewAccountForm({ token }: { token: string }) {
  const t = useTranslations('auth');
  const [state, action] = useActionState(acceptInvitationWithNewAccount, null);
  const fe = fieldErrors(state);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormRow label={t('field.displayName')} htmlFor="inv-name" errors={fe?.displayName} required>
        <Input
          id="inv-name"
          name="displayName"
          maxLength={80}
          autoComplete="name"
          aria-describedby="inv-name-error"
          required
        />
      </FormRow>
      <FormRow
        label={t('field.password')}
        htmlFor="inv-password"
        errors={fe?.password}
        hint={t('signup.passwordHelp')}
        required
      >
        <Input
          id="inv-password"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-describedby="inv-password-error"
          required
        />
      </FormRow>
      <FormRow
        label={t('field.passwordConfirm')}
        htmlFor="inv-password2"
        errors={fe?.passwordConfirm}
        required
      >
        <Input
          id="inv-password2"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          aria-describedby="inv-password2-error"
          required
        />
      </FormRow>
      {state && !state.ok && state.error.code === 'CONFLICT' ? (
        <p
          role="alert"
          className="bg-tone-caution-bg text-tone-caution-fg rounded-md px-3 py-2 text-sm"
        >
          {t('invite.createFailed')}
        </p>
      ) : state && !state.ok && !fe ? (
        <FormError error={state.error} />
      ) : null}
      <SubmitButton size="lg" data-ui-key="invite-create-account-submit">
        {t('invite.createAccount')}
      </SubmitButton>
    </form>
  );
}

export function InviteAcceptButton({ token }: { token: string }) {
  const t = useTranslations('auth');
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult<never> | null>(null);
  return (
    <div className="flex flex-col gap-3">
      {result && !result.ok ? <FormError error={result.error} /> : null}
      <Button
        size="lg"
        disabled={pending}
        aria-busy={pending}
        data-ui-key="invite-accept-submit"
        onClick={() => start(async () => setResult(await acceptInvitationAsCurrentUser(token)))}
      >
        {t('invite.accept')}
      </Button>
    </div>
  );
}

// ── AUTH-04 (REQ-005) ───────────────────────────────────────────────
export function ResetPasswordForm() {
  const t = useTranslations('auth');
  const [state, action] = useActionState(resetPassword, null);
  const fe = fieldErrors(state);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormRow
        label={t('field.newPassword')}
        htmlFor="rp-password"
        errors={fe?.password}
        hint={t('signup.passwordHelp')}
        required
      >
        <Input
          id="rp-password"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-describedby="rp-password-error"
          required
        />
      </FormRow>
      <FormRow
        label={t('field.passwordConfirm')}
        htmlFor="rp-password2"
        errors={fe?.passwordConfirm}
        required
      >
        <Input
          id="rp-password2"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          aria-describedby="rp-password2-error"
          required
        />
      </FormRow>
      {state && !state.ok && !fe ? <FormError error={state.error} /> : null}
      <SubmitButton size="lg" data-ui-key="reset-form-submit">
        {t('reset.submit')}
      </SubmitButton>
    </form>
  );
}

// ── AUTH-06 첫 로그인 비밀번호 변경 (D-15) ─────────────────────────────
export function FirstPasswordForm() {
  const t = useTranslations('auth');
  const [state, action] = useActionState(completeFirstPassword, null);
  const fe = fieldErrors(state);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormRow
        label={t('field.tempPassword')}
        htmlFor="fp-current"
        errors={fe?.currentPassword}
        hint={t('firstPassword.tempHint')}
        required
      >
        <Input
          id="fp-current"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          aria-describedby="fp-current-error"
          required
        />
      </FormRow>
      <FormRow
        label={t('field.newPassword')}
        htmlFor="fp-password"
        errors={fe?.password}
        hint={t('signup.passwordHelp')}
        required
      >
        <Input
          id="fp-password"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-describedby="fp-password-error"
          required
        />
      </FormRow>
      <FormRow
        label={t('field.passwordConfirm')}
        htmlFor="fp-password2"
        errors={fe?.passwordConfirm}
        required
      >
        <Input
          id="fp-password2"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          aria-describedby="fp-password2-error"
          required
        />
      </FormRow>
      {state && !state.ok && !fe ? <FormError error={state.error} /> : null}
      <SubmitButton size="lg" data-ui-key="first-password-submit">
        {t('firstPassword.submit')}
      </SubmitButton>
    </form>
  );
}
