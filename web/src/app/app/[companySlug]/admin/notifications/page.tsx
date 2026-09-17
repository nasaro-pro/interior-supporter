import { requireCompanyStaff } from "@/lib/authz";
import {
  DEFAULT_EVENTS,
  listPreferences,
  saveNotificationPrefsAction,
} from "@/modules/notification";
import { labelOf, messages, notifyEventLabels } from "@/lib/messages";

export default async function Page({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  // 문서② 3-C — 구성원 본인의 수신 설정. 업체 공통 정책·수신자 지정은 1차 범위 밖이며
  // 수신자는 ③ 11.1 표로 고정된다.
  const ctx = await requireCompanyStaff(companySlug);
  const prefs = await listPreferences(ctx, ctx.userId);
  const byEvent = new Map(prefs.map((p) => [p.eventType, p]));
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl">{messages.notificationsTitle}</h1>
      <p className="text-sm text-muted-foreground">{messages.notificationsOwnOnly}</p>
      <form
        action={saveNotificationPrefsAction.bind(null, companySlug)}
        className="flex flex-col gap-2 text-sm"
      >
        {DEFAULT_EVENTS.map((eventType) => {
          const row = byEvent.get(eventType);
          return (
            <div key={eventType} className="flex items-center gap-4 border-b py-2">
              <span className="flex-1">{labelOf(notifyEventLabels, eventType)}</span>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  name={`inapp:${eventType}`}
                  defaultChecked={row?.inappEnabled ?? true}
                />
                {messages.inappLabel}
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  name={`email:${eventType}`}
                  defaultChecked={row?.emailEnabled ?? true}
                />
                {messages.emailNotifyLabel}
              </label>
            </div>
          );
        })}
        <button
          type="submit"
          className="ink-btn w-fit"
        >
          {messages.saveNotifications}
        </button>
      </form>
    </main>
  );
}
