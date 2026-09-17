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
import { visibilityEnum } from "../../lib/db/enums";

export const meetingRecords = pgTable(
  "meeting_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    meetingAt: timestamp("meeting_at", { withTimezone: true }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    minutes: text("minutes"),
    decisions: text("decisions"),
    attachmentId: uuid("attachment_id"),
    scheduleId: uuid("schedule_id"),
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
  (t) => [index("meetings_project_at_idx").on(t.projectId, t.meetingAt)],
);

export const meetingParticipants = pgTable(
  "meeting_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetingRecords.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id),
    externalName: varchar("external_name", { length: 100 }),
    role: varchar("role", { length: 50 }),
    attendanceStatus: varchar("attendance_status", { length: 20 }),
  },
  (t) => [index("meeting_participants_meeting_idx").on(t.meetingId)],
);

export const meetingAcks = pgTable(
  "meeting_acks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetingRecords.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("meeting_acks_meeting_idx").on(t.meetingId)],
);
