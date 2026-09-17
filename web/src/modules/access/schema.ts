import {
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { companies } from "@/modules/company/schema";
import { users } from "@/modules/membership/auth-tables";
import { projects } from "@/modules/project/schema";

/** 이 프로젝트를 볼 수 있는 고객 계정 (부부·가족 등 여러 명 가능) */
export const projectAccess = pgTable(
  "project_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 50 }),
    grantedBy: uuid("granted_by")
      .notNull()
      .references(() => users.id),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("project_access_uq").on(t.projectId, t.userId),
    index("project_access_user_idx").on(t.userId, t.revokedAt),
  ],
);

/** 확정 코드를 입력해 '결정권자'임을 확인한 계정 (7.6절) */
export const projectVerifications = pgTable(
  "project_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** 발급 세대. projects.codeVersion 과 다르면 무효 (I10) */
    codeVersion: integer("code_version").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: varchar("ip_address", { length: 64 }),
  },
  (t) => [
    uniqueIndex("project_verifications_uq").on(
      t.projectId,
      t.userId,
      t.codeVersion,
    ),
  ],
);
