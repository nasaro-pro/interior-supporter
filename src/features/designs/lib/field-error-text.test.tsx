// B-14 회귀 (P3: kit/feedback → 표준 useFieldErrorText 이전 후에도 유지): 규약 밖 zod 메시지는 원시 키 대신 errors.field.invalid
import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { useFieldErrorText } from '@/shared/ui/form-parts';

const errors = JSON.parse(readFileSync('messages/ko/errors.json', 'utf8')) as {
  field: Record<string, string>;
};
const wrapper = ({ children }: { children: ReactNode }) => (
  <NextIntlClientProvider locale="ko" messages={{ errors }}>
    {children}
  </NextIntlClientProvider>
);

describe('B 필드 오류 문구 (B-14)', () => {
  const { result } = renderHook(() => useFieldErrorText(), { wrapper });

  it('B 규약 키(tooLong:120 · fileRequired)는 값과 함께 해석한다', () => {
    expect(result.current('required')).toBe(errors.field.required);
    expect(result.current('tooLong:120')).toBe(errors.field.tooLong!.replace('{max}', '120'));
    expect(result.current('fileRequired')).toBe(errors.field.fileRequired);
  });
  it('없는 키·zod 기본 문장은 field.invalid 로 대체 (원시 키 노출 없음)', () => {
    expect(result.current('Invalid UUID')).toBe(errors.field.invalid);
    expect(result.current('Invalid input: expected string, received number')).toBe(
      errors.field.invalid,
    );
  });
});
