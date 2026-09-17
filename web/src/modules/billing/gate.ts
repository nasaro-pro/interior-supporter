import { ForbiddenError } from "@/lib/errors";
import { messages } from "@/lib/messages";
import { getPlanTier, getPlatformSetting } from "@/modules/company/repo";

/**
 * ARCHITECTURE.md 13.1 — plan gate.
 *
 * 유료화 이전에는 `plan_enforcement_enabled=false` 이므로 **항상 허용**이다.
 * 그럼에도 호출 지점을 지금 심어 두는 이유는 문서①5.2 가 정한 방침이다:
 * "코드에는 기능별 잠금 스위치를 미리 심어 기본값을 '열림'으로 두고
 *  유료화 시점에 설정값만 바꿔 제한을 켠다."
 * 나중에 심으면 8개 기능의 분기점을 코드베이스 전체에서 다시 찾아야 한다.
 */
export type PlanTier = "free" | "starter" | "pro" | "enterprise";
export type FeatureMode = boolean | "template_only";

export const FEATURES = [
  "cms_editor",
  "company_template",
  "before_after",
  "purchase_tracking",
  "approval_workflow",
  "advanced_notification",
  "white_label",
  "api_access",
] as const;
export type Feature = (typeof FEATURES)[number];

/** 문서② 7장 요금제-기능 매트릭스 */
export const PLAN_MATRIX: Record<PlanTier, Record<Feature, FeatureMode>> = {
  free: {
    cms_editor: "template_only",
    company_template: false,
    before_after: false,
    purchase_tracking: false,
    approval_workflow: false,
    advanced_notification: false,
    white_label: false,
    api_access: false,
  },
  starter: {
    cms_editor: true,
    company_template: true,
    before_after: true,
    purchase_tracking: true,
    approval_workflow: false,
    advanced_notification: false,
    white_label: false,
    api_access: false,
  },
  pro: {
    cms_editor: true,
    company_template: true,
    before_after: true,
    purchase_tracking: true,
    approval_workflow: true,
    advanced_notification: true,
    white_label: false,
    api_access: false,
  },
  enterprise: {
    cms_editor: true,
    company_template: true,
    before_after: true,
    purchase_tracking: true,
    approval_workflow: true,
    advanced_notification: true,
    white_label: true,
    api_access: true,
  },
};

export type LimitKey = "active_projects" | "pm_seats" | "storage_mb";
export type LimitResult = {
  allowed: boolean;
  limit: number | null;
  current: number;
};

/** 13.3 — 요금제 수치는 코드 상수가 아니라 platform_settings 에 둔다. */
async function enforcementEnabled(): Promise<boolean> {
  return (await getPlatformSetting("plan_enforcement_enabled")) === true;
}

export async function featureMode(
  companyId: string,
  feature: Feature,
): Promise<FeatureMode> {
  if (!(await enforcementEnabled())) return true;
  const tier = (await getPlanTier(companyId)) ?? "free";
  return PLAN_MATRIX[tier][feature];
}

export async function canUse(
  companyId: string,
  feature: Feature,
): Promise<boolean> {
  return (await featureMode(companyId, feature)) !== false;
}

/** 사용할 수 없으면 던진다. 서비스 계층에서 한 줄로 쓰는 형태. */
export async function requireFeature(
  companyId: string,
  feature: Feature,
): Promise<void> {
  if (!(await canUse(companyId, feature))) {
    throw new ForbiddenError(messages.featureLocked);
  }
}

export async function checkLimit(
  companyId: string,
  key: LimitKey,
  current: number,
): Promise<LimitResult> {
  if (!(await enforcementEnabled())) {
    return { allowed: true, limit: null, current };
  }
  const raw = await getPlatformSetting("plan_limits");
  const tier = (await getPlanTier(companyId)) ?? "free";
  const limits = (raw ?? {}) as Partial<
    Record<PlanTier, Partial<Record<LimitKey, number | null>>>
  >;
  const limit = limits[tier]?.[key] ?? null;
  return { allowed: limit === null || current < limit, limit, current };
}

export async function requireLimit(
  companyId: string,
  key: LimitKey,
  current: number,
): Promise<void> {
  const result = await checkLimit(companyId, key, current);
  if (!result.allowed) throw new ForbiddenError(messages.planLimitReached);
}
