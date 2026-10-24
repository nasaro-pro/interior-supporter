// 02 문서 7.2 상태 배지 — 라벨+아이콘으로 의미 전달 (색만 쓰지 않음)
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('라벨 문구와 장식 아이콘(aria-hidden)을 함께 그린다', () => {
    const { container } = render(<StatusBadge status="needs_reconfirm" label="재확인 필요" />);
    expect(screen.getByText('재확인 필요')).toBeInTheDocument();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.firstElementChild?.getAttribute('data-status')).toBe('needs_reconfirm');
  });
  it('톤 클래스는 토큰 클래스만 쓴다 (hex·기본 팔레트 없음)', () => {
    const { container } = render(<StatusBadge status="public" label="공개" />);
    expect(container.firstElementChild?.className).toMatch(/bg-tone-brand-bg/);
    expect(container.firstElementChild?.className).not.toMatch(/#|teal|slate|gray/);
  });
});
