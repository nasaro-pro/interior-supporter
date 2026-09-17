import { Resend } from "resend";
import { env } from "@/lib/config/env";
import { logger } from "@/lib/logger";
import type {
  NotificationChannelAdapter,
  OutboundMessage,
  SendResult,
} from "@/lib/notify/types";

/** provider=resend 일 때만 클라이언트를 만든다. console 모드에서는 키가 없어도 된다. */
const resend =
  env.NOTIFY_EMAIL_PROVIDER === "resend" && env.RESEND_API_KEY
    ? new Resend(env.RESEND_API_KEY)
    : null;

export async function sendMail(input: {
  to: string;
  template: string;
  data: { url?: string; subject?: string; body?: string };
}): Promise<void> {
  const subject = input.data.subject ?? input.template;
  const body = input.data.body ?? input.data.url ?? "";

  // 개발·CI 기본값. 실제 주소로 메일이 새어 나가지 않게 한다.
  if (!resend) {
    logger.info("mail.console", { template: input.template, subject });
    // 링크 확인용. 운영에서는 이 경로로 오지 않는다.
    if (env.NODE_ENV !== "production") {
      console.info(`[mail:${input.template}] to=${input.to} ${body}`);
    }
    return;
  }

  await resend.emails.send({
    from: env.NOTIFY_FROM_EMAIL,
    to: input.to,
    subject,
    text: body,
  });
}

export class EmailChannelAdapter implements NotificationChannelAdapter {
  readonly channel = "email" as const;

  isAvailable(): boolean {
    return true;
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    try {
      await sendMail({
        to: message.to,
        template: message.templateKey ?? "generic",
        data: {
          url: message.variables?.url,
          subject: message.subject,
          body: message.body,
        },
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "email failed",
      };
    }
  }
}
