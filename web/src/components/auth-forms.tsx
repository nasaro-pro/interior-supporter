"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createCompanyAction,
  forgotPasswordAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
} from "@/modules/membership/actions";
import { messages } from "@/lib/messages";

type ActionState = { ok: false; error: string } | { ok: true } | null;

function ErrorText({ state }: { state: ActionState }) {
  if (!state || state.ok !== false) return null;
  return <p className="text-sm text-destructive">{state.error}</p>;
}

export function SignupForm() {
  const [state, action] = useActionState(signUpAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
        {messages.nameLabel}
        <input name="name" required className="field" />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
        {messages.emailLabel}
        <input
          name="email"
          type="email"
          required
          className="field"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
        {messages.passwordLabel}
        <input
          name="password"
          type="password"
          minLength={10}
          required
          className="field"
        />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input name="termsAgreed" type="checkbox" required className="mt-1" />
        <span>
          {messages.termsAgree}{" "}
          <Link href="/terms" className="text-link">
            약관
          </Link>
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input name="transferAgreed" type="checkbox" required className="mt-1" />
        <span>
          {messages.transferAgree}{" "}
          <Link href="/privacy" className="text-link">
            개인정보 처리방침
          </Link>
        </span>
      </label>
      <ErrorText state={state} />
      <button type="submit" className="ink-btn">
        {messages.submitSignup}
      </button>
    </form>
  );
}

export function LoginForm() {
  const [state, action] = useActionState(signInAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
        {messages.emailLabel}
        <input
          name="email"
          type="email"
          required
          className="field"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
        {messages.passwordLabel}
        <input
          name="password"
          type="password"
          required
          className="field"
        />
      </label>
      <ErrorText state={state} />
      <button type="submit" className="ink-btn">
        {messages.submitLogin}
      </button>
    </form>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState(forgotPasswordAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
        {messages.emailLabel}
        <input
          name="email"
          type="email"
          required
          className="field"
        />
      </label>
      {state && "ok" in state && state.ok ? (
        <p className="text-sm">{messages.forgotSent}</p>
      ) : null}
      <ErrorText state={state} />
      <button type="submit" className="ink-btn">
        {messages.submitForgot}
      </button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
        {messages.passwordLabel}
        <input
          name="password"
          type="password"
          minLength={10}
          required
          className="field"
        />
      </label>
      <ErrorText state={state} />
      <button type="submit" className="ink-btn">
        {messages.submitReset}
      </button>
    </form>
  );
}

export function CompanyForm() {
  const [state, action] = useActionState(createCompanyAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
        {messages.companyNameLabel}
        <input name="name" required className="field" />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
        {messages.businessTypeLabel}
        <input name="businessType" className="field" />
      </label>
      <ErrorText state={state} />
      <button type="submit" className="ink-btn">
        {messages.submitCompany}
      </button>
    </form>
  );
}
