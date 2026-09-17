import { messages, visibilityLabels } from "@/lib/messages";
import {
  VISIBILITY_TRANSITIONS,
  type Visibility,
} from "@/lib/visibility";

const ACTION_LABEL: Record<Visibility, string> = {
  draft: messages.toDraft,
  review: messages.toReview,
  scheduled: messages.toScheduled,
  published: messages.toPublished,
};

export function VisibilityControl({
  action,
  current,
}: {
  action: (formData: FormData) => void | Promise<void>;
  current: Visibility;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>{visibilityLabels[current]}</span>
      {VISIBILITY_TRANSITIONS[current].map((to) => (
        <form action={action} key={to} className="flex items-center gap-1">
          <input type="hidden" name="to" value={to} />
          {to === "scheduled" ? (
            <input
              type="datetime-local"
              name="publishAt"
              required
              className="field h-8 py-1"
            />
          ) : null}
          <button type="submit" className="ghost-btn-sm">
            {ACTION_LABEL[to]}
          </button>
        </form>
      ))}
    </div>
  );
}
