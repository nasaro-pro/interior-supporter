import { requireProjectInCompany } from "@/lib/authz";
import {
  changeScheduleVisibilityAction,
  createScheduleAction,
  listSchedules,
} from "@/modules/schedule";
import { VisibilityControl } from "@/components/shared/visibility-control";
import { formatSeoul, seoulMonthRange, seoulMonthValue } from "@/lib/datetime";
import { messages, processLabels, visibilityLabels } from "@/lib/messages";
import { ProcessTimeline } from "@/components/schedule/process-timeline";
import { SundayMonthCalendar } from "@/components/schedule/sunday-month-calendar";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ companySlug: string; projectId: string }>;
  searchParams: Promise<{ view?: string; month?: string }>;
}) {
  const { companySlug, projectId } = await params;
  const { view, month } = await searchParams;
  const ctx = await requireProjectInCompany(companySlug, projectId);
  // 월 경계는 서버 로컬(UTC)이 아니라 Asia/Seoul 기준이어야 한다 (5.1)
  const monthValue = /^\d{4}-\d{2}$/.test(month ?? "")
    ? month!
    : seoulMonthValue();
  const { from, to } = seoulMonthRange(monthValue);
  const rows = await listSchedules(
    ctx,
    projectId,
    view === "month" ? { from, to } : undefined,
  );
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <h2 className="text-2xl">{messages.scheduleTitle}</h2>
      <nav className="flex gap-3 text-sm">
        <a className={view === "month" ? "nav-btn nav-btn-active" : "nav-btn"} href={`/app/${companySlug}/projects/${projectId}/schedule?view=month`}>
          {messages.viewMonth}
        </a>
        <a className={view !== "month" ? "nav-btn nav-btn-active" : "nav-btn"} href={`/app/${companySlug}/projects/${projectId}/schedule?view=list`}>
          {messages.viewList}
        </a>
      </nav>
      <form
        action={createScheduleAction.bind(null, companySlug, projectId)}
        className="grid gap-2 md:grid-cols-2"
      >
        <input name="title" required placeholder={messages.projectTitleLabel} className="h-9 rounded-md border border-input px-3" />
        <select name="type" className="h-9 rounded-md border border-input px-3">
          <option value="process">{messages.scheduleProcess}</option>
          <option value="visit">{messages.scheduleVisit}</option>
          <option value="confirmed">{messages.scheduleConfirmed}</option>
          <option value="meeting">{messages.scheduleMeeting}</option>
        </select>
        <input type="datetime-local" name="startAt" required className="h-9 rounded-md border border-input px-3" />
        <input type="datetime-local" name="endAt" className="h-9 rounded-md border border-input px-3" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isAllDay" />
          {messages.allDayLabel}
        </label>
        <select name="processCategory" className="h-9 rounded-md border border-input px-3">
          <option value="">{messages.scheduleProcess}</option>
          {Object.entries(processLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <textarea name="note" className="rounded-md border border-input px-3 py-2 md:col-span-2" />
        <button type="submit" className="ink-btn">
          {messages.createSchedule}
        </button>
      </form>
      {view === "month" ? (
        <SundayMonthCalendar
          monthValue={monthValue}
          items={rows.map((row) => ({
            id: row.id,
            title: row.title,
            startAt: row.startAt,
            type: row.type,
          }))}
        />
      ) : (
        <ProcessTimeline
          items={rows.map((row) => ({
            id: row.id,
            title: row.title,
            startAt: row.startAt,
            endAt: row.endAt,
            processCategory: row.processCategory,
            type: row.type,
          }))}
        />
      )}
      <ul className="flex flex-col gap-3 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="border-t pt-2">
            <p>
              {row.title} · {formatSeoul(row.startAt)} · {visibilityLabels[row.visibilityStatus]}
            </p>
            <VisibilityControl
              current={row.visibilityStatus}
              action={changeScheduleVisibilityAction.bind(
                null,
                companySlug,
                projectId,
                row.id,
              )}
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
