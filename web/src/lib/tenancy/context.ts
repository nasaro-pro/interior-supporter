import { eq, type Column } from "drizzle-orm";
import { TenantViolationError, type TenantViolationDetails } from "@/lib/errors";

export type CompanyRole = "company_admin" | "project_manager" | "field_worker";

export function isOfficeStaff(roles: CompanyRole[]) {
  return roles.includes("company_admin") || roles.includes("project_manager");
}

export function isFieldOnly(roles: CompanyRole[]) {
  return roles.includes("field_worker") && !isOfficeStaff(roles);
}

export type DataContext =
  | { kind: "staff"; companyId: string; userId: string; roles: CompanyRole[] }
  | {
      kind: "customer";
      companyId: string;
      projectId: string;
      userId: string;
      verified: boolean;
    }
  | { kind: "platform"; userId: string; reason: string }
  | { kind: "system"; job: string };

export function isStaff(
  ctx: DataContext,
): ctx is Extract<DataContext, { kind: "staff" }> {
  return ctx.kind === "staff";
}

export function hasRole(ctx: DataContext, role: CompanyRole): boolean {
  return isStaff(ctx) && ctx.roles.includes(role);
}

/**
 * ARCHITECTURE.md 17.3 — 경계 위반은 즉시 알람 대상이다.
 * Sentry 를 정적 import 하면 모든 번들에 끌려 들어오므로 오류 경로에서만 지연 로드한다.
 */
function raise(details: TenantViolationDetails): never {
  const error = new TenantViolationError(details);
  void import("@/lib/observability")
    .then(({ reportCritical }) =>
      reportCritical(error, { kind: "tenant_violation" }),
    )
    .catch(() => undefined);
  throw error;
}

/** 방어선 2-A — 업체 축 (6.2) */
export function assertSameTenant(
  ctx: DataContext,
  row: { companyId: string | null },
): void {
  if (ctx.kind === "system" || ctx.kind === "platform") return;
  if (!row.companyId || row.companyId !== ctx.companyId) {
    raise({
      ctxKind: ctx.kind,
      ctxCompanyId: ctx.companyId,
      rowCompanyId: row.companyId,
    });
  }
}

/**
 * 방어선 2-B — 프로젝트 축 (I11).
 * 고객 컨텍스트는 자기 프로젝트 밖의 행을 절대 다루지 못한다.
 */
export function assertSameProject(
  ctx: DataContext,
  row: { projectId: string | null },
): void {
  if (ctx.kind !== "customer") return;
  if (!row.projectId || row.projectId !== ctx.projectId) {
    raise({
      ctxKind: ctx.kind,
      ctxProjectId: ctx.projectId,
      rowProjectId: row.projectId,
    });
  }
}

/** company 스코프 필터. platform/system 은 필터 없음(사유가 기록된 경우에만 생성 가능) */
export function scoped<T extends { companyId: Column }>(
  ctx: DataContext,
  table: T,
) {
  if (ctx.kind === "platform" || ctx.kind === "system") return undefined;
  return eq(table.companyId, ctx.companyId);
}

/**
 * project 스코프 필터 (I11).
 * 고객 컨텍스트에서만 조건이 붙는다. staff 는 담당 판정을
 * assertStaffOwnsProject (lib/authz) 가 별도로 수행한다.
 */
export function projectScoped<T extends { projectId: Column }>(
  ctx: DataContext,
  table: T,
) {
  if (ctx.kind !== "customer") return undefined;
  return eq(table.projectId, ctx.projectId);
}
