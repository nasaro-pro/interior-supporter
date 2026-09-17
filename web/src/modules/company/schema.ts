import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  jsonb,
} from "drizzle-orm/pg-core";
import { users } from "@/modules/membership/auth-tables";
import { companyStatusEnum, planTierEnum } from "../../lib/db/enums";

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    businessType: varchar("business_type", { length: 50 }),
    /** 체험 상태를 두지 않는다 — 가입 즉시 active (방침 6) */
    status: companyStatusEnum("status").notNull().default("active"),
    planTier: planTierEnum("plan_tier").notNull().default("free"),
    brandLogoObjectId: uuid("brand_logo_object_id"),
    brandColor: varchar("brand_color", { length: 20 }),
    customDomain: varchar("custom_domain", { length: 200 }),
    storageQuotaMb: integer("storage_quota_mb").notNull().default(1024),
    storageUsedMb: integer("storage_used_mb").notNull().default(0),
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
    uniqueIndex("companies_slug_uq").on(t.slug),
    uniqueIndex("companies_custom_domain_uq").on(t.customDomain),
  ],
);

export const platformSettings = pgTable("platform_settings", {
  key: varchar("key", { length: 80 }).primaryKey(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
