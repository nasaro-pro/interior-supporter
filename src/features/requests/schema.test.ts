import { describe, expect, it } from 'vitest';
import { requestCreateSchema, requestEntrySchema, requestStatusSchema } from './schema';

const id = '3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f';
const projectId = '7a9b8c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

describe('requestCreateSchema (REQ-201)', () => {
  it('정상 입력은 앞뒤 공백을 지우고 통과한다', () => {
    const r = requestCreateSchema.safeParse({
      id,
      projectId,
      title: '  욕실 타일 ',
      body: '색 변경',
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.title).toBe('욕실 타일');
  });
  it('제목 0자·공백만·121자는 거절한다', () => {
    for (const title of ['', '   ', 'a'.repeat(121)]) {
      expect(requestCreateSchema.safeParse({ id, projectId, title, body: 'x' }).success).toBe(
        false,
      );
    }
  });
  it('원문 4001자는 field.tooLong 으로 거절한다', () => {
    const r = requestCreateSchema.safeParse({ id, projectId, title: 't', body: 'a'.repeat(4001) });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('field.tooLong');
  });
  it('id 가 uuid 형식이 아니면 거절한다', () => {
    expect(
      requestCreateSchema.safeParse({ id: 'x', projectId, title: 't', body: 'b' }).success,
    ).toBe(false);
  });
});

describe('requestEntrySchema', () => {
  it('빈 정정은 field.required', () => {
    const r = requestEntrySchema.safeParse({ id, projectId, requestId: id, body: ' ' });
    expect(r.error?.issues[0]?.message).toBe('field.required');
  });
});

describe('requestStatusSchema (ST-200)', () => {
  const base = { projectId, requestId: id, baseVersion: 1 };
  it('허용 전환은 통과한다', () => {
    expect(
      requestStatusSchema.safeParse({ ...base, from: 'open', to: 'in_progress' }).success,
    ).toBe(true);
    expect(
      requestStatusSchema.safeParse({ ...base, from: 'resolved', to: 'in_progress' }).success,
    ).toBe(true);
  });
  it('resolved → open, open → open 은 거절한다', () => {
    expect(requestStatusSchema.safeParse({ ...base, from: 'resolved', to: 'open' }).success).toBe(
      false,
    );
    expect(requestStatusSchema.safeParse({ ...base, from: 'open', to: 'open' }).success).toBe(
      false,
    );
  });
});
