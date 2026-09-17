import {
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { companies } from "@/modules/company/schema";
import { users } from "@/modules/membership/auth-tables";
import { projects } from "@/modules/project/schema";
import { projectAssignments } from "@/modules/assignment/schema";
import {
  processCategoryEnum,
  workLogStatusEnum,
} from "../../lib/db/enums";

export const fieldWorkLogs = pgTable(
  "field_work_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id").references(() => projectAssignments.id),
    workDate: date("work_date").notNull(),
    processCategory: processCategoryEnum("process_category").notNull(),
    body: text("body").notNull(),
    issue: text("issue"),
    issueStatus: text("issue_status"),
    status: workLogStatusEnum("status").notNull().default("started"),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    revisionHistory: jsonb("revision_history").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("field_logs_project_date_idx").on(t.projectId, t.workDate),
  ],
);
