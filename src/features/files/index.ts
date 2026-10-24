// 공통 파일 어댑터 공개 API (B 제공 — A·C 는 이 파일만 import) · 계약: integration.ts 5장
// 서버 코드(server/download.ts)는 Route Handler 만 직접 사용한다.
export { createUploadIntent, finalizeUpload } from '@/features/files/server/actions';
export { FileDropzone } from '@/features/files/components/FileDropzone';
export { UploadQueue, type UploadedFile } from '@/features/files/components/UploadQueue';
export { UploadField } from '@/features/files/components/UploadField';
export { FileDownloadLink } from '@/features/files/components/FileDownloadLink';
export {
  precheckFile,
  uploadFile,
  type PrecheckIssue,
  type UploadOutcome,
  type UploadPhase,
  type UploadTarget,
} from '@/features/files/lib/upload';
export { extOf, sizeParts, type UploadKind } from '@/features/files/lib/rules';
