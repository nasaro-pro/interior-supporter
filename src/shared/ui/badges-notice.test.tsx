// P3 UI 표준 — ToneBadge 7톤 · StatusBadge(ToneBadge 기반) · Notice
import { render, screen } from '@testing-library/react';
import { CircleDot } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { TONES, TONE_CLASS, ToneBadge } from './tone-badge';
import { StatusBadge } from './status-badge';
import { Notice } from './notice';

describe('ToneBadge', () => {
  it('7톤 모두 토큰 클래스만 쓴다 (hex·기본 팔레트 없음)', () => {
    expect(TONES).toHaveLength(7);
    for (const tone of TONES) {
      expect(TONE_CLASS[tone]).toBe(`bg-tone-${tone}-bg text-tone-${tone}-fg`);
    }
  });
  it('라벨과 장식 아이콘(aria-hidden), data-tone 을 그린다', () => {
    const { container } = render(
      <ToneBadge tone="info" icon={CircleDot}>
        접수
      </ToneBadge>,
    );
    const el = screen.getByText('접수');
    expect(el).toHaveAttribute('data-tone', 'info');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(el.className).not.toMatch(/#|gray|slate|teal|rounded-none/);
  });
  it('StatusBadge 는 02 문서 7.2 매핑을 ToneBadge 로 그린다', () => {
    render(<StatusBadge status="needs_reconfirm" label="재확인 필요" />);
    const el = screen.getByText('재확인 필요');
    expect(el).toHaveAttribute('data-tone', 'attention');
    expect(el).toHaveAttribute('data-status', 'needs_reconfirm');
  });
});

describe('Notice', () => {
  it('톤 기본 아이콘 + 제목·본문, role 을 그대로 쓴다', () => {
    const { container } = render(
      <Notice tone="caution" title="보관됨" role="status">
        복원하기 전까지 보이지 않습니다.
      </Notice>,
    );
    const box = screen.getByRole('status');
    expect(box).toHaveAttribute('data-tone', 'caution');
    expect(box.className).toMatch(/bg-tone-caution-bg/);
    expect(screen.getByText('보관됨')).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
  it('icon={null} 이면 아이콘 없음', () => {
    const { container } = render(<Notice icon={null}>안내</Notice>);
    expect(container.querySelector('svg')).toBeNull();
  });
});
