import { systemJob } from "@/lib/tenancy/system";
import { logger } from "@/lib/logger";
import { purgeExpiredRateLimits } from "@/lib/ratelimit";
import { publishDueDesigns } from "@/modules/design/service";
import { publishDueMaterials } from "@/modules/material/service";
import { publishDuePhotos } from "@/modules/photo/service";
import { publishDueSchedules } from "@/modules/schedule/service";
import { publishDueBlocks } from "@/modules/page-builder/service";
import { retryFailedNotifications } from "@/lib/notify/dispatch";
import { getPlatformSetting, listCompanyIds } from "@/modules/company/repo";
import { updateCompanyById } from "@/modules/company/repo";
import { deleteExpiredAuditLogs } from "@/modules/audit";
import {
  purgeExpiredInvitations,
  purgeExpiredSessions,
  purgeExpiredVerifications,
} from "@/modules/membership/repo";
import { sumReadyBytesForCompany } from "@/modules/storage-quota/repo";

export async function runPublishScheduled() {
  const ctx = systemJob("publish-scheduled");
  const now = new Date();
  const designs = await publishDueDesigns(ctx, now);
  const materials = await publishDueMaterials(ctx, now);
  const photos = await publishDuePhotos(ctx, now);
  const schedules = await publishDueSchedules(ctx, now);
  const blocks = await publishDueBlocks(ctx, now);
  const result = { designs, materials, photos, schedules, blocks };
  logger.info("cron.publish_scheduled", result);
  return result;
}

export async function runNotificationRetry() {
  const retried = await retryFailedNotifications();
  return { retried };
}

function retentionDays(value: unknown) {
  if (typeof value === "number" && value > 0) return value;
  if (value && typeof value === "object" && "default" in value) {
    const days = (value as { default: unknown }).default;
    if (typeof days === "number" && days > 0) return days;
  }
  throw new Error("audit_retention_days 설정이 없습니다.");
}

export async function runRetention() {
  const ctx = systemJob("retention");
  const days = retentionDays(await getPlatformSetting("audit_retention_days"));
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const now = new Date();
  const audit = await deleteExpiredAuditLogs(ctx, cutoff);
  const sessions = await purgeExpiredSessions(ctx, now);
  const verifications = await purgeExpiredVerifications(ctx, now);
  const invitations = await purgeExpiredInvitations(ctx, now);
  // 14.3 — 가장 긴 창(1일)의 2배보다 오래된 카운터를 지운다.
  const rateLimits = await purgeExpiredRateLimits(
    new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
  );
  const result = { audit, sessions, verifications, invitations, rateLimits, days };
  // 12.3 — 삭제 건수를 운영 로그에 남긴다.
  logger.info("cron.retention", result);
  return result;
}

export async function runStorageRecalc() {
  const ctx = systemJob("storage-recalc");
  const ids = await listCompanyIds(ctx);
  let updated = 0;
  for (const companyId of ids) {
    const bytes = await sumReadyBytesForCompany(ctx, companyId);
    const mb = Math.ceil(bytes / (1024 * 1024));
    await updateCompanyById(ctx, companyId, { storageUsedMb: mb });
    updated += 1;
  }
  logger.info("cron.storage_recalc", { companies: updated });
  return { companies: updated };
}
