import Link from "next/link";
import { FileImage } from "@/components/portal/file-image";
import { BeforeAfterSlider } from "@/components/portal/before-after-slider";
import { formatSeoul } from "@/lib/datetime";
import { messages } from "@/lib/messages";
import { createPortalCommentAction } from "@/modules/comment";
import { VerifyHint } from "@/components/portal/verify-hint";
import { type HomeBlockView } from "@/modules/page-builder";

function blockStyle(style: Record<string, unknown> | null | undefined) {
  const s = style ?? {};
  const scale = String(s.typography ?? "md");
  return {
    backgroundColor: typeof s.background === "string" ? s.background : undefined,
    padding: typeof s.padding === "number" ? `${s.padding}px` : undefined,
    borderRadius: typeof s.radius === "number" ? `${s.radius}px` : undefined,
    maxWidth: typeof s.maxWidth === "number" ? `${s.maxWidth}px` : undefined,
    fontSize: scale === "lg" ? "1.25rem" : scale === "sm" ? "0.9rem" : undefined,
    letterSpacing: scale === "lg" ? "0.04em" : undefined,
    position: "relative" as const,
  };
}

function BlockFrame({
  block,
  children,
}: {
  block: HomeBlockView;
  children: React.ReactNode;
}) {
  const { x, y, w, h } = block.layout;
  const style = (block.style ?? {}) as Record<string, unknown>;
  const overlay = typeof style.overlay === "number" ? style.overlay : 0;
  return (
    <section
      className="relative min-h-12 overflow-hidden"
      style={{
        gridColumn: `${x + 1} / span ${w}`,
        gridRow: `${y + 1} / span ${h}`,
        ...blockStyle(style),
      }}
    >
      {overlay > 0 ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: `rgba(7, 6, 5, ${overlay})` }}
        />
      ) : null}
      <div className="relative">{children}</div>
    </section>
  );
}

export function HomeRenderer({
  blocks,
  projectId,
  allowComments,
  verified,
}: {
  blocks: HomeBlockView[];
  projectId: string;
  allowComments?: boolean;
  verified?: boolean;
}) {
  const ordered = [...blocks].sort(
    (a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x,
  );
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-10 md:grid md:grid-cols-12 md:gap-3 md:gap-y-6">
      {ordered.map((block) => (
        <BlockFrame key={block.id} block={block}>
          <BlockBody
            block={block}
            projectId={projectId}
            allowComments={allowComments}
            verified={verified}
          />
        </BlockFrame>
      ))}
    </div>
  );
}

function BlockBody({
  block,
  projectId,
  allowComments,
  verified,
}: {
  block: HomeBlockView;
  projectId: string;
  allowComments?: boolean;
  verified?: boolean;
}) {
  const content = block.content as Record<string, unknown>;
  switch (block.blockType) {
    case "text":
      return (
        <div
          className={content.align === "center" ? "text-center" : "text-left"}
          dangerouslySetInnerHTML={{ __html: String(content.html ?? "") }}
        />
      );
    case "gallery": {
      const cols = Number(content.columns ?? 2);
      return (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {(block.photos ?? []).map((photo) => (
            <FileImage key={photo.id} objectId={photo.storageObjectId} alt="" className="h-32 w-full bg-[var(--sand)] object-cover" />
          ))}
        </div>
      );
    }
    case "before_after": {
      const photos = block.photos ?? [];
      const before = photos.find((p) => p.pairRole === "before") ?? photos[0];
      const after = photos.find((p) => p.pairRole === "after") ?? photos[1];
      if (!before || !after) return null;
      return (
        <BeforeAfterSlider
          beforeId={before.storageObjectId}
          afterId={after.storageObjectId}
          caption={content.caption ? String(content.caption) : undefined}
        />
      );
    }
    case "design_file":
      return block.design ? (
        <p className="text-sm">
          {block.design.versionName}{" "}
          {block.design.storageObjectId ? (
            <a className="text-link" href={`/api/files/${block.design.storageObjectId}?v=full`}>
              {messages.openLink}
            </a>
          ) : null}
        </p>
      ) : null;
    case "material_card":
      return (
        <ul className="grid gap-2 sm:grid-cols-2">
          {(block.materials ?? []).map((item) => (
            <li key={item.id} className="paper-card text-sm">
              {item.imageObjectId ? (
                <FileImage objectId={item.imageObjectId} alt="" className="mb-2 h-24 w-full bg-[var(--sand)] object-cover" />
              ) : null}
              <p className="text-lg font-semibold">{item.name}</p>
              {item.spec ? <p className="text-muted-foreground">{item.spec}</p> : null}
            </li>
          ))}
        </ul>
      );
    case "schedule":
      return (
        <ul className="text-sm">
          {(block.schedules ?? []).map((row) => (
            <li key={row.id}>
              {row.title} · {formatSeoul(row.startAt)}
            </li>
          ))}
        </ul>
      );
    case "comment":
      return (
        <div className="flex flex-col gap-3 text-sm">
          {allowComments && content.allowNewComment !== false ? (
            <form action={createPortalCommentAction.bind(null, projectId)} className="flex flex-col gap-2">
              <textarea name="body" required className="field min-h-20" />
              {verified ? (
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="binding" />
                  {messages.bindingCheck}
                </label>
              ) : allowComments ? (
                <VerifyHint projectId={projectId} />
              ) : null}
              <button type="submit" className="ink-btn w-fit">
                {messages.submitComment}
              </button>
            </form>
          ) : null}
          <ul className="flex flex-col gap-2">
            {(block.comments ?? []).map((row) => (
              <li key={row.id}>
                <p>
                  {row.kind === "binding" ? (
                    <span className="gold-label mr-2">{messages.bindingBadge}</span>
                  ) : null}
                  {row.authorName} · {formatSeoul(row.createdAt)}
                </p>
                <p className={row.deleted ? "text-muted-foreground" : ""}>{row.body}</p>
              </li>
            ))}
          </ul>
        </div>
      );
    case "process":
      return (
        <div className="grid grid-cols-3 gap-2">
          {(block.photos ?? []).slice(0, 9).map((photo) => (
            <FileImage key={photo.id} objectId={photo.storageObjectId} alt="" className="h-24 w-full bg-[var(--sand)] object-cover" />
          ))}
        </div>
      );
    case "button": {
      const label = String(content.label ?? "");
      const action = String(content.action ?? "external");
      const href =
        action === "external"
          ? String(content.href ?? "")
          : action === "approve"
            ? `/portal/${projectId}/design`
            : `/portal/${projectId}/design`;
      if (block.disabled || !href) {
        return (
          <button type="button" disabled className="ghost-btn text-sm opacity-50">
            {label}
          </button>
        );
      }
      return action === "external" ? (
        <a href={href} className="ink-btn text-sm">
          {label}
        </a>
      ) : (
        <Link href={href} className="ink-btn text-sm">
          {label}
        </Link>
      );
    }
    case "divider": {
      const spacing = String(content.spacing ?? "md");
      const py = spacing === "lg" ? "py-8" : spacing === "sm" ? "py-2" : "py-4";
      return <hr className={py} />;
    }
    default:
      return null;
  }
}
