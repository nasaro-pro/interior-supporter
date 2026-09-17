import { formatInTimeZone } from "date-fns-tz";
import { SEOUL } from "@/lib/datetime";
import { env } from "@/lib/config/env";
import { logger } from "@/lib/logger";
import { systemJob } from "@/lib/tenancy/system";
import { listCustomerUserIds } from "@/modules/access/repo";
import { findProjectById } from "@/modules/project/repo";
import { listCompanyMembersFor, findUserEmail } from "@/modules/membership/repo";
import { findCompanyById } from "@/modules/company/repo";
import {
  insertOutbound,
  listFailedNotifications,
  listPreferences,
  markOutbound,
  bumpRetry,
} from "@/modules/notification/repo";
import { EmailChannelAdapter } from "@/lib/notify/channels/email";
import { InAppChannelAdapter } from "@/lib/notify/channels/inapp";
import { KakaoAlimtalkChannelAdapter } from "@/lib/notify/channels/kakao-alimtalk";
import { SmsChannelAdapter } from "@/lib/notify/channels/sms";
import { renderTemplate } from "@/lib/notify/templates";
import type { NotificationChannelAdapter } from "@/lib/notify/types";

const channels: NotificationChannelAdapter[] = [
  new InAppChannelAdapter(),
  new EmailChannelAdapter(),
  new KakaoAlimtalkChannelAdapter(),
  new SmsChannelAdapter(),
];

export type EmitInput = {
  companyId: string;
  projectId?: string;
  targetId: string;
  actorUserId?: string;
  userIds?: string[];
  variables?: Record<string, string>;
};

/**
 * ARCHITECTURE.md 11.2 / 6.3 — 알림 발송은 사용자 권한으로 하는 일이 아니라
 * 시스템이 하는 부수작업이다. staff 컨텍스트를 조립하지 않고 system 으로 돈다.
 * 업체 범위가 필요한 조회는 companyId 를 인자로 명시해 넘긴다.
 */
const jobCtx = () => systemJob("notify-dispatch");

/** 수신자와 그 수신자가 이 프로젝트에서 고객인지(=포털 링크 대상인지) */
type Recipient = { userId: string; isCustomer: boolean };

async function recipients(
  eventType: string,
  input: EmitInput,
): Promise<Recipient[]> {
  const ctx = jobCtx();
  const members = await listCompanyMembersFor(ctx, input.companyId);
  const admins = members
    .filter((m) => m.membership.isActive && m.membership.role === "company_admin")
    .map((m) => m.user.id);

  const staff = (ids: string[]): Recipient[] =>
    [...new Set(ids)].map((userId) => ({ userId, isCustomer: false }));
  const customers = (ids: string[]): Recipient[] =>
    [...new Set(ids)].map((userId) => ({ userId, isCustomer: true }));

  if (eventType === "template.promotion_requested") return staff(admins);
  if (eventType === "company.status_changed") return staff(admins);
  if (!input.projectId) return [];

  const project = await findProjectById(ctx, input.projectId);
  const customerIds = await listCustomerUserIds(ctx, input.projectId);

  switch (eventType) {
    case "design.published":
    case "design.approval_requested":
    case "material.approval_requested":
    case "photo.published":
      return customers(customerIds);
    case "design.approved":
    case "design.rejected":
    case "material.approved":
    case "project.created":
    case "verification.code_issued":
      return project ? staff([project.managerId]) : [];
    case "comment.created":
      // 고객이 썼으면 담당 PM 에게, 스태프가 썼으면 고객들에게 알린다.
      return input.actorUserId && customerIds.includes(input.actorUserId)
        ? project
          ? staff([project.managerId])
          : []
        : customers(customerIds.filter((id) => id !== input.actorUserId));
    case "comment.binding_created":
      return project ? staff([project.managerId, ...admins]) : staff(admins);
    case "schedule.published":
    case "schedule.changed":
    case "estimate.published":
    case "meeting.published":
      return project
        ? [...customers(customerIds), ...staff([project.managerId])]
        : customers(customerIds);
    case "request.created":
      return project ? staff([project.managerId, ...admins]) : staff(admins);
    case "assignment.changed":
      return input.userIds ? staff(input.userIds) : [];
    case "project.access_granted":
      // 수락한 고객 본인 + 초대한 담당자
      return input.actorUserId
        ? [
            ...customers([input.actorUserId]),
            ...(project ? staff([project.managerId]) : []),
          ]
        : [];
    default:
      return [];
  }
}

function defaultChannels(eventType: string): Array<"inapp" | "email"> {
  if (
    eventType === "photo.published" ||
    eventType === "project.created" ||
    eventType === "verification.code_issued"
  ) {
    return ["inapp"];
  }
  if (eventType === "template.promotion_requested") return ["inapp"];
  if (
    eventType === "project.access_granted" ||
    eventType === "company.status_changed"
  ) {
    return ["email"];
  }
  return ["inapp", "email"];
}

