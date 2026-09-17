import { getSession } from "@/lib/auth";
import { errorToHttp, UnauthorizedError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/ratelimit";
import { streamFile } from "@/modules/storage-quota";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ objectId: string }> },
) {
  try {
    const session = await getSession();
    if (!session) throw new UnauthorizedError();
    await enforceRateLimit("file_proxy", session.userId);
    const { objectId } = await params;
    const variant =
      new URL(req.url).searchParams.get("v") === "full" ? "full" : "thumb";
    const { stream, mime } = await streamFile(session.userId, objectId, variant);
    return new Response(stream, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=3600, immutable",
      },
    });
  } catch (error) {
    const { status, message } = errorToHttp(error);
    return Response.json({ message }, { status });
  }
}
