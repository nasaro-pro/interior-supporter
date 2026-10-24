// src/shared/ui/test-intl.tsx (A) — 컴포넌트 테스트용 next-intl 래퍼 (ko 메시지). 테스트에서만 import 한다
import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

const read = (ns: string) => JSON.parse(readFileSync(`messages/ko/${ns}.json`, 'utf8'));
export const koMessages = { common: read('common'), errors: read('errors') };

export function renderIntl(node: ReactNode) {
  return render(
    <NextIntlClientProvider locale="ko" messages={koMessages}>
      {node}
    </NextIntlClientProvider>,
  );
}
