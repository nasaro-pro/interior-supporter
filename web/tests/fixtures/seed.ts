import { randomUUID } from "node:crypto";
import { like } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { hashCredentialPassword } from "@/lib/auth/password";
import { companies, platformSettings } from "@/modules/company/schema";
import { customers } from "@/modules/customer/schema";
import { accounts, memberships, users } from "@/modules/membership/schema";
import { createProject } from "@/modules/project";
import { insertProjectAccess } from "@/modules/access/repo";
import { storageObjects } from "@/modules/storage-quota/schema";
import { rateLimitCounters } from "@/lib/ratelimit/schema";
import { createDesignVersion } from "@/modules/design/service";

export const E2E_PASSWORD = "Testpass1234";
export const DRAFT_MARKER = "HIDDEN_DRAFT_MARKER";

async function ensureSettings() {
  const rows: Array<[string, unknown]> = [
    ["plan_enforcement_enabled", false],
    [
      "plan_limits",
      {
        free: { active_projects: 1, pm_seats: 1, storage_mb: 1024 },
        starter: { active_projects: 10, pm_seats: 2, storage_mb: 20480 },
        pro: { active_projects: null, pm_seats: 5, storage_mb: 102400 },
        enterprise: { active_projects: null, pm_seats: null, storage_mb: null },
      },
    ],
    ["invite_expire_days", 7],
    ["verify_code_length", 8],
    ["verify_attempt_limit", 5],
    ["verify_attempt_window_min", 10],
    ["audit_retention_days", { default: 180 }],
    [
      "rate_limits",
      {
        login_account: { window_ms: 600000, limit: 10 },
        login_ip: { window_ms: 600000, limit: 30 },
        signup_ip: { window_ms: 3600000, limit: 5 },
        email_per_minute: { window_ms: 60000, limit: 1 },
        email_per_day: { window_ms: 86400000, limit: 5 },
          invite_ip: { window_ms: 600000, limit: 20 },
        file_proxy: { window_ms: 60000, limit: 300 },
        link_preview: { window_ms: 60000, limit: 10 },
        contact_ip: { window_ms: 600000, limit: 5 },
      },
    ],
  ];
  for (const [key, value] of rows) {
    await db
      .insert(platformSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: platformSettings.key, set: { value } });
  }
  // 반복 실행 시 로그인 레이트리밋이 소진되어 E2E 가 깨지지 않게 한다.
  // login_* 만 지운다. verify_code 까지 지우면 같은 DB 를 쓰는 통합 테스트의
  // 잠금 시나리오(T-07)를 중간에 초기화해 버린다.
  await db.delete(rateLimitCounters).where(like(rateLimitCounters.key, "login_%"));
}

async function createUser(name: string, opts?: { platform?: boolean; password?: boolean }) {
  const email = `${name}-${randomUUID().slice(0, 8)}@example.com`;
  const [user] = await db
    .insert(users)
    .values({
      email,
      name,
      emailVerified: true,
      isPlatformAdmin: Boolean(opts?.platform),
    })
    .returning();
  if (opts?.password) {
    const password = await hashCredentialPassword(E2E_PASSWORD);
    await db.insert(accounts).values({
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password,
    });
  }
  return user;
}

export async function seedCanonical(opts?: { withPasswords?: boolean }) {
  await ensureSettings();
  const password = Boolean(opts?.withPasswords);
  const adminA = await createUser("admin-a", { password });
  const pmA = await createUser("pm-a", { password });
  const pmRevoke = await createUser("pm-revoke", { password });
  const adminB = await createUser("admin-b", { password });
  const custA = await createUser("cust-a", { password });
  const custB = await createUser("cust-b", { password });
  const custShared = await createUser("cust-shared", { password });
  const stranger = await createUser("stranger", { password });
  const platform = await createUser("platform", { password, platform: true });

  const [companyA] = await db
    .insert(companies)
    .values({ name: "업체A", slug: `a-${randomUUID().slice(0, 8)}`, createdBy: adminA.id })
    .returning();
  const [companyB] = await db
    .insert(companies)
    .values({ name: "업체B", slug: `b-${randomUUID().slice(0, 8)}`, createdBy: adminB.id })
    .returning();

  await db.insert(memberships).values([
    { userId: adminA.id, companyId: companyA.id, role: "company_admin" },
    { userId: adminA.id, companyId: companyA.id, role: "project_manager" },
    { userId: pmA.id, companyId: companyA.id, role: "project_manager" },
    { userId: pmRevoke.id, companyId: companyA.id, role: "project_manager" },
    { userId: adminB.id, companyId: companyB.id, role: "company_admin" },
    { userId: adminB.id, companyId: companyB.id, role: "project_manager" },
  ]);

  const [customerA] = await db.insert(customers).values({ companyId: companyA.id, name: "고객A" }).returning();
  const [customerB] = await db.insert(customers).values({ companyId: companyB.id, name: "고객B" }).returning();

  const staffA = {
    kind: "staff" as const,
    companyId: companyA.id,
    userId: adminA.id,
    roles: ["company_admin" as const, "project_manager" as const],
  };
  const staffB = {
    kind: "staff" as const,
    companyId: companyB.id,
    userId: adminB.id,
    roles: ["company_admin" as const, "project_manager" as const],
  };
  const pmACtx = {
    kind: "staff" as const,
    companyId: companyA.id,
    userId: pmA.id,
    roles: ["project_manager" as const],
  };

  const projectA1 = await createProject(staffA, { title: "A-1", customerId: customerA.id, managerId: adminA.id });
  const projectA2 = await createProject(pmACtx, { title: "A-2", customerId: customerA.id });
  const projectB1 = await createProject(staffB, { title: "B-1", customerId: customerB.id });
  const projectB2 = await createProject(staffB, { title: "B-2", customerId: customerB.id });

  await insertProjectAccess(staffA, {
    companyId: companyA.id,
    projectId: projectA1.id,
    userId: custA.id,
    grantedBy: adminA.id,
  });
  await insertProjectAccess(staffA, {
    companyId: companyA.id,
    projectId: projectA2.id,
    userId: custShared.id,
    grantedBy: adminA.id,
  });
  await insertProjectAccess(staffB, {
    companyId: companyB.id,
    projectId: projectB1.id,
    userId: custB.id,
    grantedBy: adminB.id,
  });
  await insertProjectAccess(staffB, {
    companyId: companyB.id,
    projectId: projectB1.id,
    userId: custShared.id,
    grantedBy: adminB.id,
  });

  const [object] = await db
    .insert(storageObjects)
    .values({
      companyId: companyA.id,
      projectId: projectA1.id,
      objectKey: `draft-${randomUUID()}`,
      category: "design",
      mimeType: "application/pdf",
      byteSize: 10,
      status: "ready",
      uploadedBy: adminA.id,
    })
    .returning();
  await createDesignVersion(staffA, {
    projectId: projectA1.id,
    versionName: DRAFT_MARKER,
    storageObjectId: object.id,
  });

  return {
    password: E2E_PASSWORD,
    draftMarker: DRAFT_MARKER,
    adminA,
    pmA,
    pmRevoke,
    adminB,
    custA,
    custB,
    custShared,
    stranger,
    platform,
    companyA,
    companyB,
    projectA1,
    projectA2,
    projectB1,
    projectB2,
    staffA,
    staffB,
    pmACtx,
  };
}
