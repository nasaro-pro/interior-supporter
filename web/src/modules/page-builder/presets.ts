import { emptyContent, type BlockType } from "@/modules/page-builder/blocks/schemas";
import type { Visibility } from "@/lib/visibility";

type Layout = { x: number; y: number; w: number; h: number };

export type PresetBlock = {
  id: string;
  blockType: BlockType;
  layout: Layout;
  style: Record<string, unknown>;
  content: unknown;
  visibilityStatus: Visibility;
  publishAt: string | null;
  isNew: boolean;
};

function block(
  type: BlockType,
  layout: Layout,
  style: Record<string, unknown> = {},
  content?: unknown,
): PresetBlock {
  return {
    id: crypto.randomUUID(),
    blockType: type,
    layout,
    style,
    content: content ?? emptyContent(type),
    visibilityStatus: "draft" as Visibility,
    publishAt: null,
    isNew: true,
  };
}

export function presetBlocks(kind: "atelier" | "gallery" | "journal"): PresetBlock[] {
  if (kind === "atelier") {
    return [
      block("text", { x: 1, y: 0, w: 10, h: 4 }, { padding: 24, typography: "lg" }, {
        html: "<p>여백과 세리프로 공간을 소개합니다.</p>",
        align: "center",
      }),
      block("divider", { x: 2, y: 4, w: 8, h: 1 }, { padding: 8 }),
      block("gallery", { x: 0, y: 5, w: 12, h: 6 }, { padding: 0 }),
      block("material_card", { x: 1, y: 11, w: 10, h: 5 }, { padding: 16 }),
    ];
  }
  if (kind === "gallery") {
    return [
      block("gallery", { x: 0, y: 0, w: 12, h: 7 }, { padding: 0 }),
      block("before_after", { x: 0, y: 7, w: 12, h: 6 }, { padding: 0 }),
      block("text", { x: 2, y: 13, w: 8, h: 3 }, { typography: "sm", padding: 12 }, {
        html: "<p>사진이 주인공인 갤러리 구성.</p>",
        align: "center",
      }),
    ];
  }
  return [
    block("process", { x: 0, y: 0, w: 12, h: 5 }, { padding: 16 }),
    block("schedule", { x: 0, y: 5, w: 12, h: 6 }, { padding: 16 }, {
      mode: "list",
      scheduleTypes: ["process", "visit", "confirmed", "meeting"],
    }),
    block("gallery", { x: 0, y: 11, w: 12, h: 5 }, { padding: 0 }),
    block("comment", { x: 0, y: 16, w: 12, h: 6 }, { padding: 16 }),
  ];
}
