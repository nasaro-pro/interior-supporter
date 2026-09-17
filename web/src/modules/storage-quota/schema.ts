import {
  bigint,
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

export const storageObjects = pgTable(
  "storage_objects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    objectKey: text("object_key").notNull(),
    thumbKey: text("thumb_key"),
    derivativeOfId: uuid("derivative_of_id"),
    category: varchar("category", { length: 30 }).notNull(),
    originalFilename: varchar("original_filename", { length: 255 }),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    checksum: varchar("checksum", { length: 64 }),
    width: integer("width"),
    height: integer("height"),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("storage_objects_key_uq").on(t.objectKey),
    index("storage_objects_company_idx").on(t.companyId, t.status),
  ],
);
