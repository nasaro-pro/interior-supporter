import { z } from "zod";

const nodeEnvSchema = z.enum(["development", "test", "production"]);

function parseDatabaseUrl(url: string): URL {
  return new URL(url.replace(/^postgres(ql)?:/i, "http:"));
}

/**
 * ARCHITECTURE.md 18.1 — 비운영 환경이 운영 DB 를 가리키면 부팅을 막는다.
 * 판정은 차단 목록(PRODUCTION_DB_HOST)으로 한다. "localhost 가 아니면 전부 거부"로
 * 만들면 18.1 표가 허용한 'local = Neon 개발 브랜치' 구성과 충돌한다.
 */
function assertNotProductionDatabase(
  databaseUrl: string,
  nodeEnv: string,
  productionHost: string | undefined,
) {
  if (nodeEnv === "production") return;
  if (!productionHost) return;
  const host = parseDatabaseUrl(databaseUrl).hostname.toLowerCase();
  if (host === productionHost.trim().toLowerCase()) {
    throw new Error(
      `NODE_ENV=${nodeEnv} 인데 DATABASE_URL 이 운영 호스트를 가리킵니다: ${host}`,
    );
  }
}

const envSchema = z
  .object({
    NODE_ENV: nodeEnvSchema.default("development"),
    NEXT_PUBLIC_APP_URL: z.url(),
    SESSION_COOKIE_NAME: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    /** 비운영 환경이 이 호스트를 가리키면 부팅을 거부한다 (18.1). 선택. */
    PRODUCTION_DB_HOST: z.string().optional(),
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.url(),
    STORAGE_PROVIDER: z.literal("r2"),
    STORAGE_ENDPOINT: z.string().min(1),
    STORAGE_REGION: z.string().min(1),
    STORAGE_ACCESS_KEY_ID: z.string().min(1),
    STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
    STORAGE_BUCKET: z.string().min(1),
    /** console = 실제 발송 없이 stdout 에만 남긴다 (로컬 개발 기본값) */
    NOTIFY_EMAIL_PROVIDER: z.enum(["resend", "console"]).default("console"),
    RESEND_API_KEY: z.string().optional(),
    NOTIFY_FROM_EMAIL: z.email(),
    NOTIFY_ALIMTALK_PROVIDER: z.string().optional(),
    ALIMTALK_API_KEY: z.string().optional(),
    PAYMENT_PROVIDER: z.literal("none"),
    SENTRY_DSN: z.string().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
    SENTRY_ENVIRONMENT: z.string().optional(),
    CRON_SECRET: z.string().min(1),
  })
  .superRefine((value, ctx) => {
    try {
      assertNotProductionDatabase(
        value.DATABASE_URL,
        value.NODE_ENV,
        value.PRODUCTION_DB_HOST,
      );
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: error instanceof Error ? error.message : "DATABASE_URL 가드 실패",
      });
    }
    if (value.NOTIFY_EMAIL_PROVIDER === "resend" && !value.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "NOTIFY_EMAIL_PROVIDER=resend 이면 RESEND_API_KEY 가 필요합니다.",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function getEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`환경변수 검증 실패: ${details}`);
  }
  return parsed.data;
}

export const env = getEnv();
