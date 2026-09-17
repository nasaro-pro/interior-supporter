import { getAccount } from "@/lib/auth";
import {
  changePortalPasswordAction,
  savePortalProfileAction,
} from "@/modules/membership";
import {
  DEFAULT_EVENTS,
  listPreferences,
  savePortalPrefsAction,
} from "@/modules/notification";
import { messages } from "@/lib/messages";

export default async function Page() {
  const user = await getAccount();
  const prefs = await listPreferences(
    { kind: "system", job: "notification-prefs" },
    user.id,
  );
  const byEvent = new Map(prefs.map((p) => [p.eventType, p]));
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-5 py-10">
      <div>
        <p className="gold-label">{messages.portalMe}</p>
        <h1 className="mt-2 text-3xl">{messages.portalMe}</h1>
      </div>
      <form action={savePortalProfileAction} className="flex flex-col gap-2">
        <input
          name="name"
          defaultValue={user.name}
          required
          className="field"
          placeholder={messages.nameLabel}
        />
        <input
          value={user.email}
          readOnly
          className="field bg-muted"
        />
        <input
          name="phone"
          defaultValue={user.phone ?? ""}
          className="field"
          placeholder={messages.phoneLabel}
        />
        <button type="submit" className="ink-btn">
          {messages.saveProfile}
        </button>
      </form>
      <form action={changePortalPasswordAction} className="flex flex-col gap-2">
        <input
          type="password"
          name="currentPassword"
          required
          placeholder={messages.currentPassword}
          className="field"
        />
        <input
          type="password"
          name="newPassword"
          required
          minLength={10}
          placeholder={messages.newPassword}
          className="field"
        />
        <button type="submit" className="ghost-btn">
          {messages.submitReset}
        </button>
      </form>
      <form action={savePortalPrefsAction} className="flex flex-col gap-2 text-sm">
        <h2 className="text-2xl">{messages.notificationsTitle}</h2>
        {DEFAULT_EVENTS.map((eventType) => {
          const row = byEvent.get(eventType);
          return (
            <div key={eventType} className="flex items-center gap-3 border-b py-2">
              <span className="flex-1 break-all">{eventType}</span>
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
                  defaultChecked={row?.emailEnabled ?? eventType !== "photo.published"}
                />
                {messages.emailNotifyLabel}
              </label>
            </div>
          );
        })}
        <button type="submit" className="ink-btn">
          {messages.saveNotifications}
        </button>
      </form>
    </main>
  );
}
