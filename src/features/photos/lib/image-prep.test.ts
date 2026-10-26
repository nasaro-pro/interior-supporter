import { describe, expect, it, vi } from 'vitest';
import {
  MAX_EDGE,
  needsConversion,
  planImagePrep,
  prepareImage,
  type DrawDeps,
} from './image-prep';

describe('needsConversion (F3)', () => {
  it('GIF·BMP 는 변환, JPEG·PNG·WEBP 는 그대로', () => {
    expect(needsConversion({ name: 'a.GIF', type: '' })).toBe(true);
    expect(needsConversion({ name: 'a', type: 'image/bmp' })).toBe(true);
    expect(needsConversion({ name: 'a.jpg', type: 'image/jpeg' })).toBe(false);
  });
});

describe('planImagePrep (F3·F4)', () => {
  it('작은 JPEG 는 다시 그리지 않는다', () => {
    expect(
      planImagePrep({ name: 'a.jpg', type: 'image/jpeg' }, { width: 3000, height: 2000 }),
    ).toMatchObject({ redraw: false, name: 'a.jpg', type: 'image/jpeg' });
  });
  it('긴 변 4000px 로 비율 유지 축소, 형식 유지', () => {
    expect(
      planImagePrep({ name: 'a.png', type: 'image/png' }, { width: 2000, height: 8000 }),
    ).toEqual({ redraw: true, width: 1000, height: MAX_EDGE, type: 'image/png', name: 'a.png' });
  });
  it('GIF 는 크기와 상관없이 JPEG 로, 이름도 .jpg', () => {
    expect(
      planImagePrep({ name: 'site.photo.gif', type: 'image/gif' }, { width: 10, height: 10 }),
    ).toMatchObject({ redraw: true, type: 'image/jpeg', name: 'site.photo.jpg' });
  });
});

function fakeDeps(size: { width: number; height: number }, fail?: 'decode' | 'draw'): DrawDeps {
  return {
    decode: vi.fn(async () => {
      if (fail === 'decode') throw new Error('bad');
      return { ...size, close: vi.fn() } as never;
    }),
    draw: vi.fn(async (_i, _w, _h, type) => {
      if (fail === 'draw') throw new Error('bad');
      return new Blob(['x'], { type });
    }),
  };
}

describe('prepareImage', () => {
  it('필요 없으면 같은 File 을 돌려준다', async () => {
    const f = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    const deps = fakeDeps({ width: 100, height: 100 });
    expect(await prepareImage(f, deps)).toEqual({ ok: true, file: f });
    expect(deps.draw).not.toHaveBeenCalled();
  });
  it('BMP → JPEG File', async () => {
    const f = new File(['x'], 'a.bmp', { type: 'image/bmp' });
    const res = await prepareImage(f, fakeDeps({ width: 100, height: 100 }));
    expect(res.ok && res.file.name).toBe('a.jpg');
    expect(res.ok && res.file.type).toBe('image/jpeg');
  });
  it('디코딩·그리기 실패는 corrupt', async () => {
    const f = new File(['x'], 'a.gif', { type: 'image/gif' });
    expect(await prepareImage(f, fakeDeps({ width: 1, height: 1 }, 'decode'))).toEqual({
      ok: false,
      reason: 'corrupt',
    });
    expect(await prepareImage(f, fakeDeps({ width: 1, height: 1 }, 'draw'))).toEqual({
      ok: false,
      reason: 'corrupt',
    });
  });
});
