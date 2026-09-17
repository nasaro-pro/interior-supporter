"use server";

import { redirect } from "next/navigation";
import { requireCompanyStaff } from "@/lib/authz";
import { createCustomer, updateCustomer } from "@/modules/customer/service";

export async function createCustomerAction(
  companySlug: string,
  formData: FormData,
) {
  const ctx = await requireCompanyStaff(companySlug);
  await createCustomer(ctx, {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? "") || undefined,
    email: String(formData.get("email") ?? "") || undefined,
    memo: String(formData.get("memo") ?? "") || undefined,
  });
  redirect(`/app/${companySlug}/admin/customers`);
}

export async function updateCustomerAction(
  companySlug: string,
  customerId: string,
  formData: FormData,
) {
  const ctx = await requireCompanyStaff(companySlug);
  await updateCustomer(ctx, customerId, {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? "") || undefined,
    email: String(formData.get("email") ?? "") || undefined,
    memo: String(formData.get("memo") ?? "") || undefined,
  });
  redirect(`/app/${companySlug}/admin/customers`);
}
