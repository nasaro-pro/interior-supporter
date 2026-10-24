// src/app/api/health/route.ts (A · TASK-011, IF-health) — Render 헬스 체크. DB 조회 없음
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ ok: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
