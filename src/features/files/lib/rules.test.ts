import { describe, expect, it } from 'vitest';
import {
  checkNameAndSize,
  exifDateToYmd,
  extOf,
  formatMatches,
  sizeParts,
  sniffFormat,
  storagePath,
} from '@/features/files/lib/rules';

const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(
    parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)),
  );
const utf16 = (s: string) => [...s].flatMap((c) => [c.charCodeAt(0), 0]);

const PDF = bytes('%PDF-1.7\n');
const DWG = bytes('AC1032', [0, 0, 0]);
const SKP = bytes([0xff, 0xfe, 0xff, 0x0e], utf16('SketchUp Model'));
const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0]);
const WEBP = bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8 ');

describe('B-T01 / REQ-101 도안 원본 형식 검사', () => {
  it('TC-101 SKP·PDF·DWG 는 대소문자와 관계없이 허용한다', () => {
    expect(checkNameAndSize('design_original', 'Plan.PDF', 1000)).toBeNull();
    expect(checkNameAndSize('design_original', 'plan.Dwg', 1000)).toBeNull();
    expect(checkNameAndSize('design_original', 'model.SKP', 1000)).toBeNull();
    expect(extOf('A.B.SkP')).toBe('.skp');
  });

  it('TC-101 다른 형식·확장자 없음은 type 으로 거절한다', () => {
    expect(checkNameAndSize('design_original', 'plan.png', 1000)).toBe('type');
    expect(checkNameAndSize('design_original', 'plan', 1000)).toBe('type');
    expect(checkNameAndSize('estimate_pdf', 'quote.docx', 1000)).toBe('type');
  });

  it('TC-101 용량 초과(도안 50MB, 견적 20MB)와 0바이트는 size 로 거절한다', () => {
    expect(checkNameAndSize('design_original', 'a.pdf', 50 * 1024 * 1024)).toBeNull();
    expect(checkNameAndSize('design_original', 'a.pdf', 50 * 1024 * 1024 + 1)).toBe('size');
    expect(checkNameAndSize('estimate_pdf', 'a.pdf', 20 * 1024 * 1024 + 1)).toBe('size');
    expect(checkNameAndSize('design_original', 'a.pdf', 0)).toBe('size');
  });

  it('실제 바이트로 형식을 판정한다', () => {
    expect(sniffFormat(PDF)).toBe('pdf');
    expect(sniffFormat(DWG)).toBe('dwg');
    expect(sniffFormat(SKP)).toBe('skp');
    expect(sniffFormat(PNG)).toBe('png');
    expect(sniffFormat(JPEG)).toBe('jpeg');
    expect(sniffFormat(WEBP)).toBe('webp');
    expect(sniffFormat(bytes('hello world'))).toBeNull();
  });

  it('THR-006 확장자만 바꾼 파일(위장)은 거절한다', () => {
    expect(formatMatches('design_original', 'plan.pdf', sniffFormat(PDF))).toBe(true);
    expect(formatMatches('design_original', 'plan.dwg', sniffFormat(PDF))).toBe(false);
    expect(formatMatches('design_original', 'evil.pdf', sniffFormat(bytes('MZ\x90\x00')))).toBe(
      false,
    );
    expect(formatMatches('material_image', 'photo.jpg', sniffFormat(PNG))).toBe(false);
    expect(formatMatches('material_image', 'photo.JPEG', sniffFormat(JPEG))).toBe(true);
    // 종류별 허용 확장자 밖이면 형식이 맞아도 거절
    expect(formatMatches('estimate_pdf', 'img.png', sniffFormat(PNG))).toBe(false);
  });
});

describe('파일 경로·표시 보조', () => {
  it('저장 경로는 03 문서 3.3 형식을 따른다', () => {
    expect(storagePath('c1', 'p1', 'design_original', 'f1', '.pdf')).toBe(
      'company/c1/project/p1/design_original/f1.pdf',
    );
    expect(storagePath('c1', null, 'company_logo', 'f2', '.png')).toBe(
      'company/c1/project/_/company_logo/f2.png',
    );
  });

  it('크기 표시 단위', () => {
    expect(sizeParts(500)).toEqual({ unit: 'kb', value: '1' });
    expect(sizeParts(50 * 1024 * 1024)).toEqual({ unit: 'mb', value: '50' });
    expect(sizeParts(1.5 * 1024 * 1024)).toEqual({ unit: 'mb', value: '1.5' });
  });

  it('EXIF 촬영일은 시간대 변환 없이 달력 값으로 읽는다', () => {
    expect(exifDateToYmd('2026:10:06 23:59:59')).toBe('2026-10-06');
    expect(exifDateToYmd('0000:00:00 00:00:00')).toBeUndefined();
    expect(exifDateToYmd(undefined)).toBeUndefined();
  });
});
