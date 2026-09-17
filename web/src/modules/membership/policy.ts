import type { CompanyRole } from "@/lib/tenancy/context";

export const staffPolicy = {
  manageMembers: (r: CompanyRole[]) => r.includes("company_admin"),
  manageCompanySettings: (r: CompanyRole[]) => r.includes("company_admin"),
  viewCompanyAuditLog: (r: CompanyRole[]) => r.includes("company_admin"),
  saveCompanyTemplate: (r: CompanyRole[]) => r.includes("company_admin"),
  approvePromotion: (r: CompanyRole[]) => r.includes("company_admin"),
  createProject: (r: CompanyRole[]) =>
    r.includes("company_admin") || r.includes("project_manager"),
  editProjectContent: (r: CompanyRole[]) => r.includes("project_manager"),
  requestPromotion: (r: CompanyRole[]) => r.includes("project_manager"),
  recordFieldWork: (r: CompanyRole[]) =>
    r.includes("field_worker") ||
    r.includes("project_manager") ||
    r.includes("company_admin"),
} as const;
