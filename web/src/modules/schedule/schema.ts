import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { companies } from "@/modules/company/schema";
import { users } from "@/modules/membership/auth-tables";
import { projects } from "@/modules/project/schema";
import {
  processCategoryEnum,
  scheduleTypeEnum,
  visibilityEnum,
} from "../../lib/db/enums";

export const schedules = pgTable(
  "schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: scheduleTypeEnum("type").notNull(),
    processCategory: processCategoryEnum("process_category"),
    title: varchar("title", { length: 200 }).notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
    isAllDay: boolean("is_all_day").notNull().default(false),
    note: text("note"),
    /** 다른 콘텐츠와 동일하게 초안에서 출발한다 (상태 머신 우회 금지) */
    visibilityStatus: visibilityEnum("visibility_status")
      .notNull()
      .default("draft"),
    publishAt: timestamp("publish_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("schedules_project_start_idx").on(t.projectId, t.startAt),
    index("schedules_company_start_idx").on(t.companyId, t.startAt),
  ],
);
