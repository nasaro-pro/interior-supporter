import { redirect } from "next/navigation";
import { requireCompanyStaff } from "@/lib/authz";

/**
 * postLoginPath() 가 스태프를 /app/{slug} 로 보낸다(7.3).
 * 이 경로에 페이지가 없으면 로그인 직후 404 가 된다.
 * 여기서 멤버십을 확인하고(고객 계정은 403) 대시보드로 넘긴다.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const ctx = await requireCompanyStaff(companySlug);
  if (ctx.roles.includes("field_worker") && !ctx.roles.includes("company_admin") && !ctx.roles.includes("project_manager")) {
    redirect(`/app/${companySlug}/field`);
  }
  redirect(`/app/${companySlug}/admin`);
}
