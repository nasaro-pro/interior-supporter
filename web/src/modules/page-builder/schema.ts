import {
  index,
  integer,
  jsonb,
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
import {
  blockTypeEnum,
  templatePromotionEnum,
  templateScopeEnum,
  visibilityEnum,
} from "../../lib/db/enums";

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 100 }).notNull().default("프로젝트 홈"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("pages_project_uq").on(t.projectId)],
);

export const blocks = pgTable(
  "blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    blockType: blockTypeEnum("block_type").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    layout: jsonb("layout").notNull().default({ x: 0, y: 0, w: 12, h: 4 }),
    style: jsonb("style").notNull().default({}),
    content: jsonb("content").notNull().default({}),
    visibilityStatus: visibilityEnum("visibility_status")
      .notNull()
      .default("draft"),
    publishAt: timestamp("publish_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("blocks_page_order_idx").on(t.pageId, t.orderIndex),
    index("blocks_scheduled_idx").on(t.visibilityStatus, t.publishAt),
  ],
);

export const templates = pgTable(
  "templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "cascade",
    }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    scope: templateScopeEnum("scope").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    blocksSnapshot: jsonb("blocks_snapshot").notNull(),
    promotionStatus: templatePromotionEnum("promotion_status")
      .notNull()
      .default("none"),
    promotionRequestedBy: uuid("promotion_requested_by").references(
      () => users.id,
    ),
    promotionReviewedBy: uuid("promotion_reviewed_by").references(
      () => users.id,
    ),
    promotionNote: text("promotion_note"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("templates_company_scope_idx").on(t.companyId, t.scope),
    index("templates_promotion_idx").on(t.companyId, t.promotionStatus),
  ],
);
