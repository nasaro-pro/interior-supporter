import { and, desc, eq, gte, lt, lte } from "drizzle-orm";
import { db, type DbTx } from "@/lib/db/client";
import { auditLogs } from "@/modules/audit/schema";
import { maskPii } from "@/modules/audit/mask";
import { users } from "@/modules/membership/auth-tables";
import type { DataContext } from "@/lib/tenancy/context";
import { scoped } from "@/lib/tenancy/context";
import { cursorCondition, cursorTs, decodeCursor, paginate } from "@/lib/cursor";

type AuditAction = NonNullable<(typeof auditLogs.$inferInsert)["actionType"]>;
type Executor = typeof db | DbTx;

export type RecordAuditInput = {
  action: AuditAction;
  targetType: string;
  targetId?: string;
  projectId?: string;
  before?: unknown;
  after?: unknown;
  /** ctx 가 companyId 를 갖지 않는 system/platform 경로에서 명시한다 (12.1) */
  companyId?: string;
  /** 요청 스코프에서만 얻을 수 있다. lib/authz 의 requestMeta() 로 채운다 */
  ip?: string;
  userAgent?: string;
};

/**
 * ARCHITECTURE.md 12.1 — actor_label 에는 뭉뚱그린 'staff' 가 아니라
 * 실제 역할을 적는다. 감사 화면에서 총관리자와 PM 의 행위를 구분해야 한다.
 */
function actorLabelOf(ctx?: DataContext): string {
  if (!ctx) return "system";
  switch (ctx.kind) {
    case "staff":
      return ctx.roles.includes("company_admin")
        ? "company_admin"
        : ctx.roles.includes("field_worker") &&
            !ctx.roles.includes("project_manager")
          ? "field_worker"
          : "project_manager";
    case "customer":
      return "customer";
    case "platform":
      return "platform";
    default:
      return "system";
  }
}

export async function recordAudit(
  input: RecordAuditInput,
  ctx?: DataContext,
  tx?: Executor,
): Promise<void> {
  // 확정 지시 댓글만 본문을 그대로 남긴다 (12.1)
  const keepBody = input.action === "binding_comment";
  await (tx ?? db).insert(auditLogs).values({
    companyId:
      input.companyId ??
      (ctx && (ctx.kind === "staff" || ctx.kind === "customer")
        ? ctx.companyId
        : null),
    actorId: ctx && "userId" in ctx ? ctx.userId : null,
    actorLabel: actorLabelOf(ctx),
    actionType: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    projectId:
      input.projectId ??
      (ctx && ctx.kind === "customer" ? ctx.projectId : undefined),
    before: keepBody ? input.before : maskPii(input.before),
    after: keepBody ? input.after : maskPii(input.after),
    ipAddress: input.ip,
    userAgent: input.userAgent,
  });
}

export async function listAuditLogs(
  ctx: DataContext,
  filter: {
    cursor?: string;
    limit?: number;
    actionType?: AuditAction;
    actorId?: string;
    companyId?: string;
    from?: Date;
    to?: Date;
    projectId?: string;
  } = {},
) {
  const limit = filter.limit ?? 20;
  const cursor = decodeCursor(filter.cursor);
  const rows = await db
    .select({
      log: auditLogs,
      actorName: users.name,
      cursorTs: cursorTs(auditLogs.createdAt),
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(
      and(
        scoped(ctx, auditLogs),
        cursorCondition(auditLogs.createdAt, auditLogs.id, cursor),
        filter.actionType ? eq(auditLogs.actionType, filter.actionType) : undefined,
        filter.actorId ? eq(auditLogs.actorId, filter.actorId) : undefined,
        filter.projectId ? eq(auditLogs.projectId, filter.projectId) : undefined,
        filter.companyId && (ctx.kind === "platform" || ctx.kind === "system")
          ? eq(auditLogs.companyId, filter.companyId)
          : undefined,
        filter.from ? gte(auditLogs.createdAt, filter.from) : undefined,
        filter.to ? lte(auditLogs.createdAt, filter.to) : undefined,
      ),
    )
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(limit + 1);

  return paginate(rows, limit, (row) => ({
    createdAtRaw: row.cursorTs,
    id: row.log.id,
  }));
}

/** 12.3 보관 정리. 애플리케이션의 유일한 감사 로그 삭제 경로다 (T11). */
export async function deleteExpiredAuditLogs(ctx: DataContext, cutoff: Date) {
  if (ctx.kind !== "system") return 0;
  const rows = await db
    .delete(auditLogs)
    .where(lt(auditLogs.createdAt, cutoff))
    .returning({ id: auditLogs.id });
  return rows.length;
}
