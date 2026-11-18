// src/shared/lib/redirect.ts — Route Handler 에서 같은 사이트 안 경로로 보내는 응답
// new URL(path, request.url) 은 Render 같은 프록시 뒤에서 내부 주소(https://localhost:10000)가 되어
// 브라우저가 사용자 PC 의 localhost 로 가 버린다. Location 을 상대 경로로 두면 브라우저가 지금 주소 기준으로 이동한다.
import { NextResponse } from 'next/server';

export function redirectPath(path: string, status: 303 | 307 = 307): NextResponse {
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) {
    throw new Error('redirectPath: 사이트 안 경로만 보낼 수 있습니다');
  }
  return new NextResponse(null, { status, headers: { Location: path } });
}
