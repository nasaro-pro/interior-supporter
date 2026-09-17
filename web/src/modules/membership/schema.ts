import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { companies } from "@/modules/company/schema";
import { projects } from "@/modules/project/schema";
import { inviteKindEnum, membershipRoleEnum } from "../../lib/db/enums";
import { users } from "./auth-tables";

export { accounts, sessions, users, verifications } from "./auth-tables";

/** 한 계정이 여러 업체에 다른 역할로 속할 수 있다 (ADR-10) */
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    grantedBy: uuid("granted_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("memberships_user_company_role_uq").on(
      t.userId,
      t.companyId,
      t.role,
    ),
    index("memberships_company_idx").on(t.companyId, t.isActive),
  ],
);

/** 업체 멤버 초대 · 프로젝트 고객 초대 공용 */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: inviteKindEnum("kind").notNull(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    role: membershipRoleEnum("role"),
    email: varchar("email", { length: 200 }),
    token: text("token").notNull(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id),
    acceptedBy: uuid("accepted_by").references(() => users.id),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("invitations_token_uq").on(t.token),
    index("invitations_company_idx").on(t.companyId),
    index("invitations_project_idx").on(t.projectId),
  ],
);
