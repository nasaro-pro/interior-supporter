// 브라우저 PDF 처리 (pdfjs-dist 6) — 견적 미리보기·도안 PDF 페이지 → PNG (REQ-104, REQ-132)
// 서버에서 import 하지 않는다 (동적 import 로 클라이언트에서만 로드)
import { PDF_PREVIEW_MAX_EDGE } from '@/shared/contracts/domain';

type PdfJs = typeof import('pdfjs-dist');
let loader: Promise<PdfJs> | null = null;

export function loadPdfJs(): Promise<PdfJs> {
  loader ??= import('pdfjs-dist').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
    return pdfjs;
  });
  return loader;
}

export type PdfFailure = 'password' | 'page' | 'failed';
export class PdfError extends Error {
  constructor(readonly reason: PdfFailure) {
    super(reason);
  }
}

export async function openPdf(bytes: ArrayBuffer) {
  const pdfjs = await loadPdfJs();
  try {
    return await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  } catch (e) {
    if (e instanceof Error && e.name === 'PasswordException') throw new PdfError('password');
    throw new PdfError('failed');
  }
}

/** 긴 변이 maxEdge 가 되는 배율 (작은 페이지는 키우되 긴 변 2400px 고정) */
export function scaleForMaxEdge(width: number, height: number, maxEdge = PDF_PREVIEW_MAX_EDGE) {
  return maxEdge / Math.max(width, height);
}

/** PDF 1쪽 → PNG Blob (긴 변 2400px) */
export async function renderPdfPageToPng(bytes: ArrayBuffer, pageNo: number): Promise<Blob> {
  const doc = await openPdf(bytes);
  try {
    if (pageNo < 1 || pageNo > doc.numPages) throw new PdfError('page');
    const page = await doc.getPage(pageNo);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: scaleForMaxEdge(base.width, base.height) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new PdfError('failed');
    return blob;
  } finally {
    void doc.loadingTask.destroy();
  }
}

/** 파일 다운로드 라우트(권한 재검사)에서 바이트를 받는다 — 302 → 서명 URL */
export async function fetchFileBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new PdfError('failed');
  return res.arrayBuffer();
}
