import { describe, expect, it } from 'vitest';
import { parsePhotoListParams, photoListHref } from './list-params';

describe('parsePhotoListParams (REQ-210)', () => {
  it('기본값', () => {
    expect(parsePhotoListParams({}, 'editor')).toEqual({
      phase: null,
      from: null,
      to: null,
      uploader: null,
      archived: false,
      size: 30,
    });
  });
  it('잘못된 공정·날짜·업로더는 무시한다', () => {
    const f = parsePhotoListParams(
      { phase: 'roof', from: '2026-13-01', to: 'x', uploader: 'abc' },
      'editor',
    );
    expect(f.phase).toBeNull();
    expect(f.from).toBeNull();
    expect(f.to).toBeNull();
    expect(f.uploader).toBeNull();
  });
  it('공정·촬영일 범위·업로더는 독립 필터', () => {
    const f = parsePhotoListParams(
      {
        phase: 'tile',
        from: '2026-10-01',
        to: '2026-10-07',
        uploader: '3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f',
      },
      'customer',
    );
    expect(f).toMatchObject({ phase: 'tile', from: '2026-10-01', to: '2026-10-07' });
    expect(f.uploader).toBe('3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f');
  });
  it('시작 > 끝이면 서로 바꾼다', () => {
    const f = parsePhotoListParams({ from: '2026-10-09', to: '2026-10-01' }, 'editor');
    expect([f.from, f.to]).toEqual(['2026-10-01', '2026-10-09']);
  });
  it('보관함은 편집자만', () => {
    expect(parsePhotoListParams({ archived: '1' }, 'field').archived).toBe(false);
    expect(parsePhotoListParams({ archived: '1' }, 'editor').archived).toBe(true);
  });
});

describe('photoListHref', () => {
  it('필터를 query 로 만들고 extra(시공팀 project) 를 유지한다', () => {
    const f = parsePhotoListParams({ phase: 'tile' }, 'field');
    expect(photoListHref('/field/photos', f, { size: 60 }, { project: 'p1' })).toBe(
      '/field/photos?project=p1&phase=tile&size=60',
    );
  });
});
