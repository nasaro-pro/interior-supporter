// D-24 업로드 전 미리보기 — 고른 파일을 blob URL 로 바로 보여 주고, 사라지면 URL 을 해제한다
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalThumb } from './LocalThumb';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('D-24 LocalThumb', () => {
  it('파일이 있으면 blob URL 이미지, 없어지면 URL 해제', () => {
    const create = vi.fn(() => 'blob:local/1');
    const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'a.jpg', { type: 'image/jpeg' });
    const { unmount } = render(<LocalThumb file={file} alt="a.jpg 미리보기" />);
    const img = screen.getByAltText('a.jpg 미리보기') as HTMLImageElement;
    expect(img.src).toBe('blob:local/1');
    expect(create).toHaveBeenCalledWith(file);
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:local/1');
  });

  it('파일이 없으면 빈 자리만 (이미지 없음)', () => {
    render(<LocalThumb file={undefined} alt="x" />);
    expect(screen.queryByRole('img')).toBeNull();
  });
});
