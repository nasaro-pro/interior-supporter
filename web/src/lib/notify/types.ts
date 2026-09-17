export type NotificationChannel = "inapp" | "email" | "kakao_alimtalk" | "sms";

export type OutboundMessage = {
  to: string;
  subject?: string;
  body: string;
  templateKey?: string;
  variables?: Record<string, string>;
};

export type SendResult = {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
};

export interface NotificationChannelAdapter {
  readonly channel: NotificationChannel;
  isAvailable(): boolean;
  send(message: OutboundMessage): Promise<SendResult>;
}
