import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NoDrag } from './no-drag';

afterEach(cleanup);

function dragFrom(el: Element) {
  const e = new Event('dragstart', { bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  return e.defaultPrevented;
}

describe('NoDrag', () => {
  it('이미지·링크·글자 끌기를 막는다', () => {
    const { container } = render(
      <div>
        <NoDrag />
        {/* eslint-disable-next-line @next/next/no-img-element -- 끌기 막기 확인용 일반 이미지 */}
        <img alt="" src="data:," />
        <a href="/x">링크</a>
        <p>글자</p>
      </div>,
    );
    expect(dragFrom(container.querySelector('img')!)).toBe(true);
    expect(dragFrom(container.querySelector('a')!)).toBe(true);
    expect(dragFrom(container.querySelector('p')!)).toBe(true);
  });

  it('입력칸 · 글 쓰는 칸 · data-allow-drag 안은 막지 않는다', () => {
    const { container } = render(
      <div>
        <NoDrag />
        <input defaultValue="a" />
        <textarea defaultValue="b" />
        <div data-allow-drag>
          <span>정렬 손잡이</span>
        </div>
      </div>,
    );
    expect(dragFrom(container.querySelector('input')!)).toBe(false);
    expect(dragFrom(container.querySelector('textarea')!)).toBe(false);
    expect(dragFrom(container.querySelector('span')!)).toBe(false);
  });

  it('화면에서 빠지면 막기를 푼다', () => {
    const { container, unmount } = render(
      <div>
        <NoDrag />
      </div>,
    );
    const p = document.createElement('p');
    document.body.appendChild(p);
    unmount();
    expect(dragFrom(p)).toBe(false);
    p.remove();
    expect(container).toBeTruthy();
  });
});
