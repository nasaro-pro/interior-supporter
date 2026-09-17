import { pgEnum } from "drizzle-orm/pg-core";

/** 업체 내부 역할. 플랫폼 운영자는 users.isPlatformAdmin 으로 구분 */
export const membershipRoleEnum = pgEnum("membership_role", [
  "company_admin",
  "project_manager",
  "field_worker",
]);
export const companyStatusEnum = pgEnum("company_status", [
  "active",
  "past_due",
  "suspended",
]);
export const planTierEnum = pgEnum("plan_tier", [
  "free",
  "starter",
  "pro",
  "enterprise",
]);
export const projectStatusEnum = pgEnum("project_status", [
  "active",
  "paused",
  "done",
  "archived",
]);

export const visibilityEnum = pgEnum("visibility_status", [
  "draft",
  "review",
  "scheduled",
  "published",
]);
export const approvalEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
]);
export const purchaseStatusEnum = pgEnum("purchase_status", [
  "quote",
  "ordered",
  "shipped",
  "installed",
  "completed",
]);

export const spaceCategoryEnum = pgEnum("space_category", [
  "living_room",
  "kitchen",
  "bathroom",
  "bedroom",
  "lighting",
  "furniture",
  "appliance",
]);
export const processCategoryEnum = pgEnum("process_category", [
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
export const scheduleTypeEnum = pgEnum("schedule_type", [
  "process",
  "visit",
  "confirmed",
  "meeting",
]);
export const assignmentRoleEnum = pgEnum("assignment_role", [
  "designer",
  "field_worker",
]);
export const workLogStatusEnum = pgEnum("work_log_status", [
  "started",
  "in_progress",
  "done",
]);
export const requestStatusEnum = pgEnum("request_process_status", [
  "open",
  "in_progress",
  "done",
]);
export const blockTypeEnum = pgEnum("block_type", [
  "text",
  "gallery",
  "before_after",
  "design_file",
  "material_card",
  "schedule",
  "comment",
  "process",
  "button",
  "divider",
]);
export const templateScopeEnum = pgEnum("template_scope", [
  "platform",
  "company",
  "project",
]);
export const templatePromotionEnum = pgEnum("template_promotion_status", [
  "none",
  "requested",
  "approved",
  "rejected",
]);

/** 일반 대화 vs 확정 지시 (7.6절) */
export const commentKindEnum = pgEnum("comment_kind", ["normal", "binding"]);
export const inviteKindEnum = pgEnum("invite_kind", [
  "company_member",
  "project_customer",
]);
export const notificationChannelEnum = pgEnum("notification_channel", [
  "inapp",
  "email",
  "kakao_alimtalk",
  "sms",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "signup",
  "login",
  "login_failed",
  "logout",
  "email_verified",
  "password_reset",
  "member_invite",
  "member_role_change",
  "member_deactivate",
  "project_access_grant",
  "project_access_revoke",
  "verification_code_issue",
  "verification_success",
  "verification_failed",
  "project_create",
  "project_update",
  "project_archive",
  "visibility_change",
  "approval",
  "binding_comment",
  "file_upload",
  "file_delete",
  "comment_edit",
  "comment_delete",
  "template_promote_request",
  "template_promote_approve",
  "template_promote_reject",
  "company_create",
  "company_status_change",
  "plan_tier_change",
  "subscription_cancel",
  "cross_tenant_query",
  "assignment_grant",
  "assignment_revoke",
  "field_log_complete",
  "estimate_publish",
  "meeting_publish",
  "request_create",
]);
