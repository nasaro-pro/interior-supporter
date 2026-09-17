import { z } from "zod";

const scheduleType = z.enum(["process", "visit", "confirmed", "meeting"]);
const processCategory = z.enum([
  "demolition",
  "electrical",
  "carpentry",
  "tile",
  "film",
  "flooring",
  "fixture_setting",
  "wallpaper",
  "furniture_install",
  "lighting_install",
  "finishing",
]);

export const layoutSchema = z.object({
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(24),
});

export const blockContentSchemas = {
  text: z.object({
    html: z.string().max(20_000),
    align: z.enum(["left", "center"]).default("left"),
  }),
  gallery: z.object({
    objectIds: z.array(z.string().uuid()).max(30),
    columns: z.number().int().min(1).max(4),
  }),
  before_after: z.object({
    pairGroupId: z.string().uuid(),
    caption: z.string().max(200).optional(),
  }),
  design_file: z.object({ designVersionId: z.string().uuid() }),
  material_card: z.object({
    materialIds: z.array(z.string().uuid()).max(50),
  }),
  schedule: z.object({
    mode: z.enum(["month", "list"]),
    scheduleTypes: z.array(scheduleType),
  }),
  comment: z.object({ allowNewComment: z.boolean().default(true) }),
  process: z.object({ categories: z.array(processCategory).max(11) }),
  button: z.object({
    label: z.string().max(40),
    action: z.enum(["open_file", "approve", "external"]),
    href: z.string().url().optional(),
  }),
  divider: z.object({ spacing: z.enum(["sm", "md", "lg"]).default("md") }),
} as const;

export type BlockType = keyof typeof blockContentSchemas;

export function parseBlockContent(type: BlockType, content: unknown) {
  return blockContentSchemas[type].parse(content);
}

export function emptyContent(type: BlockType): unknown {
  switch (type) {
    case "text":
      return { html: "<p></p>", align: "left" };
    case "gallery":
      return { objectIds: [], columns: 2 };
    case "before_after":
      return { pairGroupId: "00000000-0000-0000-0000-000000000000" };
    case "design_file":
      return { designVersionId: "00000000-0000-0000-0000-000000000000" };
    case "material_card":
      return { materialIds: [] };
    case "schedule":
      return { mode: "list", scheduleTypes: ["process", "visit", "confirmed", "meeting"] };
    case "comment":
      return { allowNewComment: true };
    case "process":
      return { categories: [] };
    case "button":
      return { label: "바로가기", action: "external", href: "https://example.com" };
    case "divider":
      return { spacing: "md" };
  }
}
