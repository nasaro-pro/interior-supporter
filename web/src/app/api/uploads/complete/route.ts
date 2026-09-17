import { getSession } from "@/lib/auth";
import { loadFieldUploadStaff, loadProjectStaff, staffContextFor } from "@/lib/authz";
import { errorToHttp, UnauthorizedError } from "@/lib/errors";
import { completeUpload, findStorageObjectById } from "@/modules/storage-quota";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) throw new UnauthorizedError();
    const body = (await req.json()) as {
      objectId?: string;
      companySlug?: string;
    };
    const objectId = String(body.objectId ?? "");
    const staffCtx = body.companySlug
      ? await staffContextFor(session.userId, body.companySlug)
      : null;
    const pending = staffCtx
      ? await findStorageObjectById(staffCtx, objectId)
      : null;
    const ctx = pending?.projectId
      ? await loadFieldUploadStaff(session.userId, pending.projectId).catch(() =>
          loadProjectStaff(session.userId, pending.projectId!),
        )
      : staffCtx;
    if (!ctx) throw new UnauthorizedError();
    const result = await completeUpload(ctx, objectId);
    return Response.json({ objectId: result?.id });
  } catch (error) {
    const { status, message } = errorToHttp(error);
    return Response.json({ message }, { status });
  }
}
