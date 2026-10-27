// 서명 URL 업로드 + 바이트 진행률 (통합본 7장 F5) — supabase-js uploadToSignedUrl 은 진행 이벤트가 없어 같은 요청을 XHR 로 보낸다.
// 요청 모양은 storage-js uploadToSignedUrl 과 같다: PUT {url}/storage/v1/object/upload/sign/{bucket}/{path}?token=…,
// FormData(cacheControl, 파일), x-upsert: false. 토큰이 권한이므로 세션 쿠키·서비스 키는 쓰지 않는다 (ADR-002 범위 안)

export type UploadOutcome = { ok: true } | { ok: false; alreadyExists: boolean };

/** 경로의 각 조각만 인코딩 ('/' 는 유지) */
export function signedUploadUrl(base: string, bucket: string, path: string, token: string): string {
  const clean = path.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  return `${base.replace(/\/+$/, '')}/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${clean}?token=${encodeURIComponent(token)}`;
}

/** 응답 → 결과. 409 또는 'already exists'·'Duplicate' 만 "이미 있음" (재시도 통과용, storage-error.ts 와 같은 기준) */
export function toUploadOutcome(status: number, body: string): UploadOutcome {
  if (status >= 200 && status < 300) return { ok: true };
  if (status === 409) return { ok: false, alreadyExists: true };
  let parsed: { statusCode?: unknown; error?: unknown; message?: unknown } = {};
  try {
    parsed = JSON.parse(body) as typeof parsed;
  } catch {
    // 본문이 JSON 이 아니면 상태 코드로만 판단
  }
  const dup =
    String(parsed.statusCode) === '409' ||
    [parsed.error, parsed.message].some(
      (v) => typeof v === 'string' && /\balready exists\b|^duplicate$/i.test(v.trim()),
    );
  return { ok: false, alreadyExists: dup };
}

export interface XhrLike {
  open(method: string, url: string): void;
  setRequestHeader(name: string, value: string): void;
  send(body: FormData): void;
  upload: {
    onprogress: ((e: { loaded: number; total: number; lengthComputable: boolean }) => void) | null;
  };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
  status: number;
  responseText: string;
}

/**
 * 진행률(0~1)을 알리며 업로드. 네트워크 오류는 예외로 던져 호출 쪽 재시도(F6)가 잡게 한다
 */
export function putWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (fraction: number) => void,
  makeXhr: () => XhrLike = () => new XMLHttpRequest() as unknown as XhrLike,
): Promise<UploadOutcome> {
  return new Promise((resolve, reject) => {
    const xhr = makeXhr();
    xhr.open('PUT', url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(Math.min(1, e.loaded / e.total));
    };
    xhr.onload = () => resolve(toUploadOutcome(xhr.status, xhr.responseText));
    xhr.onerror = () => reject(new Error('network'));
    xhr.onabort = () => reject(new Error('aborted'));
    const body = new FormData();
    body.append('cacheControl', '3600');
    body.append('', file);
    xhr.send(body);
  });
}
