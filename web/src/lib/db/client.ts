import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/config/env";
import * as schema from "@/lib/db/schema";

const env = getEnv();
const queryClient = postgres(env.DATABASE_URL, { max: 10 });

export const db = drizzle(queryClient, { schema });
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
