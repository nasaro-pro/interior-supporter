const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PDF = [0x25, 0x50, 0x44, 0x46];

function startsWith(bytes: Uint8Array, sig: number[]) {
  return sig.every((b, i) => bytes[i] === b);
}

export function sniffMime(bytes: Uint8Array, filename = ""): string | null {
  if (startsWith(bytes, JPEG)) return "image/jpeg";
  if (startsWith(bytes, PNG)) return "image/png";
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (startsWith(bytes, PDF)) return "application/pdf";
  if (startsWith(bytes, [0x41, 0x43, 0x31, 0x30])) return "application/x-dwg";
  const name = filename.toLowerCase();
  if (name.endsWith(".dwg")) return "application/x-dwg";
  if (name.endsWith(".skp")) return "application/x-sketchup";
  return null;
}

export const ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/x-dwg",
  "application/x-sketchup",
] as const;

export function extForMime(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "application/x-dwg") return "dwg";
  if (mime === "application/x-sketchup") return "skp";
  return "pdf";
}

export function isCadMime(mime: string) {
  return mime === "application/x-dwg" || mime === "application/x-sketchup";
}