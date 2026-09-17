import type {
  NotificationChannelAdapter,
  OutboundMessage,
  SendResult,
} from "@/lib/notify/types";

export class InAppChannelAdapter implements NotificationChannelAdapter {
  readonly channel = "inapp" as const;

  isAvailable(): boolean {
    return true;
  }

  async send(_message: OutboundMessage): Promise<SendResult> {
    return { ok: true };
  }
}
