// 파일 규격 판정 (서버·브라우저 공용 순수 함수) — POL-021, REQ-060·061
import { FILE_RULES, type FileKind } from '@/shared/contracts/domain';

export type UploadKind = Exclude<FileKind, 'photo_thumb'>;
export type DetectedFormat = 'pdf' | 'dwg' | 'skp' | 'png' | 'jpeg' | 'webp';
export type RejectReason = 'type' | 'size' | 'corrupt' | 'pixels';

/** 형식 헤더 판정에 필요한 앞부분 바이트 수 */
export const SNIFF_BYTES = 64;

const EXT_FORMAT: Record<string, DetectedFormat> = {
  '.pdf': 'pdf',
  '.dwg': 'dwg',
  '.skp': 'skp',
  '.png': 'png',
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.webp': 'webp',
};

export const IMAGE_FORMATS: readonly DetectedFormat[] = ['png', 'jpeg', 'webp'];

export const FORMAT_MIME: Record<DetectedFormat, string> = {
  pdf: 'application/pdf',
  dwg: 'image/vnd.dwg',
  skp: 'application/vnd.sketchup.skp',
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/** 확장자 (소문자, 점 포함). 없으면 '' — REQ-101: 대소문자 무시 */
export function extOf(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  return i < 0 ? '' : fileName.slice(i).toLowerCase();
}

/** 1차 검사(확장자·크기). 통과하면 null */
export function checkNameAndSize(
  kind: UploadKind,
  fileName: string,
  sizeBytes: number,
): Extract<RejectReason, 'type' | 'size'> | null {
  const rule = FILE_RULES[kind];
  if (!rule.exts.includes(extOf(fileName))) return 'type';
  if (sizeBytes <= 0 || sizeBytes > rule.maxBytes) return 'size';
  return null;
}

const startsWith = (b: Uint8Array, sig: number[], at = 0) =>
  b.length >= at + sig.length && sig.every((v, i) => b[at + i] === v);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const utf16le = (s: string) => [...s].flatMap((c) => [c.charCodeAt(0), 0]);

function includesSeq(b: Uint8Array, seq: number[], limit: number): boolean {
  const end = Math.min(b.length, limit) - seq.length;
  for (let i = 0; i <= end; i++) if (seq.every((v, j) => b[i + j] === v)) return true;
  return false;
}

/**
 * 실제 바이트로 형식 판정 (THR-006: 확장자 위장 거절).
 * - PDF `%PDF-` · DWG `AC10xx` · PNG·JPEG·WebP 시그니처
 * - SKP: 앞부분에 UTF-16LE "SketchUp Model" 표식 (구버전 확인 형식). 신버전 헤더는 실제 파일로 확인 필요(progress/B.md 5번)
 */
export function sniffFormat(bytes: Uint8Array): DetectedFormat | null {
  if (startsWith(bytes, ascii('%PDF-'))) return 'pdf';
  if (startsWith(bytes, ascii('AC10'))) return 'dwg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'webp';
  if (includesSeq(bytes, utf16le('SketchUp Model'), SNIFF_BYTES)) return 'skp';
  return null;
}

/** 실제 형식이 확장자·파일 종류와 맞는지 */
export function formatMatches(kind: UploadKind, fileName: string, format: DetectedFormat | null) {
  if (!format) return false;
  const ext = extOf(fileName);
  return EXT_FORMAT[ext] === format && FILE_RULES[kind].exts.includes(ext);
}

/** 'company/{companyId}/project/{projectId 또는 _}/{kind}/{fileId}{ext}' (03 문서 3.3) */
export function storagePath(
  companyId: string,
  projectId: string | null,
  kind: FileKind,
  fileId: string,
  ext: string,
): string {
  return `company/${companyId}/project/${projectId ?? '_'}/${kind}/${fileId}${ext}`;
}

/** 표시용 크기 → { unit, value } (문구는 files.size.kb|mb 키) */
export function sizeParts(bytes: number): { unit: 'kb' | 'mb'; value: string } {
  if (bytes < 1024 * 1024)
    return { unit: 'kb', value: String(Math.max(1, Math.round(bytes / 1024))) };
  return { unit: 'mb', value: (bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, '') };
}

/** EXIF 'YYYY:MM:DD HH:MM:SS' (카메라 벽시계, 시간대 없음) → 'YYYY-MM-DD'. 달력 값이므로 시간대 변환하지 않는다 */
export function exifDateToYmd(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const m = /^(\d{4})[:-](\d{2})[:-](\d{2})/.exec(value.trim());
  if (!m || m[1] === '0000') return undefined;
  return `${m[1]}-${m[2]}-${m[3]}`;
}
