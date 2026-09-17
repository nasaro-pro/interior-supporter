import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { companies } from "@/modules/company/schema";
import { users } from "@/modules/membership/auth-tables";
import { projects } from "@/modules/project/schema";
import { approvalEnum, visibilityEnum } from "../../lib/db/enums";

export const designVersions = pgTable(
  "design_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    versionNo: integer("version_no").notNull(),
    versionName: varchar("version_name", { length: 50 }).notNull(),
    storageObjectId: uuid("storage_object_id").notNull(),
    previewObjectId: uuid("preview_object_id"),
    changeNote: text("change_note"),
    approvalStatus: approvalEnum("approval_status").notNull().default("pending"),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvalNote: text("approval_note"),
    visibilityStatus: visibilityEnum("visibility_status")
      .notNull()
      .default("draft"),
    publishAt: timestamp("publish_at", { withTimezone: true }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("design_versions_project_no_uq").on(t.projectId, t.versionNo),
    index("design_versions_project_vis_idx").on(
      t.projectId,
      t.visibilityStatus,
    ),
  ],
);
