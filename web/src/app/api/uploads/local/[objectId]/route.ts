import { getSession } from "@/lib/auth";
import { staffContextFor } from "@/lib/authz";
import { errorToHttp, UnauthorizedError } from "@/lib/errors";
import { putLocalObject, findStorageObjectById } from "@/modules/storage-quota";
import { isLocalStorage } from "@/lib/storage";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ objectId: string }> },
) {
  try {
    if (!isLocalStorage()) {
      return Response.json({ message: "not found" }, { status: 404 });
    }
    const session = await getSession();
    if (!session) throw new UnauthorizedError();
    const { objectId } = await params;
    const contentType = req.headers.get("content-type") ?? "";
    const body = new Uint8Array(await req.arrayBuffer());
    const slug = req.headers.get("x-company-slug") ?? "";
    const ctx = await staffContextFor(session.userId, slug);
    const row = await findStorageObjectById(ctx, objectId);
    if (!row) throw new UnauthorizedError();
    await putLocalObject(ctx, objectId, body, contentType);
    return new Response(null, { status: 204 });
  } catch (error) {
    const { status, message } = errorToHttp(error);
    return Response.json({ message }, { status });
  }
}
