// 공개용 사본 만들기 — 순수 이미지 처리 (DB·저장소 호출 없음, 단위 테스트 대상)
// 원본(비공개 버킷)은 그대로 두고, 외부에 보여 줄 WebP 2장(본 이미지·썸네일)을 새로 만든다.
//   1) .rotate()      : EXIF 방향값을 픽셀에 반영 (메타데이터를 지워도 사진이 눕지 않게)
//   2) resize inside  : 긴 변 2000px(본), 640px(썸네일). 작은 사진은 키우지 않는다
//   3) toColorspace   : sRGB 로 맞춘 뒤 ICC 를 포함한 모든 메타데이터를 버린다
//   4) .webp()        : sharp 는 withMetadata()/keepExif() 를 부르지 않으면 EXIF·GPS·XMP·IPTC 를 쓰지 않는다
import 'server-only';
import sharp from 'sharp';
import { IMAGE_MAX_PIXELS } from '@/shared/contracts/domain';

export const PUBLIC_LONG_EDGE = 2000;
export const PUBLIC_THUMB_EDGE = 640;
export const PUBLIC_QUALITY = 82;
export const PUBLIC_THUMB_QUALITY = 76;

export interface PublicVariant {
  bytes: Buffer;
  width: number;
  height: number;
}

export type PublicVariantsResult =
  | { status: 'ok'; display: PublicVariant; thumb: PublicVariant }
  | { status: 'rejected'; reason: 'corrupt' | 'pixels' };

export async function buildPublicVariants(original: Buffer): Promise<PublicVariantsResult> {
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try {
    meta = await sharp(original, { limitInputPixels: false }).metadata();
  } catch {
    return { status: 'rejected', reason: 'corrupt' };
  }
  if (!meta.width || !meta.height) return { status: 'rejected', reason: 'corrupt' };
  if (meta.width * meta.height > IMAGE_MAX_PIXELS) return { status: 'rejected', reason: 'pixels' };

  try {
    const make = (edge: number, quality: number) =>
      sharp(original, { limitInputPixels: IMAGE_MAX_PIXELS })
        .rotate()
        .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
        .toColorspace('srgb')
        .webp({ quality, effort: 4 })
        .toBuffer({ resolveWithObject: true });
    const [d, t] = await Promise.all([
      make(PUBLIC_LONG_EDGE, PUBLIC_QUALITY),
      make(PUBLIC_THUMB_EDGE, PUBLIC_THUMB_QUALITY),
    ]);
    return {
      status: 'ok',
      display: { bytes: d.data, width: d.info.width, height: d.info.height },
      thumb: { bytes: t.data, width: t.info.width, height: t.info.height },
    };
  } catch {
    return { status: 'rejected', reason: 'corrupt' };
  }
}

/** 공개 버킷 안 경로 — {업체}/{사례}/{사진}.webp, 썸네일은 _t. 모두 서버가 만든 UUID 라 추측할 수 없다 */
export function publicPaths(companyId: string, workId: string, imageId: string) {
  const base = `${companyId}/${workId}/${imageId}`;
  return { path: `${base}.webp`, thumbPath: `${base}_t.webp` };
}

export function publicLogoPath(companyId: string, logoCopyId: string) {
  return `${companyId}/logo/${logoCopyId}.webp`;
}