/**
 * 11.2 — 링크는 수신자 종류에 따라 다르다.
 * 스태프에게 포털 주소를 보내면 project_access 가 없어 403 이 된다.
 */
function linkFor(
  isCustomer: boolean,
  projectId: string | undefined,
  companySlug: string | null,
): string {
  const base = env.NEXT_PUBLIC_APP_URL;
  if (isCustomer) {
    return projectId ? `${base}/portal/${projectId}/home` : `${base}/portal`;
  }
  if (!companySlug) return base;
  return projectId
    ? `${base}/app/${companySlug}/projects/${projectId}/overview`
    : `${base}/app/${companySlug}/admin`;
}

export async function emit(eventType: string, input: EmitInput): Promise<void> {
  try {
    await dispatchNotification(eventType, input);
  } catch (error) {
    // 알림 실패가 본 작업을 롤백하지 않는다. 다만 흔적은 남긴다 (17.2).
    logger.warn("notify.dispatch_failed", {
      eventType,
      reason: error instanceof Error ? error.name : "unknown",
    });
  }
}

export async function dispatchNotification(
  eventType: string,
  input: EmitInput,
): Promise<void> {
  const ctx = jobCtx();
  const hour = formatInTimeZone(new Date(), SEOUL, "yyyyMMddHH");
  const dedupeBase = `${eventType}:${input.targetId}:${hour}`;

  const targets: Recipient[] = input.userIds
    ? input.userIds.map((userId) => ({ userId, isCustomer: true }))
    : await recipients(eventType, input);

  if (targets.length === 0) return;

  const company = await findCompanyById(ctx, input.companyId);
  const seen = new Set<string>();

  for (const target of targets) {
    if (seen.has(target.userId)) continue;
    seen.add(target.userId);

    const vars = {
      url: linkFor(target.isCustomer, input.projectId, company?.slug ?? null),
      ...input.variables,
    };
    const rendered = renderTemplate(eventType, vars);
    const prefs = await listPreferences(ctx, target.userId);
    const pref = prefs.find((p) => p.eventType === eventType);
    const profile = await findUserEmail(ctx, target.userId);

    for (const channel of defaultChannels(eventType)) {
      const adapter = channels.find(
        (c) => c.channel === channel && c.isAvailable(),
      );
      if (!adapter) continue;
      if (channel === "inapp" && pref && !pref.inappEnabled) continue;
      if (channel === "email" && pref && !pref.emailEnabled) continue;
      if (channel === "email" && !profile?.email) continue;

      const row = await insertOutbound(ctx, {
        companyId: input.companyId,
        userId: target.userId,
        projectId: input.projectId,
        eventType,
        channel,
        payload: vars,
        dedupeKey: `${dedupeBase}:${target.userId}`,
        status: "queued",
      });
      if (!row) continue; // dedupe 로 이미 보낸 건

      const result = await adapter.send({
        to: channel === "email" ? profile!.email : target.userId,
        subject: rendered.subject,
        body: rendered.body,
        templateKey: eventType,
        variables: vars,
      });
      await markOutbound(ctx, row.id, result.ok ? "sent" : "failed", result.error);
      if (!result.ok) {
        logger.warn("notify.send_failed", { eventType, channel });
      }
    }
  }
}

export { channels };

/** ARCHITECTURE.md 11.3 — 지수 백오프로 최대 3회 재시도 */
export const MAX_NOTIFY_RETRY = 3;

export async function retryFailedNotifications(): Promise<number> {
  const ctx = systemJob("notification-retry");
  const rows = await listFailedNotifications(ctx);
  const now = Date.now();
  let retried = 0;

  for (const row of rows) {
    if (row.retryCount >= MAX_NOTIFY_RETRY) continue;
    const waitMs = 60_000 * 2 ** row.retryCount;
    if (now - row.createdAt.getTime() < waitMs) continue;

    await bumpRetry(ctx, row.id);
    const adapter = channels.find(
      (c) => c.channel === row.channel && c.isAvailable(),
    );
    const vars = (row.payload ?? {}) as Record<string, string>;
    const rendered = renderTemplate(row.eventType, vars);
    const profile = await findUserEmail(ctx, row.userId);

    if (!adapter) {
      await markOutbound(ctx, row.id, "failed", "channel unavailable");
      continue;
    }
    if (row.channel === "email" && !profile?.email) {
      await markOutbound(ctx, row.id, "failed", "no email");
      continue;
    }

    const result = await adapter.send({
      to: row.channel === "email" ? profile!.email : row.userId,
      subject: rendered.subject,
      body: rendered.body,
      templateKey: row.eventType,
      variables: vars,
    });
    await markOutbound(ctx, row.id, result.ok ? "sent" : "failed", result.error);
    retried += 1;
  }
  logger.info("notify.retry", { retried });
  return retried;
}
