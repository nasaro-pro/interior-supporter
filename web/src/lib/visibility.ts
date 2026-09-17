import { ForbiddenError } from "@/lib/errors";
import { messages } from "@/lib/messages";

export type Visibility = "draft" | "review" | "scheduled" | "published";

export const VISIBILITY_TRANSITIONS: Record<Visibility, Visibility[]> = {
  draft: ["review"],
  review: ["draft", "scheduled", "published"],
  scheduled: ["published", "review"],
  published: ["review"],
};

export function assertVisibilityTransition(from: Visibility, to: Visibility) {
  if (!VISIBILITY_TRANSITIONS[from].includes(to)) {
    throw new ForbiddenError(messages.visibilityDenied);
  }
}
