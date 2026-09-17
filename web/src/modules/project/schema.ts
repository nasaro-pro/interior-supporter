import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { companies } from "@/modules/company/schema";
import { customers } from "@/modules/customer/schema";
import { users } from "@/modules/membership/auth-tables";
import { processCategoryEnum, projectStatusEnum } from "../../lib/db/enums";

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    managerId: uuid("manager_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 200 }).notNull(),
    address: text("address"),
    contractDate: date("contract_date"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    currentProcess: processCategoryEnum("current_process"),
    status: projectStatusEnum("status").notNull().default("active"),
    /** 확정 코드: 해시만 저장. 평문은 발급 화면에서 1회만 노출 (7.6절) */
    verificationCodeHash: text("verification_code_hash"),
    codeVersion: integer("code_version").notNull().default(0),
    codeIssuedBy: uuid("code_issued_by").references(() => users.id),
    codeIssuedAt: timestamp("code_issued_at", { withTimezone: true }),
    settings: jsonb("settings").notNull().default({}),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("projects_company_status_idx").on(t.companyId, t.status),
    index("projects_manager_idx").on(t.companyId, t.managerId),
    index("projects_customer_idx").on(t.customerId),
  ],
);
