import { getSession } from "@/lib/auth";
import { loadProjectStaff } from "@/lib/authz";
import { errorToHttp, UnauthorizedError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/ratelimit";
import { fetchLinkPreview } from "@/modules/material";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) throw new UnauthorizedError();
    await enforceRateLimit("link_preview", session.userId);
    const body = (await req.json()) as { url?: string; projectId?: string };
    const ctx = await loadProjectStaff(session.userId, String(body.projectId ?? ""));
    const preview = await fetchLinkPreview(ctx, ctx.kind === "staff" ? String(body.projectId) : "", String(body.url ?? ""));
    return Response.json(preview);
  } catch (error) {
    const { status, message } = errorToHttp(error);
    return Response.json({ message }, { status });
  }
}
