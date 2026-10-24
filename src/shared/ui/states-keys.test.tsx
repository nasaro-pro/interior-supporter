// 상태 6종 루트의 표준 data-ui-key (e2e 가 문구 대신 이 키로 판정)
import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ConflictState,
  EmptyState,
  ErrorState,
  FilterEmptyState,
  ForbiddenState,
  NotFoundState,
} from './states';
import { renderIntl } from './test-intl';

afterEach(cleanup);

describe('states data-ui-key', () => {
  it.each([
    ['state-empty', <EmptyState key="e" title="없음" />, 'status'],
    ['state-filter-empty', <FilterEmptyState key="f" />, 'status'],
    ['state-error', <ErrorState key="x" />, 'alert'],
    ['state-forbidden', <ForbiddenState key="fb" />, 'alert'],
    ['state-not-found', <NotFoundState key="nf" />, 'alert'],
    ['state-conflict', <ConflictState key="c" />, 'alert'],
  ])('%s', (key, node, role) => {
    renderIntl(node);
    const el = document.querySelector(`[data-ui-key="${key}"]`);
    expect(el).not.toBeNull();
    expect(el).toHaveAttribute('role', role);
  });
});
