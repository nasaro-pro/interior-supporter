// @vitest-environment node
// 공개용 사본: 위치정보·촬영 기기 등 메타데이터가 남지 않는지, 크기·방향이 맞는지
import { describe, expect, it, vi } from 'vitest';
import exifr from 'exifr';
import sharp from 'sharp';

vi.mock('server-only', () => ({}));

const { buildPublicVariants, publicPaths, PUBLIC_LONG_EDGE, PUBLIC_THUMB_EDGE } =
  await import('./public-variants');

/** GPS·기기·방향(6 = 90° 회전) EXIF 가 들어 있는 JPEG */
async function jpegWithExif(width: number, height: number, orientation = 1) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 180, b: 150 } },
  })
    .jpeg()
    .withMetadata({ orientation })
    .withExifMerge({
      IFD0: { Make: 'TestPhone', Model: 'X1' },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '37/1 31/1 0/1',
        GPSLongitudeRef: 'E',
        GPSLongitude: '127/1 2/1 0/1',
      },
    })
    .toBuffer();
}

describe('buildPublicVariants', () => {
  it('원본에 있던 GPS·기기 정보가 사본에는 없다', async () => {
    const src = await jpegWithExif(1200, 900);
    // 전제 확인: 원본에는 실제로 GPS 가 있다
    expect(await exifr.gps(src)).toBeTruthy();

    const out = await buildPublicVariants(src);
    expect(out.status).toBe('ok');
    if (out.status !== 'ok') return;
    for (const v of [out.display, out.thumb]) {
      // exifr 는 WebP 를 읽지 못하므로 sharp 메타데이터 + 바이트 검색으로 확인한다
      const meta = await sharp(v.bytes).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.exif).toBeUndefined();
      expect(meta.icc).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
      // RIFF 안에 EXIF·XMP 청크가 없고, 기기 이름 문자열도 남지 않았다
      const raw = v.bytes.toString('latin1');
      expect(raw.includes('EXIF')).toBe(false);
      expect(raw.includes('XMP ')).toBe(false);
      expect(raw.includes('TestPhone')).toBe(false);
    }
  });

  it('긴 변을 2000/640 으로 줄이고 비율을 지킨다', async () => {
    const out = await buildPublicVariants(await jpegWithExif(4000, 3000));
    if (out.status !== 'ok') throw new Error('expected ok');
    expect([out.display.width, out.display.height]).toEqual([PUBLIC_LONG_EDGE, 1500]);
    expect([out.thumb.width, out.thumb.height]).toEqual([PUBLIC_THUMB_EDGE, 480]);
  });

  it('작은 사진은 키우지 않는다', async () => {
    const out = await buildPublicVariants(await jpegWithExif(800, 600));
    if (out.status !== 'ok') throw new Error('expected ok');
    expect([out.display.width, out.display.height]).toEqual([800, 600]);
  });

  it('EXIF 방향값을 픽셀에 반영한 뒤 지운다 (세로 사진이 눕지 않음)', async () => {
    const out = await buildPublicVariants(await jpegWithExif(1200, 900, 6));
    if (out.status !== 'ok') throw new Error('expected ok');
    expect([out.display.width, out.display.height]).toEqual([900, 1200]);
  });

  it('이미지가 아니면 거절한다', async () => {
    const out = await buildPublicVariants(Buffer.from('%PDF-1.7 not an image'));
    expect(out).toEqual({ status: 'rejected', reason: 'corrupt' });
  });
});

describe('publicPaths', () => {
  it('업체/사례/사진 경로를 만든다', () => {
    expect(publicPaths('c', 'w', 'i')).toEqual({ path: 'c/w/i.webp', thumbPath: 'c/w/i_t.webp' });
  });
});
