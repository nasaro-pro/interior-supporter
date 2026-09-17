import type {
  NotificationChannelAdapter,
  OutboundMessage,
  SendResult,
} from "@/lib/notify/types";

export class SmsChannelAdapter implements NotificationChannelAdapter {
  readonly channel = "sms" as const;

  isAvailable(): boolean {
    return false;
  }

  async send(_message: OutboundMessage): Promise<SendResult> {
    return { ok: false, error: "sms unavailable" };
  }
}
