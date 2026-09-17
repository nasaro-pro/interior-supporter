import {
  date,
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
import { processCategoryEnum, visibilityEnum } from "../../lib/db/enums";

export const progressPhotos = pgTable(
  "progress_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    processCategory: processCategoryEnum("process_category").notNull(),
    fieldWorkLogId: uuid("field_work_log_id"),
    storageObjectId: uuid("storage_object_id").notNull(),
    shotDate: date("shot_date"),
    description: text("description"),
    pairGroupId: uuid("pair_group_id"),
    pairRole: varchar("pair_role", { length: 10 }),
    visibilityStatus: visibilityEnum("visibility_status")
      .notNull()
      .default("draft"),
    publishAt: timestamp("publish_at", { withTimezone: true }),
    uploaderId: uuid("uploader_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("photos_project_process_idx").on(t.projectId, t.processCategory),
    index("photos_pair_idx").on(t.pairGroupId),
  ],
);
