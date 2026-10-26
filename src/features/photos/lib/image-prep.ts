// 업로드 전 브라우저 이미지 준비 (통합본 7장 F3·F4) — GIF·BMP 는 JPEG 로 바꾸고, 긴 변이 4000px 를 넘으면 줄인다.
// 판단(planImagePrep)은 순수 함수, 실제 그리기(prepareImage)는 브라우저 API 를 주입받는다.
// 촬영일 EXIF 는 그리기 전에 원본에서 읽는다 (캔버스로 다시 그리면 EXIF 가 사라진다 — POL-022)

/** 브라우저가 JPEG 로 바꿔 올리는 형식 (서버 허용 목록 밖, F3). TIFF·HEIC 는 여기서 다루지 않는다 */
export const CONVERT_EXTS = ['.gif', '.bmp'] as const;
/** 긴 변 최대 픽셀 (F4) */
export const MAX_EDGE = 4000;
export const JPEG_QUALITY = 0.9;

const KEEP_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

export function needsConversion(f: { name: string; type: string }): boolean {
  const ext = extOf(f.name);
  return (
    (CONVERT_EXTS as readonly string[]).includes(ext) ||
    f.type === 'image/gif' ||
    f.type === 'image/bmp'
  );
}

export interface PrepPlan {
  /** 다시 그려야 하는가 (변환 또는 축소) */
  redraw: boolean;
  width: number;
  height: number;
  type: string;
  name: string;
}

/** 원본 크기·형식 → 그릴 크기·출력 형식·파일 이름 */
export function planImagePrep(
  f: { name: string; type: string },
  size: { width: number; height: number },
): PrepPlan {
  const convert = needsConversion(f);
  const longest = Math.max(size.width, size.height);
  const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
  const type = convert || !KEEP_TYPES.has(f.type) ? 'image/jpeg' : f.type;
  const base = f.name.slice(0, f.name.length - extOf(f.name).length) || 'photo';
  return {
    redraw: convert || scale < 1,
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
    type,
    name: convert ? `${base}.jpg` : f.name,
  };
}

export interface DrawDeps {
  /** EXIF 방향을 반영해 디코딩 (createImageBitmap(file, { imageOrientation: 'from-image' })) */
  decode(file: File): Promise<{ width: number; height: number; close(): void } & CanvasImageSource>;
  /** 주어진 크기로 그려 Blob 으로 */
  draw(
    image: CanvasImageSource,
    width: number,
    height: number,
    type: string,
    quality: number,
  ): Promise<Blob>;
}

export const browserDrawDeps: DrawDeps = {
  decode: (file) => createImageBitmap(file, { imageOrientation: 'from-image' }),
  async draw(image, width, height, type, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    // JPEG 는 투명 영역이 검게 나오므로 흰 바탕 (GIF·PNG 투명 배경)
    if (type === 'image/jpeg') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(image, 0, 0, width, height);
    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), type, quality),
    );
  },
};

/** 변환·축소가 필요 없으면 원본 그대로. 디코딩 실패는 'corrupt' */
export async function prepareImage(
  file: File,
  deps: DrawDeps = browserDrawDeps,
): Promise<{ ok: true; file: File } | { ok: false; reason: 'corrupt' }> {
  let image: Awaited<ReturnType<DrawDeps['decode']>>;
  try {
    image = await deps.decode(file);
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
  try {
    const plan = planImagePrep(file, image);
    if (!plan.redraw) return { ok: true, file };
    const blob = await deps.draw(image, plan.width, plan.height, plan.type, JPEG_QUALITY);
    return { ok: true, file: new File([blob], plan.name, { type: plan.type }) };
  } catch {
    return { ok: false, reason: 'corrupt' };
  } finally {
    image.close();
  }
}
