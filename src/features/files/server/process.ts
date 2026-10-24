// finalize 의 실제 바이트 검사·이미지 처리 (03 문서 3.3 ③, SEC-006·007, POL-021·022)
import 'server-only';
import exifr from 'exifr';
import sharp from 'sharp';
import {
  FILE_RULES,
  IMAGE_MAX_PIXELS,
  THUMB_WIDTH,
  type FileKind,
} from '@/shared/contracts/domain';
import {
  exifDateToYmd,
  FORMAT_MIME,
  formatMatches,
  IMAGE_FORMATS,
  SNIFF_BYTES,
  sniffFormat,
  type RejectReason,
  type UploadKind,
} from '@/features/files/lib/rules';

export type InspectResult =
  | { status: 'rejected'; reason: RejectReason }
  | {
      status: 'ready';
      bytes: Buffer;
      mime: string;
      reencoded: boolean;
      width?: number;
      height?: number;
      capturedOn?: string;
      thumb?: { bytes: Buffer; width: number; height: number };
    };

export async function inspectAndNormalize(
  kind: FileKind,
  fileName: string,
  original: Buffer,
): Promise<InspectResult> {
  if (kind === 'photo_thumb') return { status: 'rejected', reason: 'type' };
  const uploadKind: UploadKind = kind;
  if (original.length === 0 || original.length > FILE_RULES[uploadKind].maxBytes) {
    return { status: 'rejected', reason: 'size' };
  }
  const format = sniffFormat(original.subarray(0, SNIFF_BYTES));
  if (!format || !formatMatches(uploadKind, fileName, format)) {
    return { status: 'rejected', reason: 'type' };
  }
  if (!IMAGE_FORMATS.includes(format)) {
    // PDF·DWG·SKP 원본은 바꾸지 않는다 (서버는 형식 헤더만 검사)
    return { status: 'ready', bytes: original, mime: FORMAT_MIME[format], reencoded: false };
  }

  let meta: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try {
    meta = await sharp(original, { limitInputPixels: false }).metadata();
  } catch {
    return { status: 'rejected', reason: 'corrupt' };
  }
  if (!meta.width || !meta.height) return { status: 'rejected', reason: 'corrupt' };
  if (meta.width * meta.height > IMAGE_MAX_PIXELS) return { status: 'rejected', reason: 'pixels' };

  // 촬영일은 재인코딩(메타데이터 제거) 전에 읽는다
  let capturedOn: string | undefined;
  if (kind === 'photo_original') {
    try {
      const exif = (await exifr.parse(original, {
        pick: ['DateTimeOriginal', 'CreateDate'],
        reviveValues: false,
      })) as { DateTimeOriginal?: unknown; CreateDate?: unknown } | undefined;
      capturedOn = exifDateToYmd(exif?.DateTimeOriginal) ?? exifDateToYmd(exif?.CreateDate);
    } catch {
      capturedOn = undefined; // EXIF 가 없거나 깨진 사진은 촬영일 없이 진행 (POL-022)
    }
  }

  try {
    const pipeline = sharp(original, { limitInputPixels: IMAGE_MAX_PIXELS }).rotate();
    const encoded =
      format === 'png'
        ? pipeline.png()
        : format === 'webp'
          ? pipeline.webp({ quality: 90 })
          : pipeline.jpeg({ quality: 90, mozjpeg: true });
    const { data, info } = await encoded.toBuffer({ resolveWithObject: true });

    let thumb: { bytes: Buffer; width: number; height: number } | undefined;
    if (kind === 'photo_original') {
      const t = await sharp(data)
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true });
      thumb = { bytes: t.data, width: t.info.width, height: t.info.height };
    }
    return {
      status: 'ready',
      bytes: data,
      mime: FORMAT_MIME[format],
      reencoded: true,
      width: info.width,
      height: info.height,
      capturedOn,
      thumb,
    };
  } catch {
    return { status: 'rejected', reason: 'corrupt' };
  }
}
