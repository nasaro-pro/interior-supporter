// @vitest-environment node
// B-02 finalize 재시도·동시 실행, B-16 로고 역할 허용목록
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSupabaseFake,
  type FakeCall,
  type FakeResult,
} from '@/features/files/testing/supabase-fake';

vi.mock('@/features/core', () => ({
  getAccessContext: vi.fn(),
  requireProjectAccess: vi.fn(),
}));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('@/shared/lib/supabase/admin', () => ({ createAdminSupabase: vi.fn() }));
vi.mock('@/features/files/server/process', () => ({ inspectAndNormalize: vi.fn() }));
vi.mock('@/shared/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  newRef: () => 'ref1234567',
}));

import { getAccessContext } from '@/features/core';
import { createAdminSupabase } from '@/shared/lib/supabase/admin';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { inspectAndNormalize } from '@/features/files/server/process';
import { createUploadIntent, finalizeUpload } from './actions';

const fileId = '00000000-0000-4000-8000-0000000000f1';
const companyId = '00000000-0000-4000-8000-0000000000c1';
const projectId = '00000000-0000-4000-8000-0000000000b1';

type Row = Record<string, unknown> & { id: string; status: string; finalized_at: string | null };

/** files 테이블을 메모리로 흉내 — update 의 eq/or/is 조건을 실제로 적용해 동시성 의미를 재현한다 */
function filesTable(initial: Row) {
  const rows: Row[] = [{ ...initial }];
  let failReadyOnce = false;
  const matches = (row: Row, call: FakeCall) =>
    call.ops.every(({ op, args }) => {
      if (op === 'eq') return row[args[0] as string] === args[1];
      if (op === 'is') return row[args[0] as string] === args[1];
      if (op === 'or') {
        // 'finalized_at.is.null,finalized_at.lt."<iso>"'
        const m = /finalized_at\.lt\."([^"]+)"/.exec(args[0] as string);
        return row.finalized_at === null || (!!m && String(row.finalized_at) < m[1]!);
      }
      return true;
    });
  const handler = (call: FakeCall): FakeResult => {
    const insert = call.ops.find((o) => o.op === 'insert');
    if (insert) {
      rows.push({ created_at: new Date().toISOString(), ...(insert.args[0] as Row) });
      return { error: null };
    }
    const update = call.ops.find((o) => o.op === 'update');
    if (update) {
      const patch = update.args[0] as Partial<Row>;
      if (patch.status === 'ready' && failReadyOnce) {
        failReadyOnce = false;
        return { error: { code: '08006', message: 'connection lost' } };
      }
      const hit = rows.filter((r) => matches(r, call));
      for (const r of hit) {
        // DB: 20261013000120 — pending 을 벗어난 status 는 바뀌지 않는다
        if (r.status !== 'pending' && patch.status && patch.status !== r.status)
          return { error: { code: 'P0001', message: 'immutable_column:status' } };
        Object.assign(r, patch);
      }
      return { data: hit.map((r) => ({ id: r.id })), error: null };
    }
    const hit = rows.filter((r) => matches(r, call));
    const single = call.ops.some((o) => o.op === 'maybeSingle');
    if (single) return { data: hit[0] ? { ...hit[0] } : null };
    return { data: hit.map((r) => ({ ...r })) };
  };
  return {
    rows,
    handler,
    failReadyOnce: () => {
      failReadyOnce = true;
    },
    thumbs: () => rows.filter((r) => r.kind === 'photo_thumb'),
  };
}

const pendingPhoto: Row = {
  id: fileId,
  company_id: companyId,
  project_id: projectId,
  kind: 'photo_original',
  bucket: 'project-files',
  path: `${companyId}/${projectId}/photo_original/${fileId}.jpg`,
  original_name: '현장.jpg',
  status: 'pending',
  reject_reason: null,
  width: null,
  height: null,
  uploaded_by: 'u1',
  finalized_at: null,
  derived_from: null,
};

const readyImage = {
  status: 'ready' as const,
  bytes: Buffer.from('normalized'),
  mime: 'image/jpeg',
  reencoded: true,
  width: 800,
  height: 600,
  capturedOn: '2026-10-01',
  thumb: { bytes: Buffer.from('thumb'), width: 320, height: 240 },
};

