import { z } from "zod";
import { db } from "@/lib/db/client";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { isStaff, type DataContext } from "@/lib/tenancy/context";
import { staffPolicy } from "@/modules/membership/policy";
import { recordAudit } from "@/modules/audit";
import { requireLimit } from "@/modules/billing/gate";
import { assertStaffOwnsProject } from "@/lib/authz";
import { findCustomerById } from "@/modules/customer/repo";
import { insertPage } from "@/modules/page-builder/repo";
import { emit } from "@/lib/notify";
import {
  countActiveProjects,
  findProjectById,
  insertProject,
  updateProjectRow,
} from "@/modules/project/repo";

const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

export const processCategory = z.enum([
  "demolition",
  "electrical",
  "carpentry",
  "tile",
  "film",
  "flooring",
  "fixture_setting",
  "wallpaper",
  "furniture_install",
  "lighting_install",
  "finishing",
]);

export const projectStatus = z.enum(["active", "paused", "done", "archived"]);

export const createProjectInput = z.object({
  title: z.string().trim().min(1).max(200),
  customerId: z.string().uuid(),
  managerId: z.string().uuid().optional(),
  address: z.string().max(500).optional(),
  contractDate: optionalDate,
  startDate: optionalDate,
  endDate: optionalDate,
});

/**
 * 문서① 4.3 / ② 4장 — 고객 화면의 "현재 진행 단계".
 * 예전에는 읽기만 하고 설정할 경로가 없어 영구히 비어 있었다.
 */
export const updateProjectInput = createProjectInput.extend({
  currentProcess: processCategory.nullish(),
  status: projectStatus.optional(),
});

export async function createProject(
  ctx: DataContext,
  input: z.infer<typeof createProjectInput>,
) {
  if (!isStaff(ctx)) throw new ForbiddenError();
  if (!staffPolicy.createProject(ctx.roles)) throw new ForbiddenError();
  const parsed = createProjectInput.parse(input);
  const canAssignOthers = ctx.roles.includes("company_admin");
  const managerId = canAssignOthers ? (parsed.managerId ?? ctx.userId) : ctx.userId;
  const customer = await findCustomerById(ctx, parsed.customerId);
  if (!customer) throw new NotFoundError();
  // 13.1 plan gate — 유료화 전에는 항상 통과한다.
  await requireLimit(ctx.companyId, "active_projects", await countActiveProjects(ctx));

  const project = await db.transaction(async (tx) => {
    const created = await insertProject(
      ctx,
      {
        companyId: ctx.companyId,
        customerId: parsed.customerId,
        managerId,
        title: parsed.title,
        address: parsed.address || null,
        contractDate: parsed.contractDate,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        createdBy: ctx.userId,
      },
      tx,
    );
    await insertPage(
      ctx,
      { companyId: ctx.companyId, projectId: created.id, title: "프로젝트 홈" },
      tx,
    );
    await recordAudit(
      {
        action: "project_create",
        targetType: "project",
        targetId: created.id,
        projectId: created.id,
        after: { title: created.title, managerId },
      },
      ctx,
      tx,
    );
    return created;
  });
  await emit("project.created", {
    companyId: ctx.companyId,
    projectId: project.id,
    targetId: project.id,
    actorUserId: ctx.userId,
  });
  return project;
}

export async function updateProject(
  ctx: DataContext,
  projectId: string,
  raw: z.infer<typeof updateProjectInput>,
) {
  if (!isStaff(ctx)) throw new ForbiddenError();
  if (!staffPolicy.createProject(ctx.roles)) throw new ForbiddenError();
  const parsed = updateProjectInput.parse(raw);
  const existing = await findProjectById(ctx, projectId);
  if (!existing) throw new NotFoundError();
  await assertStaffOwnsProject(ctx, projectId);
  const canAssignOthers = ctx.roles.includes("company_admin");
  const managerId = canAssignOthers ? (parsed.managerId ?? existing.managerId) : existing.managerId;
  const currentProcess = parsed.currentProcess ?? null;
  const status = parsed.status ?? existing.status;
  const row = await db.transaction(async (tx) => {
    const updated = await updateProjectRow(
      ctx,
      projectId,
      {
        title: parsed.title,
        customerId: parsed.customerId,
        managerId,
        address: parsed.address || null,
        contractDate: parsed.contractDate,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        currentProcess,
        status,
      },
      tx,
    );
    await recordAudit(
      {
        action: "project_update",
        targetType: "project",
        targetId: projectId,
        projectId,
        before: {
          title: existing.title,
          currentProcess: existing.currentProcess,
          status: existing.status,
          managerId: existing.managerId,
        },
        after: { title: parsed.title, currentProcess, status, managerId },
      },
      ctx,
      tx,
    );
    return updated;
  });
  if (!row) throw new NotFoundError();
  return row;
}

export async function archiveProject(ctx: DataContext, projectId: string) {
  if (!isStaff(ctx)) throw new ForbiddenError();
  if (!staffPolicy.createProject(ctx.roles)) throw new ForbiddenError();
  const existing = await findProjectById(ctx, projectId);
  if (!existing) throw new NotFoundError();
  await assertStaffOwnsProject(ctx, projectId);
  return db.transaction(async (tx) => {
    const row = await updateProjectRow(ctx, projectId, { status: "archived" }, tx);
    await recordAudit(
      {
        action: "project_archive",
        targetType: "project",
        targetId: projectId,
        projectId,
        before: { status: existing.status },
        after: { status: "archived" },
      },
      ctx,
      tx,
    );
    return row;
  });
}
