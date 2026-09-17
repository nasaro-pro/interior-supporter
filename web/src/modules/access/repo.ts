import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { db, type DbTx } from "@/lib/db/client";
import { projectAccess, projectVerifications } from "@/modules/access/schema";
import { projects } from "@/modules/project/schema";
import { companies } from "@/modules/company/schema";
import { users } from "@/modules/membership/auth-tables";
import {
  assertSameProject,
  assertSameTenant,
  projectScoped,
  scoped,
  type DataContext,
} from "@/lib/tenancy/context";

type Executor = typeof db | DbTx;

export function matchesCurrentCodeVersion(
  verificationVersion: number,
  projectCodeVersion: number,
) {
  return verificationVersion === projectCodeVersion;
}

/**
 * 계정 하나가 여러 업체의 프로젝트에 초대될 수 있으므로(ADR-10) 이 조회는
 * 본질적으로 업체 경계를 가로지른다. 그래서 system 컨텍스트로만 호출한다.
 * 범위는 company_id 가 아니라 user_id 로 좁혀진다.
 */
export async function firstProjectAccess(ctx: DataContext, userId: string) {
  if (ctx.kind !== "system") throw new Error("system 컨텍스트 전용 조회입니다.");
  const [row] = await db
    .select({ projectId: projectAccess.projectId })
    .from(projectAccess)
    .where(and(eq(projectAccess.userId, userId), isNull(projectAccess.revokedAt)))
    .limit(1);
  return row ?? null;
}

export async function insertProjectAccess(
  ctx: DataContext,
  values: typeof projectAccess.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(projectAccess).values(values).returning();
  if (!row) throw new Error("프로젝트 접근 생성에 실패했습니다.");
  assertSameTenant(ctx, row);
  assertSameProject(ctx, row);
  return row;
}

export async function findActiveAccess(
  ctx: DataContext,
  projectId: string,
  userId: string,
) {
  const [row] = await db
    .select()
    .from(projectAccess)
    .where(
      and(
        eq(projectAccess.projectId, projectId),
        eq(projectAccess.userId, userId),
        isNull(projectAccess.revokedAt),
        scoped(ctx, projectAccess),
        projectScoped(ctx, projectAccess),
      ),
    )
    .limit(1);
  if (row) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return row ?? null;
}

export async function isVerified(
  ctx: DataContext,
  projectId: string,
  userId: string,
) {
  const [row] = await db
    .select({ id: projectVerifications.id })
    .from(projectVerifications)
    .innerJoin(projects, eq(projects.id, projectVerifications.projectId))
    .where(
      and(
        eq(projectVerifications.projectId, projectId),
        eq(projectVerifications.userId, userId),
        eq(projectVerifications.codeVersion, projects.codeVersion),
        scoped(ctx, projectVerifications),
        projectScoped(ctx, projectVerifications),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function listProjectParticipants(ctx: DataContext, projectId: string) {
  const rows = await db
    .select({
      access: projectAccess,
      user: users,
      codeVersion: projects.codeVersion,
    })
    .from(projectAccess)
    .innerJoin(users, eq(users.id, projectAccess.userId))
    .innerJoin(projects, eq(projects.id, projectAccess.projectId))
    .where(
      and(
        scoped(ctx, projectAccess),
        projectScoped(ctx, projectAccess),
        eq(projectAccess.projectId, projectId),
        isNull(projectAccess.revokedAt),
      ),
    )
    .orderBy(desc(projectAccess.grantedAt));
  for (const row of rows) {
    assertSameTenant(ctx, row.access);
    assertSameProject(ctx, row.access);
  }
  const verifications = await db
    .select()
    .from(projectVerifications)
    .where(
      and(
        scoped(ctx, projectVerifications),
        projectScoped(ctx, projectVerifications),
        eq(projectVerifications.projectId, projectId),
      ),
    );
  return rows.map((row) => ({
    ...row,
    verified: verifications.some(
      (v) =>
        v.userId === row.user.id && v.codeVersion === row.codeVersion,
    ),
  }));
}

/**
 * 내 프로젝트 목록. firstProjectAccess 와 같은 이유로 system 컨텍스트 전용이다.
 * 정지된 업체(15.3 — 로그인만 차단, 데이터는 보존)의 프로젝트는 목록에서 뺀다.
 */
export async function listAccessForUser(ctx: DataContext, userId: string) {
  if (ctx.kind !== "system") throw new Error("system 컨텍스트 전용 조회입니다.");
  return db
    .select({
      access: projectAccess,
      project: projects,
      company: companies,
    })
    .from(projectAccess)
    .innerJoin(projects, eq(projects.id, projectAccess.projectId))
    .innerJoin(companies, eq(companies.id, projectAccess.companyId))
    .where(
      and(
        eq(projectAccess.userId, userId),
        isNull(projectAccess.revokedAt),
        isNull(projects.deletedAt),
        ne(companies.status, "suspended"),
      ),
    )
    .orderBy(desc(projectAccess.grantedAt));
}

export async function revokeAccess(
  ctx: DataContext,
  accessId: string,
  tx: Executor = db,
) {
  const [row] = await tx
    .update(projectAccess)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(projectAccess.id, accessId),
        scoped(ctx, projectAccess),
        projectScoped(ctx, projectAccess),
      ),
    )
    .returning();
  if (row) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return row ?? null;
}

export async function updateAccessLabel(
  ctx: DataContext,
  accessId: string,
  label: string | null,
) {
  const [row] = await db
    .update(projectAccess)
    .set({ label })
    .where(
      and(
        eq(projectAccess.id, accessId),
        scoped(ctx, projectAccess),
        projectScoped(ctx, projectAccess),
      ),
    )
    .returning();
  if (row) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return row ?? null;
}

export async function insertVerification(
  ctx: DataContext,
  values: typeof projectVerifications.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(projectVerifications).values(values).returning();
  if (!row) throw new Error("확정 기록에 실패했습니다.");
  assertSameTenant(ctx, row);
  assertSameProject(ctx, row);
  return row;
}

export async function findAccessByProjectUser(
  ctx: DataContext,
  projectId: string,
  userId: string,
  tx: Executor = db,
) {
  const [row] = await tx
    .select()
    .from(projectAccess)
    .where(
      and(
        eq(projectAccess.projectId, projectId),
        eq(projectAccess.userId, userId),
        scoped(ctx, projectAccess),
        projectScoped(ctx, projectAccess),
      ),
    )
    .limit(1);
  if (row) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return row ?? null;
}

export async function restoreAccess(
  ctx: DataContext,
  accessId: string,
  grantedBy: string,
  tx: Executor = db,
) {
  const [row] = await tx
    .update(projectAccess)
    .set({ revokedAt: null, grantedBy, grantedAt: new Date() })
    .where(
      and(
        eq(projectAccess.id, accessId),
        scoped(ctx, projectAccess),
        projectScoped(ctx, projectAccess),
      ),
    )
    .returning();
  if (row) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return row ?? null;
}

export async function listCustomerUserIds(ctx: DataContext, projectId: string) {
  const rows = await db
    .select({ userId: projectAccess.userId })
    .from(projectAccess)
    .where(
      and(
        scoped(ctx, projectAccess),
        projectScoped(ctx, projectAccess),
        eq(projectAccess.projectId, projectId),
        isNull(projectAccess.revokedAt),
      ),
    );
  return rows.map((r) => r.userId);
}
