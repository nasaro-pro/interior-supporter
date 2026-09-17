import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { companies } from "@/modules/company/schema";
import { users } from "@/modules/membership/auth-tables";
import { auditActionEnum } from "../../lib/db/enums";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "cascade",
    }),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorLabel: varchar("actor_label", { length: 50 }),
    actionType: auditActionEnum("action_type").notNull(),
    targetType: varchar("target_type", { length: 50 }).notNull(),
    targetId: uuid("target_id"),
    projectId: uuid("project_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_company_created_idx").on(t.companyId, t.createdAt),
    index("audit_target_idx").on(t.targetType, t.targetId),
    index("audit_action_idx").on(t.companyId, t.actionType, t.createdAt),
  ],
);
