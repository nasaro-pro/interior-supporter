// GET /api/files/[fileId] — 권한 재검사 후 단기 서명 URL 로 302 (03 문서 3.3, routes.file)
import type { NextRequest } from 'next/server';
import { respondWithFile } from '@/features/files/server/download';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  return respondWithFile(fileId, request.nextUrl.searchParams.get('download') === '1');
}
