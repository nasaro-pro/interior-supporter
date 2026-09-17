import { integer, pgTable, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";

/** P1 프롬프트의 Postgres 카운터. 5장 엔터티는 아님. */
export const rateLimitCounters = pgTable(
  "rate_limit_counters",
  {
    key: varchar("key", { length: 200 }).notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);
