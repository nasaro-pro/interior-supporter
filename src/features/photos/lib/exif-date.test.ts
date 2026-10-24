import { describe, expect, it, vi } from 'vitest';
import { exifDateToYmd, readExifDate } from './exif-date';

vi.mock('exifr', () => ({
  default: {
    parse: vi.fn(async (file: File) =>
      file.name === 'with-date.jpg' ? { DateTimeOriginal: new Date(2026, 9, 5, 23, 30) } : {},
    ),
  },
}));

describe('exif-date (POL-022)', () => {
  it('카메라에 기록된 현지 날짜 그대로 (시간대 변환 없음)', () => {
    expect(exifDateToYmd(new Date(2026, 9, 5, 23, 30))).toBe('2026-10-05');
    expect(exifDateToYmd(null)).toBeNull();
    expect(exifDateToYmd(new Date('invalid'))).toBeNull();
  });
  it('EXIF 촬영일이 있으면 YYYY-MM-DD, 없으면 null', async () => {
    expect(await readExifDate(new File(['x'], 'with-date.jpg'))).toBe('2026-10-05');
    expect(await readExifDate(new File(['x'], 'none.jpg'))).toBeNull();
  });
});
