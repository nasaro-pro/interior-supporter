"use client";

import { useActionState } from "react";
import { createCompanyByPlatformAction } from "@/modules/company/actions";
import { messages } from "@/lib/messages";

type ActionState = { ok: false; error: string } | { ok: true } | null;

export function CreateCompanyForm() {
  const [state, action] = useActionState(createCompanyByPlatformAction, null);
  return (
    <form action={action} className="paper-card flex flex-col gap-3">
      <p className="gold-label">{messages.registerCompany}</p>
      <p className="text-sm text-muted-foreground">{messages.platformCompaniesHelp}</p>
      <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
        {messages.companyNameLabel}
        <input name="name" required className="field" />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
        {messages.businessTypeLabel}
        <input name="businessType" className="field" />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
        {messages.adminInviteEmail}
        <input name="adminEmail" type="email" required className="field" />
      </label>
      {state && state.ok === false ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <button type="submit" className="ink-btn w-fit">
        {messages.registerCompany}
      </button>
    </form>
  );
}
