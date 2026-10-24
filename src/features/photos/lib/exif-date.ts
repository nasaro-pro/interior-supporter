// EXIF 촬영일 제안 (POL-022) — 브라우저에서 업로드 전에 읽어 화면에 보여 준다. 서버 finalize 값은 대체값.
import { format, isValid } from 'date-fns';

/**
 * EXIF DateTimeOriginal 은 시간대 없는 현지 시각이고 exifr 는 이를 브라우저 현지 시각 Date 로 만든다.
 * 현지 필드를 그대로 읽어 카메라에 기록된 날짜를 쓴다 (시간대 변환 없음, POL-023).
 */
export function exifDateToYmd(d: Date | null | undefined): string | null {
  if (!d || !isValid(d)) return null;
  return format(d, 'yyyy-MM-dd');
}

export async function readExifDate(file: File): Promise<string | null> {
  try {
    const { default: exifr } = await import('exifr');
    const tags = (await exifr.parse(file, ['DateTimeOriginal', 'CreateDate'])) as
      { DateTimeOriginal?: Date; CreateDate?: Date } | undefined;
    return exifDateToYmd(tags?.DateTimeOriginal ?? tags?.CreateDate ?? null);
  } catch {
    // EXIF 가 없거나 읽을 수 없는 파일 — 제안 없이 진행 (사용자 입력 또는 서버 값 사용)
    return null;
  }
}
