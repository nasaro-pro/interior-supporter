import type {
  NotificationChannelAdapter,
  OutboundMessage,
  SendResult,
} from "@/lib/notify/types";

export class KakaoAlimtalkChannelAdapter implements NotificationChannelAdapter {
  readonly channel = "kakao_alimtalk" as const;

  isAvailable(): boolean {
    return false;
  }

  async send(_message: OutboundMessage): Promise<SendResult> {
    return { ok: false, error: "kakao_alimtalk unavailable" };
  }
}
