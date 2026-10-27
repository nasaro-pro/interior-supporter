// REQ-052 기본 템플릿 확장 (CR-A-10) — 스키마·테마 보정·updateTemplate 권한 이중 검증 (정상·예외·권한 거부)
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callOf, createFakeSupabase, type Responder } from './testing/fake-supabase';
import { X, accessResponder, authOf, chain, type Who } from './testing/access-fixture';
import { DEFAULT_HOME_SECTIONS } from './home-sections';
import { normalizeHomeTheme } from './home-theme';
import { normalizePageImages, normalizePageTone } from './page-theme';
import { templateUpdateSchema } from './schema';

const h = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: async () => h.client }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { updateTemplate } from './server/company-actions';

const COVER = '00000000-0000-4000-8000-0000000000e1';
const input = (over: Record<string, unknown> = {}) => ({
  companyId: X,
  baseVersion: 3,
  defaultHomeMessage: '안내',
  defaultHomeSections: DEFAULT_HOME_SECTIONS,
  defaultHomeTheme: 'info',
  defaultPageImages: { home: COVER, photos: COVER },
  defaultPageTone: 'sage',
  ...over,
});

function setup(who: Who, result: { data?: unknown; error?: { code: string; message?: string } }) {
  const responder: Responder = (q) =>
    q.table === 'company_settings' && q.calls.some(([m]) => m === 'update') ? result : undefined;
  const fake = createFakeSupabase(chain(responder, accessResponder(who)), authOf(who));
  h.client = fake.client;
  return fake;
}
const updates = (fake: ReturnType<typeof createFakeSupabase>) =>
  fake.of('company_settings').filter((q) => q.calls.some(([m]) => m === 'update'));

const OWNER: Who = { members: [{ company_id: X, slug: 'x-co', role: 'owner' }] };
const PM: Who = { members: [{ company_id: X, slug: 'x-co', role: 'pm' }] };

beforeEach(() => vi.clearAllMocks());

describe('REQ-052 templateUpdateSchema', () => {
  it('정상: 안내문·4영역·테마·페이지 이미지(빈 값 포함)·분위기를 받는다', () => {
    expect(templateUpdateSchema.safeParse(input()).success).toBe(true);
    expect(templateUpdateSchema.safeParse(input({ defaultPageImages: {} })).success).toBe(true);
  });
  it('예외: 토큰 밖 테마·4영역 순열이 아닌 값·잘못된 파일 id 는 거절', () => {
    expect(templateUpdateSchema.safeParse(input({ defaultHomeTheme: '#ff00ff' })).success).toBe(
      false,
    );
    const dup = [...DEFAULT_HOME_SECTIONS.slice(0, 3), { key: 'overview', visible: true }];
    expect(templateUpdateSchema.safeParse(input({ defaultHomeSections: dup })).success).toBe(false);
    expect(
      templateUpdateSchema.safeParse(input({ defaultHomeSections: DEFAULT_HOME_SECTIONS.slice(1) }))
        .success,
    ).toBe(false);
    expect(
      templateUpdateSchema.safeParse(input({ defaultPageImages: { home: 'x' } })).success,
    ).toBe(false);
  });
  it('예외: 고객 포털 탭이 아닌 키·프리셋 밖 분위기는 거절', () => {
    expect(
      templateUpdateSchema.safeParse(input({ defaultPageImages: { overview: COVER } })).success,
    ).toBe(false);
    expect(templateUpdateSchema.safeParse(input({ defaultPageTone: '#ffeedd' })).success).toBe(
      false,
    );
  });
});

describe('REQ-052 normalizePageImages · normalizePageTone', () => {
  it('정상: 탭 키의 문자열 값만 남긴다, 예외: 잘못된 jsonb 는 빈 값', () => {
    expect(normalizePageImages({ home: COVER, overview: COVER, photos: 3 })).toEqual({
      home: COVER,
    });
    expect(normalizePageImages(null)).toEqual({});
    expect(normalizePageImages([COVER])).toEqual({});
  });
  it('정상: 프리셋 값은 그대로, 예외: 그 밖은 default', () => {
    expect(normalizePageTone('sand')).toBe('sand');
    expect(normalizePageTone('hotpink')).toBe('default');
  });
});

describe('REQ-052 normalizeHomeTheme', () => {
  it('정상: 목록 안의 값은 그대로, 예외: 그 밖은 brand', () => {
    expect(normalizeHomeTheme('caution')).toBe('caution');
    expect(normalizeHomeTheme('hotpink')).toBe('brand');
    expect(normalizeHomeTheme(null)).toBe('brand');
  });
});

describe('REQ-052 updateTemplate', () => {
  it('정상: owner 는 템플릿 전체를 version 잠금으로 저장한다', async () => {
    const fake = setup(OWNER, { data: { version: 4 } });
    expect(await updateTemplate(input())).toEqual({ ok: true, data: { version: 4 } });
    const [q] = updates(fake);
    expect(callOf(q!, 'update')?.[1]).toEqual({
      default_home_message: '안내',
      default_home_sections: DEFAULT_HOME_SECTIONS,
      default_home_theme: 'info',
      default_page_images: { home: COVER, photos: COVER },
      default_page_tone: 'sage',
    });
    expect(q!.calls).toContainEqual(['eq', 'version', 3]);
  });
  it('예외: 다른 사람이 먼저 저장했으면 VERSION_CONFLICT', async () => {
    setup(OWNER, { data: null });
    expect(await updateTemplate(input())).toMatchObject({
      ok: false,
      error: { code: 'VERSION_CONFLICT' },
    });
  });
  it('예외: 다른 업체 파일 등 트리거 거절은 FILE_TYPE_REJECTED', async () => {
    setup(OWNER, { error: { code: 'P0001', message: 'file_kind_mismatch' } });
    expect(await updateTemplate(input())).toMatchObject({
      ok: false,
      error: { code: 'FILE_TYPE_REJECTED' },
    });
  });
  it('권한 거부: pm 은 FORBIDDEN, DB 수정 시도 없음 (POL-030)', async () => {
    const fake = setup(PM, { data: { version: 4 } });
    expect(await updateTemplate(input())).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(updates(fake)).toHaveLength(0);
  });
  it('권한 거부: 소속이 아닌 업체는 NOT_FOUND', async () => {
    setup({ members: [] }, { data: { version: 4 } });
    expect(await updateTemplate(input())).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
  });
});
