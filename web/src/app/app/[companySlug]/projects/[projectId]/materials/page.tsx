import { requireProjectInCompany } from "@/lib/authz";
import {
  changeMaterialVisibilityAction,
  changePurchaseAction,
  createMaterialAction,
  listMaterialHistoryByProject,
  listMaterials,
} from "@/modules/material";
import { LoadMore } from "@/components/shared/load-more";
import { Uploader } from "@/components/shared/uploader";
import { VisibilityControl } from "@/components/shared/visibility-control";
import { FileImage } from "@/components/portal/file-image";
import { LinkPreviewField } from "@/components/shared/link-preview-field";
import {
  messages,
  purchaseLabels,
  spaceLabels,
  visibilityLabels,
} from "@/lib/messages";

const SPACES = Object.keys(spaceLabels) as (keyof typeof spaceLabels)[];
const PURCHASE = Object.keys(purchaseLabels) as (keyof typeof purchaseLabels)[];

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ companySlug: string; projectId: string }>;
  searchParams: Promise<{ space?: string; cursor?: string }>;
}) {
  const { companySlug, projectId } = await params;
  const { space: spaceRaw, cursor } = await searchParams;
  const ctx = await requireProjectInCompany(companySlug, projectId);
  const space = SPACES.includes(spaceRaw as keyof typeof spaceLabels)
    ? (spaceRaw as keyof typeof spaceLabels)
    : "living_room";
  const { items: rows, nextCursor } = await listMaterials(ctx, projectId, space, {
    cursor,
  });
  const histories = await listMaterialHistoryByProject(ctx, projectId, {
    materialIds: rows.map((row) => row.id),
  });
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <h2 className="text-2xl">{messages.materialsTitle}</h2>
      <nav className="flex flex-wrap gap-2 text-sm">
        {SPACES.map((key) => (
          <a
            key={key}
            className={key === space ? "nav-btn nav-btn-active" : "nav-btn"}
            href={`/app/${companySlug}/projects/${projectId}/materials?space=${key}`}
          >
            {spaceLabels[key]}
          </a>
        ))}
      </nav>
      <form
        action={createMaterialAction.bind(null, companySlug, projectId, space)}
        className="grid gap-2 md:grid-cols-2"
      >
        <input name="name" required placeholder={messages.materialNameLabel} className="h-9 rounded-md border border-input px-3" />
        <input name="brand" placeholder={messages.brandLabel} className="h-9 rounded-md border border-input px-3" />
        <input name="spec" placeholder={messages.specLabel} className="h-9 rounded-md border border-input px-3" />
        <input name="color" placeholder={messages.colorLabel} className="h-9 rounded-md border border-input px-3" />
        <input name="applyLocation" placeholder={messages.applyLocationLabel} className="h-9 rounded-md border border-input px-3" />
        <textarea name="description" placeholder={messages.descriptionLabel} className="rounded-md border border-input px-3 py-2 md:col-span-2" />
        <div className="md:col-span-2">
          <Uploader companySlug={companySlug} projectId={projectId} category="material" name="imageObjectId" accept="image/jpeg,image/png,image/webp" />
        </div>
        <div className="md:col-span-2">
          <LinkPreviewField projectId={projectId} />
        </div>
        <button type="submit" className="ink-btn">
          {messages.createMaterial}
        </button>
      </form>
      <ul className="flex flex-col gap-6">
        {rows.map((row) => {
          const idx = PURCHASE.indexOf(row.purchaseStatus);
          const next = PURCHASE[idx + 1];
          const prev = PURCHASE[idx - 1];
          const history = histories.filter((h) => h.materialId === row.id);
          return (
            <li key={row.id} className="border-t pt-3 text-sm">
              <p className="font-medium">{row.name}</p>
              <p>
                {row.brand} {row.spec} · {visibilityLabels[row.visibilityStatus]}
              </p>
              {row.externalUrl ? (
                <a className="text-link" href={row.externalUrl}>
                  {row.linkTitle ?? row.linkSiteName ?? row.externalUrl}
                </a>
              ) : null}
              {row.imageObjectId || row.linkImageObjectId ? (
                <FileImage
                  objectId={(row.imageObjectId ?? row.linkImageObjectId)!}
                  alt=""
                  className="mt-2 h-32 w-32 object-cover"
                />
              ) : null}
              <VisibilityControl
                current={row.visibilityStatus}
                action={changeMaterialVisibilityAction.bind(
                  null,
                  companySlug,
                  projectId,
                  row.id,
                )}
              />
              <p>{purchaseLabels[row.purchaseStatus]}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {next ? (
                  <form action={changePurchaseAction.bind(null, companySlug, projectId, row.id, next)}>
                    <button type="submit" className="ghost-btn-sm">
                      {purchaseLabels[next]}
                    </button>
                  </form>
                ) : null}
                {prev ? (
                  <form
                    action={changePurchaseAction.bind(null, companySlug, projectId, row.id, prev)}
                    className="flex gap-1"
                  >
                    <input
                      name="note"
                      required
                      placeholder={messages.revertNoteLabel}
                      className="h-8 rounded-md border border-input px-2"
                    />
                    <button type="submit" className="ghost-btn-sm">
                      {purchaseLabels[prev]}
                    </button>
                  </form>
                ) : null}
              </div>
              <ul className="mt-2 text-xs text-muted-foreground">
                {history.map((h) => (
                  <li key={h.history.id}>
                    {h.history.fromStatus ?? "-"} → {h.history.toStatus}
                    {h.history.note ? ` · ${h.history.note}` : ""}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      {nextCursor ? (
        <LoadMore
          href={`/app/${companySlug}/projects/${projectId}/materials?space=${space}&cursor=${encodeURIComponent(nextCursor)}`}
        />
      ) : null}
    </main>
  );
}
