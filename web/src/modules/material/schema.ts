import {
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
  approvalEnum,
  purchaseStatusEnum,
  spaceCategoryEnum,
  visibilityEnum,
} from "../../lib/db/enums";

export const materials = pgTable(
  "materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    spaceCategory: spaceCategoryEnum("space_category").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    brand: varchar("brand", { length: 100 }),
    spec: varchar("spec", { length: 200 }),
    color: varchar("color", { length: 50 }),
    applyLocation: varchar("apply_location", { length: 200 }),
    imageObjectId: uuid("image_object_id"),
    externalUrl: text("external_url"),
    linkTitle: varchar("link_title", { length: 300 }),
    linkSiteName: varchar("link_site_name", { length: 100 }),
    linkImageObjectId: uuid("link_image_object_id"),
    linkFetchedAt: timestamp("link_fetched_at", { withTimezone: true }),
    description: text("description"),
    purchaseStatus: purchaseStatusEnum("purchase_status")
      .notNull()
      .default("quote"),
    approvalStatus: approvalEnum("approval_status").notNull().default("pending"),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
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
    index("materials_project_space_idx").on(t.projectId, t.spaceCategory),
    index("materials_project_vis_idx").on(t.projectId, t.visibilityStatus),
  ],
);

export const materialStatusHistory = pgTable(
  "material_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    fromStatus: purchaseStatusEnum("from_status"),
    toStatus: purchaseStatusEnum("to_status").notNull(),
    note: text("note"),
    changedBy: uuid("changed_by")
      .notNull()
      .references(() => users.id),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("material_history_material_idx").on(t.materialId)],
);
