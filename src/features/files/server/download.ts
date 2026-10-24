// IF-file-download: 매번 RLS 재검사 + 60초 서명 URL (SEC-009, TC-903)
// B-01: 비로그인·잘못된 id·볼 수 없음·준비 전 파일은 모두 같은 404 + no-store (존재 여부를 드러내지 않는다).
//       getAccessContext() 는 비로그인 시 로그인 화면으로 307 리다이렉트하므로 여기서는 쓰지 않는다.
import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger, newRef } from '@/shared/lib/logger';
import { createAdminSupabase } from '@/shared/lib/supabase/admin';
import { createServerSupabase } from '@/shared/lib/supabase/server';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
export const SIGNED_URL_TTL_SECONDS = 60;

const notFound = () => new NextResponse(null, { status: 404, headers: NO_STORE });

export async function respondWithFile(fileId: string, download: boolean): Promise<NextResponse> {
  // 1) 형식 검사 먼저 (DB·인증 호출 없이 거절)
  if (!z.uuid().safeParse(fileId).success) return notFound();

  // 2) 로그인 사용자 확인 — 없으면 리다이렉트 대신 404
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return notFound();

  // 3) 사용자 클라이언트 조회 → RLS(can_view_file)가 소유 객체 열람 가능 여부를 판정한다
  const { data: file, error: selectError } = await supabase
    .from('files')
    .select('id, bucket, path, original_name, status')
    .eq('id', fileId)
    .maybeSingle();
  if (selectError) {
    logger.warn('file.download.select_failed', {
      ref: newRef(),
      objectId: fileId,
      userId,
      dbCode: selectError.code,
    });
    return notFound();
  }
  // 준비(ready) 전·거부 파일은 업로더 본인에게도 내려주지 않는다 (THR-006, DB-07)
  if (!file || file.status !== 'ready') return notFound();

  const admin = createAdminSupabase();
  const { data, error } = await admin.storage
    .from(file.bucket)
    .createSignedUrl(
      file.path,
      SIGNED_URL_TTL_SECONDS,
      download ? { download: file.original_name } : undefined,
    );
  if (error || !data) {
    const ref = newRef();
    logger.error('file.download.sign_failed', { ref, objectId: file.id, userId });
    return new NextResponse(null, { status: 500, headers: NO_STORE });
  }
  const res = NextResponse.redirect(data.signedUrl, 302);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
