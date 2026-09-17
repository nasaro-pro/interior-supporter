import type { CompanyRole } from "@/lib/tenancy/context";
import { staffPolicy } from "@/modules/membership/policy";

export const pageBuilderPolicy = {
  editHome: (roles: CompanyRole[]) => staffPolicy.editProjectContent(roles),
  saveProjectTemplate: (roles: CompanyRole[]) => staffPolicy.editProjectContent(roles),
  requestPromotion: (roles: CompanyRole[]) => staffPolicy.requestPromotion(roles),
  approvePromotion: (roles: CompanyRole[]) => staffPolicy.approvePromotion(roles),
  saveCompanyTemplate: (roles: CompanyRole[]) => staffPolicy.saveCompanyTemplate(roles),
} as const;
