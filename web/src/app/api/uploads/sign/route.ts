import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { loadFieldUploadStaff, loadProjectStaff, staffContextFor } from "@/lib/authz";
import { errorToHttp, ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { hasRole } from "@/lib/tenancy/context";
import { signUpload } from "@/modules/storage-quota";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new UnauthorizedError();
    const body = (await req.json()) as {
      companySlug?: string;
      filename?: string;
      contentType?: string;
      contentLength?: number;
      category?: string;
      projectId?: string;
    };
    const ctx =
      body.category === "brand"
        ? await staffContextFor(session.userId, String(body.companySlug ?? ""))
        : body.category === "photo"
          ? await loadFieldUploadStaff(session.userId, String(body.projectId ?? ""))
          : await loadProjectStaff(session.userId, String(body.projectId ?? ""));
    if (body.category === "brand" && !hasRole(ctx, "company_admin")) {
      throw new ForbiddenError();
    }
    const result = await signUpload(ctx, {
      filename: String(body.filename ?? ""),
      contentType: body.contentType as
        | "image/jpeg"
        | "image/png"
        | "image/webp"
        | "application/pdf"
        | "application/x-dwg"
        | "application/x-sketchup",
      contentLength: Number(body.contentLength),
      category: body.category as "design" | "photo" | "material" | "brand" | "link",
      projectId: body.projectId,
    });
    return Response.json(result);
  } catch (error) {
    const { status, message } = errorToHttp(error);
    return Response.json({ message }, { status });
  }
}