function setup(initial: Row = pendingPhoto) {
  const table = filesTable(initial);
  const user = createSupabaseFake({ files: table.handler });
  const admin = createSupabaseFake({ files: table.handler });
  admin.storageApi.download.mockResolvedValue({
    data: new Blob([Buffer.from('original')]),
    error: null,
  });
  vi.mocked(createServerSupabase).mockResolvedValue(user.client as never);
  vi.mocked(createAdminSupabase).mockReturnValue(admin.client as never);
  return { table, user, admin };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccessContext).mockResolvedValue({
    userId: 'u1',
    displayName: 'PM',
    locale: 'ko',
    memberships: [],
    participations: [],
    areas: ['app'],
  } as never);
  vi.mocked(inspectAndNormalize).mockResolvedValue(readyImage);
});

describe('finalizeUpload (B-02)', () => {
  it('정상: ready + 썸네일 1개, 선점 센티널은 처리 완료 시각으로 남는다', async () => {
    const { table, admin } = setup();
    const res = await finalizeUpload(fileId);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toMatchObject({
      fileId,
      status: 'ready',
      width: 800,
      capturedOn: '2026-10-01',
    });
    expect(table.thumbs()).toHaveLength(1);
    expect(res.data.thumbFileId).toBe(table.thumbs()[0]!.id);
    expect(table.rows[0]!.status).toBe('ready');
    expect(table.rows[0]!.finalized_at).not.toBeNull();
    expect(admin.storageApi.remove).not.toHaveBeenCalled();
  });

  it('ready 갱신 1회 실패 → 선점 해제 → 재시도는 같은 썸네일을 재사용 (썸네일 1개)', async () => {
    const { table, admin } = setup();
    table.failReadyOnce();
    const first = await finalizeUpload(fileId);
    expect(first).toMatchObject({ ok: false, error: { code: 'INTERNAL' } });
    expect(table.rows[0]!.status).toBe('pending');
    expect(table.rows[0]!.finalized_at).toBeNull(); // 다시 시도할 수 있다
    expect(table.thumbs()).toHaveLength(1);
    const firstThumb = table.thumbs()[0]!.id;

    const second = await finalizeUpload(fileId);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(table.thumbs()).toHaveLength(1);
    expect(second.data.thumbFileId).toBe(firstThumb);
    // 썸네일 객체 업로드는 첫 시도 1번뿐 (원본 덮어쓰기 2번 + 썸네일 1번)
    const thumbUploads = admin.storageApi.upload.mock.calls.filter(([p]) =>
      String(p).includes('photo_thumb'),
    );
    expect(thumbUploads).toHaveLength(1);

    // 세 번째 호출(이미 ready)은 저장된 결과
    const third = await finalizeUpload(fileId);
    expect(third).toMatchObject({ ok: true, data: { status: 'ready', thumbFileId: firstThumb } });
    expect(inspectAndNormalize).toHaveBeenCalledTimes(2);
  });

  it('동시 2회 호출: 한 번만 처리하고, 다른 호출은 처리 중(FILE_NOT_READY) 또는 저장된 결과', async () => {
    const { table } = setup();
    const [a, b] = await Promise.all([finalizeUpload(fileId), finalizeUpload(fileId)]);
    expect(inspectAndNormalize).toHaveBeenCalledTimes(1);
    expect(table.thumbs()).toHaveLength(1);
    const results = [a, b];
    expect(results.filter((r) => r.ok && r.data.status === 'ready').length).toBeGreaterThanOrEqual(
      1,
    );
    for (const r of results) {
      if (!r.ok) expect(r.error.code).toBe('FILE_NOT_READY');
    }
    expect(table.rows[0]!.status).toBe('ready');
  });

  it('다른 요청이 처리 중(신선한 선점)이면 FILE_NOT_READY, 오래된 선점은 다시 가져간다', async () => {
    const fresh = setup({ ...pendingPhoto, finalized_at: new Date().toISOString() });
    expect(await finalizeUpload(fileId)).toMatchObject({
      ok: false,
      error: { code: 'FILE_NOT_READY' },
    });
    expect(inspectAndNormalize).not.toHaveBeenCalled();
    expect(fresh.table.rows[0]!.status).toBe('pending');

    const stale = setup({ ...pendingPhoto, finalized_at: '2020-01-01T00:00:00.000Z' });
    expect((await finalizeUpload(fileId)).ok).toBe(true);
    expect(stale.table.rows[0]!.status).toBe('ready');
  });

  it('썸네일 행 저장 실패 시 방금 올린 썸네일 객체를 지우고 선점을 푼다', async () => {
    const { table } = setup();
    const failing = (call: FakeCall) =>
      call.ops.some((o) => o.op === 'insert')
        ? { error: { code: '23505', message: 'dup' } }
        : table.handler(call);
    const adminFake = createSupabaseFake({ files: failing });
    adminFake.storageApi.download.mockResolvedValue({
      data: new Blob([Buffer.from('original')]),
      error: null,
    });
    vi.mocked(createAdminSupabase).mockReturnValue(adminFake.client as never);
    const res = await finalizeUpload(fileId);
    expect(res).toMatchObject({ ok: false, error: { code: 'INTERNAL' } });
    const thumbPath = adminFake.storageApi.upload.mock.calls.find(([p]) =>
      String(p).includes('photo_thumb'),
    )?.[0];
    expect(thumbPath).toBeTruthy();
    expect(adminFake.storageApi.remove).toHaveBeenCalledWith([thumbPath]);
    expect(table.rows[0]!.finalized_at).toBeNull();
    expect(table.rows[0]!.status).toBe('pending');
  });

  it('객체가 아직 없으면 FILE_NOT_READY 이고 선점을 푼다', async () => {
    const { table, admin } = setup();
    admin.storageApi.download.mockResolvedValue({ data: null, error: { message: 'not found' } });
    expect(await finalizeUpload(fileId)).toMatchObject({
      ok: false,
      error: { code: 'FILE_NOT_READY' },
    });
    expect(table.rows[0]!.finalized_at).toBeNull();
  });

  it('위장 파일은 rejected 로 저장, 재호출은 저장된 결과 (status 를 다시 바꾸지 않는다)', async () => {
    const { table } = setup({ ...pendingPhoto, kind: 'design_original' });
    vi.mocked(inspectAndNormalize).mockResolvedValue({ status: 'rejected', reason: 'type' });
    expect(await finalizeUpload(fileId)).toMatchObject({
      ok: true,
      data: { status: 'rejected', rejectReason: 'type' },
    });
    expect(await finalizeUpload(fileId)).toMatchObject({
      ok: true,
      data: { status: 'rejected', rejectReason: 'type' },
    });
    expect(inspectAndNormalize).toHaveBeenCalledTimes(1);
    expect(table.rows[0]!.status).toBe('rejected');
  });

  it('권한: 남이 올린 파일·보이지 않는 파일·썸네일 직접 finalize 는 NOT_FOUND, 잘못된 id 는 VALIDATION_FAILED', async () => {
    setup({ ...pendingPhoto, uploaded_by: 'someone-else' });
    expect(await finalizeUpload(fileId)).toMatchObject({ error: { code: 'NOT_FOUND' } });
    setup({ ...pendingPhoto, kind: 'photo_thumb' });
    expect(await finalizeUpload(fileId)).toMatchObject({ error: { code: 'NOT_FOUND' } });
    setup({ ...pendingPhoto, id: 'other' });
    expect(await finalizeUpload(fileId)).toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect(await finalizeUpload('nope')).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
    expect(inspectAndNormalize).not.toHaveBeenCalled();
  });
});

