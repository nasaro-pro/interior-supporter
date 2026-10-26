// 브라우저 업로드 흐름: 사전 검사 → createUploadIntent → uploadToSignedUrl → finalizeUpload (03 문서 3.3 ①~③)
import { createUploadIntent, finalizeUpload } from '@/features/files/server/actions';
import {
  checkNameAndSize,
  extOf,
  formatMatches,
  SNIFF_BYTES,
  sniffFormat,
  type UploadKind,
} from '@/features/files/lib/rules';
import type { ErrorCode } from '@/shared/contracts/errors';
import { FILE_RULES } from '@/shared/contracts/domain';
import type { FinalizedFile } from '@/shared/contracts/integration';
import { createBrowserSupabase } from '@/shared/lib/supabase/browser';

export interface UploadTarget {
  kind: UploadKind;
  projectId: string | null;
  companyId: string;
}

/** 브라우저 사전 검사 결과 (서버가 다시 검사한다 — 이중 검사, REQ-101) */
export type PrecheckIssue = 'type' | 'size' | 'heic' | 'renamed';

export type UploadPhase = 'checking' | 'uploading' | 'processing';

export type UploadOutcome =
  | { ok: true; file: FinalizedFile & { status: 'ready' } }
  | { ok: false; precheck: PrecheckIssue }
  | { ok: false; rejectReason: NonNullable<FinalizedFile['rejectReason']> }
  | { ok: false; code: ErrorCode; ref?: string }
  | { ok: false; interrupted: true };

export async function precheckFile(kind: UploadKind, file: File): Promise<PrecheckIssue | null> {
  const ext = extOf(file.name);
  // HEIC 를 받지 않는 종류(사진 등)만 안내 — 도안 원본은 HEIC 도 원본 그대로 보관한다 (D-20)
  if ((ext === '.heic' || ext === '.heif') && !FILE_RULES[kind].exts.includes(ext)) return 'heic';
  const basic = checkNameAndSize(kind, file.name, file.size);
  if (basic) return basic;
  const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
  return formatMatches(kind, file.name, sniffFormat(head)) ? null : 'renamed';
}

export async function uploadFile(
  file: File,
  target: UploadTarget,
  onPhase?: (phase: UploadPhase) => void,
): Promise<UploadOutcome> {
  onPhase?.('checking');
  const issue = await precheckFile(target.kind, file);
  if (issue) return { ok: false, precheck: issue };

  const intent = await createUploadIntent({
    kind: target.kind,
    projectId: target.projectId,
    companyId: target.companyId,
    fileName: file.name,
    sizeBytes: file.size,
    mime: file.type,
  });
  if (!intent.ok) return { ok: false, code: intent.error.code, ref: intent.error.ref };

  onPhase?.('uploading');
  const { error } = await createBrowserSupabase()
    .storage.from(intent.data.bucket)
    .uploadToSignedUrl(intent.data.path, intent.data.token, file, {
      contentType: file.type || 'application/octet-stream',
    });
  if (error) return { ok: false, interrupted: true };

  onPhase?.('processing');
  const fin = await finalizeUpload(intent.data.fileId);
  if (!fin.ok) return { ok: false, code: fin.error.code, ref: fin.error.ref };
  if (fin.data.status === 'rejected') {
    return { ok: false, rejectReason: fin.data.rejectReason ?? 'type' };
  }
  return { ok: true, file: { ...fin.data, status: 'ready' } };
}
