"use client";

import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { FileImage } from "@/components/portal/file-image";
import { TextHtmlEditor } from "@/components/page-builder/text-html-editor";
import {
  applyTemplateAction,
  requestPromotionAction,
  saveHomeBlocksAction,
  saveProjectTemplateAction,
} from "@/modules/page-builder/actions";
import { presetBlocks } from "@/modules/page-builder/presets";
import { emptyContent, type BlockType } from "@/modules/page-builder/blocks/schemas";
import {
  buttonActionLabels,
  messages,
  processLabels,
  scheduleTypeLabels,
  spacingLabels,
  visibilityLabels,
} from "@/lib/messages";
import type { Visibility } from "@/lib/visibility";

type Layout = { x: number; y: number; w: number; h: number };

export type EditorBlock = {
  id: string;
  blockType: BlockType;
  layout: Layout;
  style: Record<string, unknown>;
  content: unknown;
  /** datetime-local 형식(KST). 서버가 parseSeoulInput 으로 해석한다. */
  visibilityStatus: Visibility;
  publishAt: string | null;
  deleted?: boolean;
  isNew?: boolean;
};

export type EditorPhoto = {
  id: string;
  storageObjectId: string;
  processCategory: string;
  published: boolean;
};

const ROW_HEIGHT = 48;
const COLUMNS = 12;

const PALETTE: Array<{ type: BlockType; label: string; size: Layout }> = [
  { type: "text", label: messages.blockText, size: { x: 0, y: 0, w: 12, h: 3 } },
  { type: "gallery", label: messages.blockGallery, size: { x: 0, y: 0, w: 12, h: 4 } },
  { type: "before_after", label: messages.blockBeforeAfter, size: { x: 0, y: 0, w: 12, h: 4 } },
  { type: "design_file", label: messages.blockDesign, size: { x: 0, y: 0, w: 6, h: 4 } },
  { type: "material_card", label: messages.blockMaterial, size: { x: 0, y: 0, w: 6, h: 4 } },
  { type: "schedule", label: messages.blockSchedule, size: { x: 0, y: 0, w: 12, h: 5 } },
  { type: "comment", label: messages.blockComment, size: { x: 0, y: 0, w: 12, h: 6 } },
  { type: "process", label: messages.blockProcess, size: { x: 0, y: 0, w: 12, h: 5 } },
  { type: "button", label: messages.blockButton, size: { x: 0, y: 0, w: 4, h: 2 } },
  { type: "divider", label: messages.blockDivider, size: { x: 0, y: 0, w: 12, h: 1 } },
];

function nextY(blocks: EditorBlock[]) {
  return blocks.reduce(
    (acc, b) => (b.deleted ? acc : Math.max(acc, b.layout.y + b.layout.h)),
    0,
  );
}