describe('createUploadIntent company_logo (B-16)', () => {
  const logoInput = {
    kind: 'company_logo' as const,
    projectId: null,
    companyId,
    fileName: 'logo.png',
    sizeBytes: 1000,
    mime: 'image/png',
  };
  const withRole = (role: string) =>
    vi.mocked(getAccessContext).mockResolvedValue({
      userId: 'u1',
      displayName: 'X',
      locale: 'ko',
      memberships: [{ companyId, slug: 's', name: 'S', role }],
      participations: [],
      areas: ['app'],
    } as never);

  it('owner·manager 만 허용, pm·알 수 없는 역할·비구성원은 FORBIDDEN', async () => {
    for (const role of ['pm', 'viewer', 'unknown']) {
      withRole(role);
      expect(await createUploadIntent(logoInput)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    }
    vi.mocked(getAccessContext).mockResolvedValue({
      userId: 'u1',
      displayName: 'X',
      locale: 'ko',
      memberships: [],
      participations: [],
      areas: [],
    } as never);
    expect(await createUploadIntent(logoInput)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(createServerSupabase).not.toHaveBeenCalled();
  });

  it('manager 는 통과해 pending 행을 만든다', async () => {
    withRole('manager');
    const user = createSupabaseFake({ files: [{ error: null }] });
    const admin = createSupabaseFake({});
    (admin.storageApi as Record<string, unknown>).createSignedUploadUrl = vi.fn(async () => ({
      data: { token: 'tok' },
      error: null,
    }));
    vi.mocked(createServerSupabase).mockResolvedValue(user.client as never);
    vi.mocked(createAdminSupabase).mockReturnValue(admin.client as never);
    const res = await createUploadIntent(logoInput);
    expect(res).toMatchObject({ ok: true, data: { token: 'tok' } });
    expect(user.argOf('files', 'insert')?.[0]).toMatchObject({
      status: 'pending',
      kind: 'company_logo',
    });
  });
});
