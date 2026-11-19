// 담당자의 고객 화면 미리보기 — DB 로 보내는 미리보기 헤더를 언제 붙이는가
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn() }));

import { customerPreviewTarget } from '@/shared/lib/supabase/server';

const P = '00000000-0000-4000-8000-0000000000b1';

describe('customerPreviewTarget', () => {
  it('정상: 쿠키의 프로젝트와 같은 고객 화면 페이지 렌더 → 프로젝트 id', () => {
    expect(customerPreviewTarget(P, `/portal/projects/${P}/designs`, false)).toBe(P);
    expect(customerPreviewTarget(P, `/portal/projects/${P}/designs?space=all`, false)).toBe(P);
    expect(customerPreviewTarget(P, `/portal/projects/${P}`, false)).toBe(P);
  });

  it('Server Action 요청이면 붙이지 않는다 (미리보기는 읽기 전용)', () => {
    expect(customerPreviewTarget(P, `/portal/projects/${P}/designs`, true)).toBeNull();
  });

  it('담당자 화면 · 다른 프로젝트 · 파일 경로에서는 붙이지 않는다', () => {
    expect(customerPreviewTarget(P, `/app/studio/projects/${P}/designs`, false)).toBeNull();
    expect(
      customerPreviewTarget(P, '/portal/projects/00000000-0000-4000-8000-0000000000b2/home', false),
    ).toBeNull();
    expect(customerPreviewTarget(P, `/portal/projects/${P}x/home`, false)).toBeNull();
    expect(customerPreviewTarget(P, '/api/files/abc', false)).toBeNull();
  });

  it('쿠키가 없거나 형식이 틀리면 붙이지 않는다', () => {
    expect(customerPreviewTarget(undefined, `/portal/projects/${P}/home`, false)).toBeNull();
    expect(customerPreviewTarget('nope', '/portal/projects/nope/home', false)).toBeNull();
    expect(customerPreviewTarget(P, null, false)).toBeNull();
  });
});

vi.mock('@/features/core/server/access', () => ({ findProjectAccess: vi.fn() }));

describe('previewStartPath — 미리보기 시작 뒤 갈 곳 (개요 미리보기 안 링크 B1)', async () => {
  const { previewStartPath } = await import('@/features/core/server/customer-preview');
  const home = `/portal/projects/${P}/home`;

  it('값이 없으면 고객 홈', () => {
    expect(previewStartPath(P, null)).toBe(home);
    expect(previewStartPath(P, '')).toBe(home);
  });

  it('같은 프로젝트의 고객 화면 경로는 그대로 (목록 · 상세)', () => {
    expect(previewStartPath(P, `/portal/projects/${P}/designs`)).toBe(
      `/portal/projects/${P}/designs`,
    );
    expect(previewStartPath(P, `/portal/projects/${P}/photos/${P}`)).toBe(
      `/portal/projects/${P}/photos/${P}`,
    );
    expect(previewStartPath(P, `/portal/projects/${P}/schedule`)).toBe(
      `/portal/projects/${P}/schedule`,
    );
  });

  it('다른 프로젝트 · 바깥 주소 · 경로 탈출 · 쿼리는 고객 홈으로', () => {
    const other = '00000000-0000-4000-8000-0000000000b2';
    for (const to of [
      `/portal/projects/${other}/designs`,
      'https://evil.example/portal',
      '//evil.example',
      `/portal/projects/${P}/../${other}/designs`,
      `/portal/projects/${P}//evil.example`,
      `/portal/projects/${P}/designs?x=1`,
      `/portal/projects/${P}/designs#a`,
      `/portal/projects/${P}/`,
      `/portal/projects/${P}\designs`,
      `/app/studio-x/projects/${P}/overview`,
    ])
      expect(previewStartPath(P, to), to).toBe(home);
  });
});