export function HomeEditor({
  companySlug,
  projectId,
  pageUpdatedAt,
  initialBlocks,
  templates,
  designs,
  materials,
  photos,
  pairGroups,
}: {
  companySlug: string;
  projectId: string;
  pageUpdatedAt: string;
  initialBlocks: EditorBlock[];
  templates: Array<{ id: string; name: string; scope: string; promotionStatus: string }>;
  designs: Array<{ id: string; versionName: string }>;
  materials: Array<{ id: string; name: string }>;
  photos: EditorPhoto[];
  pairGroups: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState(initialBlocks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(pageUpdatedAt);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const selected = blocks.find((b) => b.id === selectedId && !b.deleted) ?? null;
  const visible = useMemo(() => blocks.filter((b) => !b.deleted), [blocks]);
  const [history, setHistory] = useState<EditorBlock[][]>([initialBlocks]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [preview, setPreview] = useState<"desktop" | "tablet" | "mobile">("desktop");

  function commit(next: EditorBlock[]) {
    setBlocks(next);
    setHistory((rows) => [...rows.slice(0, historyIndex + 1), next].slice(-40));
    setHistoryIndex((index) => Math.min(index + 1, 39));
  }

  function undo() {
    if (historyIndex === 0) return;
    const next = historyIndex - 1;
    setHistoryIndex(next);
    setBlocks(history[next] ?? blocks);
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    const next = historyIndex + 1;
    setHistoryIndex(next);
    setBlocks(history[next] ?? blocks);
  }

  function patch(id: string, next: Partial<EditorBlock>) {
    commit(blocks.map((row) => (row.id === id ? { ...row, ...next } : row)));
  }

  function add(type: BlockType) {
    const spec = PALETTE.find((p) => p.type === type)!;
    const id = crypto.randomUUID();
    commit([
      ...blocks,
      {
        id,
        blockType: type,
        layout: { ...spec.size, y: nextY(blocks) },
        style: {},
        content: emptyContent(type),
        visibilityStatus: "draft",
        publishAt: null,
        isNew: true,
      },
    ]);
    setSelectedId(id);
  }

  function snapLayout(layout: Layout, others: EditorBlock[]) {
    let { x, y, w, h } = layout;
    x = Math.min(COLUMNS - 1, Math.max(0, x));
    y = Math.max(0, y);
    w = Math.min(COLUMNS - x, Math.max(1, w));
    for (const other of others) {
      if (other.deleted) continue;
      const ox = other.layout.x;
      const oy = other.layout.y;
      const ow = other.layout.w;
      const oh = other.layout.h;
      if (Math.abs(x - ox) <= 1) x = ox;
      if (Math.abs(x + w - (ox + ow)) <= 1) x = Math.max(0, ox + ow - w);
      if (Math.abs(x - (ox + ow)) <= 1) x = ox + ow;
      if (Math.abs(y - (oy + oh)) <= 1) y = oy + oh;
      if (Math.abs(y + h - oy) <= 1) y = Math.max(0, oy - h);
    }
    return { x, y, w, h: Math.max(1, h) };
  }

  /** 열 폭은 캔버스 실제 너비에서 계산한다. 픽셀 상수를 박으면 화면 폭이 바뀔 때 어긋난다. */
  function columnWidth() {
    return (canvasRef.current?.clientWidth ?? COLUMNS * 80) / COLUMNS;
  }

  function onDragEnd(event: DragEndEvent) {
    const rawId = String(event.active.id);
    const mode = String(event.active.data.current?.mode ?? "move");
    const id = rawId.replace(/:resize$/, "");
    const dx = Math.round(event.delta.x / columnWidth());
    const dy = Math.round(event.delta.y / ROW_HEIGHT);
    commit(
      blocks.map((row) => {
        if (row.id !== id) return row;
        if (mode === "resize") {
          const w = Math.max(1, Math.min(COLUMNS - row.layout.x, row.layout.w + dx));
          const h = Math.max(1, Math.min(24, row.layout.h + dy));
          return { ...row, layout: snapLayout({ ...row.layout, w, h }, blocks) };
        }
        const x = Math.min(COLUMNS - 1, Math.max(0, row.layout.x + dx));
        const y = Math.max(0, row.layout.y + dy);
        const w = Math.min(COLUMNS - x, row.layout.w);
        return {
          ...row,
          layout: snapLayout({ ...row.layout, x, y, w }, blocks.filter((item) => item.id !== id)),
        };
      }),
    );
  }

  async function save() {
    setError(null);
    const result = await saveHomeBlocksAction(companySlug, projectId, {
      pageUpdatedAt: updatedAt,
      blocks: blocks.map((b) => ({
        id: b.id,
        blockType: b.blockType,
        layout: b.layout,
        style: b.style,
        content: b.content,
        visibilityStatus: b.visibilityStatus,
        publishAt: b.publishAt,
        deleted: b.deleted,
        isNew: b.isNew,
      })),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setUpdatedAt(result.pageUpdatedAt);
    setBlocks((rows) => rows.filter((r) => !r.deleted).map((r) => ({ ...r, isNew: false })));
    router.refresh();
  }

  return (
    <div className="flex min-h-[70vh] flex-col gap-4 p-4 lg:flex-row">
      <aside className="flex gap-2 overflow-x-auto text-sm lg:w-44 lg:flex-col lg:overflow-visible">
        <p className="hidden font-medium lg:block">{messages.addBlock}</p>
        {PALETTE.map((item) => (
          <button
            key={item.type}
            type="button"
            className="shrink-0 rounded border px-2 py-1 text-left"
            onClick={() => add(item.type)}
          >
            {item.label}
          </button>
        ))}
        <p className="hidden font-medium lg:block">{messages.editorPreset}</p>
        <button type="button" className="ghost-btn-sm" onClick={() => commit(presetBlocks("atelier"))}>
          {messages.presetAtelier}
        </button>
        <button type="button" className="ghost-btn-sm" onClick={() => commit(presetBlocks("gallery"))}>
          {messages.presetGallery}
        </button>
        <button type="button" className="ghost-btn-sm" onClick={() => commit(presetBlocks("journal"))}>
          {messages.presetJournal}
        </button>
      </aside>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div
          className="relative min-h-[640px] flex-1 rounded border bg-[var(--sheet)] p-2"
          style={{
            maxWidth:
              preview === "mobile" ? 390 : preview === "tablet" ? 768 : undefined,
            marginInline: preview === "desktop" ? undefined : "auto",
          }}
        >
          <div
            ref={canvasRef}
            className="relative min-h-[640px]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(176,138,74,0.12) 1px, transparent 1px)",
              backgroundSize: `${100 / COLUMNS}% 100%`,
            }}
          >
          {visible.map((block) => (
            <DraggableBlock
              key={block.id}
              block={block}
              selected={selectedId === block.id}
              onSelect={() => setSelectedId(block.id)}
            />
          ))}
          </div>
        </div>
      </DndContext>

      <aside className="flex w-full flex-col gap-3 text-sm lg:w-80">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="ghost-btn-sm" onClick={undo}>
            {messages.editorUndo}
          </button>
          <button type="button" className="ghost-btn-sm" onClick={redo}>
            {messages.editorRedo}
          </button>
          <button
            type="button"
            className="ink-btn"
            onClick={() => void save()}
          >
            {messages.saveBlocks}
          </button>
          <a
            className="ghost-btn"
            href={`/app/${companySlug}/projects/${projectId}/home-editor?preview=1`}
          >
            {messages.previewCustomer}
          </a>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["desktop", "tablet", "mobile"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={preview === mode ? "nav-btn nav-btn-active" : "nav-btn"}
              onClick={() => setPreview(mode)}
            >
              {mode === "desktop"
                ? messages.previewDesktop
                : mode === "tablet"
                  ? messages.previewTablet
                  : messages.previewMobile}
            </button>
          ))}
        </div>
        {error ? <p className="text-destructive">{error}</p> : null}

        {selected ? (
          <div className="flex flex-col gap-3 rounded border p-3">
            <p className="font-medium">
              {PALETTE.find((p) => p.type === selected.blockType)?.label}
            </p>

            <div className="grid grid-cols-4 gap-2">
              {(["x", "y", "w", "h"] as const).map((key) => (
                <label key={key} className="flex flex-col text-xs">
                  {key}
                  <input
                    type="number"
                    className="h-8 rounded border px-1"
                    value={selected.layout[key]}
                    onChange={(e) =>
                      patch(selected.id, {
                        layout: { ...selected.layout, [key]: Number(e.target.value) },
                      })
                    }
                  />
                </label>
              ))}
            </div>

            <label className="flex flex-col gap-1">
              {visibilityLabels[selected.visibilityStatus]}
              <select
                value={selected.visibilityStatus}
                onChange={(e) =>
                  patch(selected.id, {
                    visibilityStatus: e.target.value as Visibility,
                  })
                }
                className="h-9 rounded border px-2"
              >
                {(["draft", "review", "scheduled", "published"] as Visibility[]).map((v) => (
                  <option key={v} value={v}>
                    {visibilityLabels[v]}
                  </option>
                ))}
              </select>
            </label>

            {/* I2 — scheduled 는 공개 시각이 필수다. 예전에는 입력 자체가 없어 저장이 깨졌다. */}
            {selected.visibilityStatus === "scheduled" ? (
              <label className="flex flex-col gap-1">
                {messages.publishAtLabel}
                <input
                  type="datetime-local"
                  required
                  className="h-9 rounded border px-2"
                  value={selected.publishAt ?? ""}
                  onChange={(e) =>
                    patch(selected.id, { publishAt: e.target.value || null })
                  }
                />
              </label>
            ) : null}

            <label className="flex flex-col gap-1">
              {messages.styleBackground}
              <input
                type="color"
                value={typeof selected.style.background === "string" ? selected.style.background : "#fbf6ee"}
                onChange={(e) =>
                  patch(selected.id, {
                    style: { ...selected.style, background: e.target.value },
                  })
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              {messages.stylePadding}
              <input
                type="number"
                className="h-8 rounded border px-1"
                value={typeof selected.style.padding === "number" ? selected.style.padding : 0}
                onChange={(e) =>
                  patch(selected.id, {
                    style: { ...selected.style, padding: Number(e.target.value) },
                  })
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              {messages.styleTypography}
              <select
                className="h-9 rounded border px-2"
                value={String(selected.style.typography ?? "md")}
                onChange={(e) =>
                  patch(selected.id, {
                    style: { ...selected.style, typography: e.target.value },
                  })
                }
              >
                <option value="sm">sm</option>
                <option value="md">md</option>
                <option value="lg">lg</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              {messages.styleOverlay}
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                className="h-8 rounded border px-1"
                value={typeof selected.style.overlay === "number" ? selected.style.overlay : 0}
                onChange={(e) =>
                  patch(selected.id, {
                    style: { ...selected.style, overlay: Number(e.target.value) },
                  })
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              {messages.styleRadius}
              <input
                type="number"
                min={0}
                className="h-8 rounded border px-1"
                value={typeof selected.style.radius === "number" ? selected.style.radius : 0}
                onChange={(e) =>
                  patch(selected.id, {
                    style: { ...selected.style, radius: Number(e.target.value) },
                  })
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              {messages.styleMaxWidth}
              <input
                type="number"
                min={0}
                className="h-8 rounded border px-1"
                value={typeof selected.style.maxWidth === "number" ? selected.style.maxWidth : 0}
                onChange={(e) =>
                  patch(selected.id, {
                    style: { ...selected.style, maxWidth: Number(e.target.value) || undefined },
                  })
                }
              />
            </label>
            <ContentFields
              block={selected}
              designs={designs}
              materials={materials}
              photos={photos}
              pairGroups={pairGroups}
              onChange={(content) => patch(selected.id, { content })}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="ghost-btn-sm"
                onClick={() => {
                  const copy = {
                    ...selected,
                    id: crypto.randomUUID(),
                    isNew: true,
                    visibilityStatus: "draft" as Visibility,
                    publishAt: null,
                    layout: { ...selected.layout, y: selected.layout.y + selected.layout.h },
                  };
                  commit([...blocks, copy]);
                }}
              >
                {messages.duplicateBlock}
              </button>
              <button
                type="button"
                className="ghost-btn-sm"
                onClick={() =>
                  patch(selected.id, {
                    visibilityStatus:
                      selected.visibilityStatus === "published" ? "review" : "draft",
                    publishAt: null,
                  })
                }
              >
                {messages.hideBlock}
              </button>
              <button
                type="button"
                className="danger-btn"
                onClick={() => patch(selected.id, { deleted: true })}
              >
                {messages.deleteBlock}
              </button>
            </div>
          </div>
        ) : null}

        <form
          action={saveProjectTemplateAction.bind(null, companySlug, projectId)}
          className="flex flex-col gap-2 border-t pt-3"
        >
          <input
            name="name"
            placeholder={messages.saveTemplate}
            className="h-9 rounded border px-2"
            required
          />
          <button type="submit" className="ghost-btn">
            {messages.saveTemplate}
          </button>
        </form>

        {templates.length > 0 ? (
          <form
            action={applyTemplateAction.bind(null, companySlug, projectId)}
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              const mode = (
                event.currentTarget.elements.namedItem("mode") as HTMLSelectElement
              )?.value;
              if (mode === "overwrite" && !window.confirm(messages.overwriteConfirm)) {
                event.preventDefault();
              }
            }}
          >
            <select name="templateId" className="h-9 rounded border px-2" required>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select name="mode" className="h-9 rounded border px-2">
              <option value="append">{messages.appendTemplate}</option>
              <option value="overwrite">{messages.overwriteTemplate}</option>
            </select>
            <button type="submit" className="ghost-btn">
              {messages.applyTemplate}
            </button>
          </form>
        ) : null}

        {templates
          .filter((t) => t.scope === "project" && t.promotionStatus !== "requested")
          .map((t) => (
            <form
              key={t.id}
              action={requestPromotionAction.bind(null, companySlug, projectId, t.id)}
            >
              <button type="submit" className="ghost-btn-sm">
                {messages.requestPromotion}: {t.name}
              </button>
            </form>
          ))}
      </aside>
    </div>
  );
}

function DraggableBlock({
  block,
  selected,
  onSelect,
}: {
  block: EditorBlock;
  selected: boolean;
  onSelect: () => void;
}) {
  const {
    attributes: moveAttributes,
    listeners: moveListeners,
    setNodeRef: setMoveRef,
    transform,
  } = useDraggable({ id: block.id, data: { mode: "move" } });
  // dnd-kit 은 id 가 유일해야 한다. 손잡이는 별도 id 를 쓰고 onDragEnd 에서 벗겨낸다.
  const {
    attributes: resizeAttributes,
    listeners: resizeListeners,
    setNodeRef: setResizeRef,
  } = useDraggable({ id: `${block.id}:resize`, data: { mode: "resize" } });
  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    left: `${(block.layout.x / COLUMNS) * 100}%`,
    width: `${(block.layout.w / COLUMNS) * 100}%`,
    top: block.layout.y * ROW_HEIGHT,
    height: block.layout.h * ROW_HEIGHT,
  };
  const label = PALETTE.find((p) => p.type === block.blockType)?.label ?? block.blockType;
  return (
    <div
      ref={setMoveRef}
      style={style}
      className={`absolute overflow-hidden rounded border bg-background text-left text-xs ${
        selected ? "ring-2 ring-primary" : ""
      }`}
    >
      <button
        type="button"
        {...moveListeners}
        {...moveAttributes}
        onClick={onSelect}
        className="h-full w-full p-2 text-left"
      >
        {label} · {visibilityLabels[block.visibilityStatus]}
      </button>
      {/* 크기 조정 손잡이 (문서② 4.2 "크기 조정") */}
      <span
        ref={setResizeRef}
        {...resizeListeners}
        {...resizeAttributes}
        title={messages.blockSize}
        className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize bg-primary/60"
      />
    </div>
  );
}

function ContentFields({
  block,
  designs,
  materials,
  photos,
  pairGroups,
  onChange,
}: {
  block: EditorBlock;
  designs: Array<{ id: string; versionName: string }>;
  materials: Array<{ id: string; name: string }>;
  photos: EditorPhoto[];
  pairGroups: Array<{ id: string; label: string }>;
  onChange: (content: unknown) => void;
}) {
  const content = block.content as Record<string, unknown>;

  if (block.blockType === "text") {
    const align = content.align === "center" ? "center" : "left";
    return (
      <label className="flex flex-col gap-1">
        {messages.blockText}
        <TextHtmlEditor
          key={block.id}
          html={String(content.html ?? "")}
          align={align}
          onChange={(next) => onChange({ ...content, ...next })}
        />
      </label>
    );
  }

  if (block.blockType === "design_file") {
    if (designs.length === 0) {
      return <p className="text-xs text-muted-foreground">{messages.noDesigns}</p>;
    }
    return (
      <select
        className="h-9 rounded border px-2"
        value={String(content.designVersionId ?? "")}
        onChange={(e) => onChange({ designVersionId: e.target.value })}
      >
        <option value="">-</option>
        {designs.map((d) => (
          <option key={d.id} value={d.id}>
            {d.versionName}
          </option>
        ))}
      </select>
    );
  }

  if (block.blockType === "material_card") {
    if (materials.length === 0) {
      return <p className="text-xs text-muted-foreground">{messages.noMaterials}</p>;
    }
    const selected = new Set((content.materialIds as string[] | undefined) ?? []);
    return (
      <div className="flex max-h-40 flex-col gap-1 overflow-auto">
        {materials.map((m) => (
          <label key={m.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selected.has(m.id)}
              onChange={(e) => {
                const next = new Set(selected);
                if (e.target.checked) next.add(m.id);
                else next.delete(m.id);
                onChange({ materialIds: [...next] });
              }}
            />
            {m.name}
          </label>
        ))}
      </div>
    );
  }

  if (block.blockType === "before_after") {
    if (pairGroups.length === 0) {
      return <p className="text-xs text-muted-foreground">{messages.noPairGroups}</p>;
    }
    return (
      <select
        className="h-9 rounded border px-2"
        value={String(content.pairGroupId ?? "")}
        onChange={(e) => onChange({ ...content, pairGroupId: e.target.value })}
      >
        <option value="">-</option>
        {pairGroups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.label}
          </option>
        ))}
      </select>
    );
  }

  // 예전에는 UUID 를 쉼표로 직접 입력하게 했다. 프로젝트 사진에서 고른다.
  if (block.blockType === "gallery") {
    if (photos.length === 0) {
      return <p className="text-xs text-muted-foreground">{messages.noPhotos}</p>;
    }
    const ids = new Set((content.objectIds as string[] | undefined) ?? []);
    return (
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2">
          {messages.blockColumns}
          <input
            type="number"
            min={1}
            max={4}
            className="h-8 w-16 rounded border px-1"
            value={Number(content.columns ?? 2)}
            onChange={(e) =>
              onChange({ objectIds: [...ids], columns: Number(e.target.value) })
            }
          />
        </label>
        <p className="text-xs text-muted-foreground">{messages.blockPickPhotos}</p>
        <div className="grid max-h-56 grid-cols-3 gap-1 overflow-auto">
          {photos.map((p) => {
            const on = ids.has(p.storageObjectId);
            return (
              <button
                key={p.id}
                type="button"
                className={`relative overflow-hidden rounded border ${on ? "ring-2 ring-primary" : ""}`}
                onClick={() => {
                  const next = new Set(ids);
                  if (on) next.delete(p.storageObjectId);
                  else next.add(p.storageObjectId);
                  onChange({
                    objectIds: [...next],
                    columns: Number(content.columns ?? 2),
                  });
                }}
              >
                <FileImage
                  objectId={p.storageObjectId}
                  alt=""
                  className="h-16 w-full object-cover"
                />
                {!p.published ? (
                  <span className="absolute bottom-0 left-0 bg-[var(--ink)] px-1 text-[10px] text-[var(--paper)]">
                    {visibilityLabels.draft}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (block.blockType === "schedule") {
    const types = new Set((content.scheduleTypes as string[] | undefined) ?? []);
    return (
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2">
          {messages.blockScheduleMode}
          <select
            className="h-8 rounded border px-1"
            value={String(content.mode ?? "list")}
            onChange={(e) =>
              onChange({ mode: e.target.value, scheduleTypes: [...types] })
            }
          >
            <option value="list">{messages.viewList}</option>
            <option value="month">{messages.viewMonth}</option>
          </select>
        </label>
        <p className="text-xs text-muted-foreground">{messages.blockScheduleTypes}</p>
        {Object.entries(scheduleTypeLabels).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={types.has(value)}
              onChange={(e) => {
                const next = new Set(types);
                if (e.target.checked) next.add(value);
                else next.delete(value);
                onChange({ mode: content.mode ?? "list", scheduleTypes: [...next] });
              }}
            />
            {label}
          </label>
        ))}
      </div>
    );
  }

  if (block.blockType === "comment") {
    return (
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={content.allowNewComment !== false}
          onChange={(e) => onChange({ allowNewComment: e.target.checked })}
        />
        {messages.blockAllowComment}
      </label>
    );
  }

  if (block.blockType === "process") {
    const cats = new Set((content.categories as string[] | undefined) ?? []);
    return (
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">
          {messages.blockProcessCategories}
        </p>
        <div className="grid max-h-40 grid-cols-2 gap-1 overflow-auto">
          {Object.entries(processLabels).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={cats.has(value)}
                onChange={(e) => {
                  const next = new Set(cats);
                  if (e.target.checked) next.add(value);
                  else next.delete(value);
                  onChange({ categories: [...next] });
                }}
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (block.blockType === "button") {
    const action = String(content.action ?? "external");
    return (
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          {messages.blockButtonLabel}
          <input
            className="h-9 rounded border px-2"
            value={String(content.label ?? "")}
            onChange={(e) => onChange({ ...content, label: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          {messages.blockButtonAction}
          <select
            className="h-9 rounded border px-2"
            value={action}
            onChange={(e) => onChange({ ...content, action: e.target.value })}
          >
            {Object.entries(buttonActionLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {action === "external" ? (
          <label className="flex flex-col gap-1">
            {messages.blockButtonHref}
            <input
              className="h-9 rounded border px-2"
              placeholder="https://"
              value={String(content.href ?? "")}
              onChange={(e) => onChange({ ...content, href: e.target.value })}
            />
          </label>
        ) : null}
      </div>
    );
  }

  if (block.blockType === "divider") {
    return (
      <label className="flex items-center gap-2">
        {messages.blockDividerSpacing}
        <select
          className="h-8 rounded border px-1"
          value={String(content.spacing ?? "md")}
          onChange={(e) => onChange({ spacing: e.target.value })}
        >
          {Object.entries(spacingLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return null;
}
