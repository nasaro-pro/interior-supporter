// P3 UI 표준 · D-8 접근성 — FormField / FormRow 의 aria-invalid · aria-describedby · role=alert, 오류 키 규약
import { cleanup, renderHook, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FormField,
  FormRow,
  describedBy,
  fieldAria,
  firstFieldError,
  useFieldErrorText,
} from './form-parts';
import { Input } from './input';
import { koMessages, renderIntl } from './test-intl';

afterEach(cleanup);
const field = koMessages.errors.field as Record<string, string>;

describe('useFieldErrorText', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale="ko" messages={koMessages}>
      {children}
    </NextIntlClientProvider>
  );
  const { result } = renderHook(() => useFieldErrorText(), { wrapper });
  it('A(field.x|n) · B(x:n) · 키만 — 모두 errors.field.* 로', () => {
    const tooLong = field.tooLong!.replace('{max}', '120');
    expect(result.current('field.tooLong|120')).toBe(tooLong);
    expect(result.current('tooLong:120')).toBe(tooLong);
    expect(result.current('required')).toBe(field.required);
    expect(result.current('field.required')).toBe(field.required);
  });
  it('없는 키·zod 기본 문장은 field.invalid (원시 키 노출 없음)', () => {
    expect(result.current('Invalid input: expected string')).toBe(field.invalid);
  });
});

describe('helpers', () => {
  it('describedBy · fieldAria · firstFieldError', () => {
    expect(describedBy('t', 'h', 'e')).toBe('t-hint t-error');
    expect(describedBy('t')).toBeUndefined();
    expect(fieldAria('x', { invalid: true })).toEqual({
      id: 'x',
      'aria-describedby': 'x-error',
      'aria-invalid': true,
    });
    expect(
      firstFieldError({ code: 'VALIDATION_FAILED', fieldErrors: { a: ['required'] } }, 'a'),
    ).toBe('required');
    expect(firstFieldError(null, 'a')).toBeUndefined();
  });
});

describe('FormField', () => {
  it('오류 없음: id·라벨 연결, aria-invalid 없음, 힌트만 describedby', () => {
    renderIntl(
      <FormField label="이름" hint="120자 이하">
        <Input name="name" />
      </FormField>,
    );
    const input = screen.getByLabelText('이름');
    expect(input).not.toHaveAttribute('aria-invalid');
    const hintId = input.getAttribute('aria-describedby');
    expect(hintId).toMatch(/-hint$/);
    expect(document.getElementById(hintId!)).toHaveTextContent('120자 이하');
  });

  it('errors 키: aria-invalid + 오류 문구(role=alert) 연결 + aria-required', () => {
    renderIntl(
      <FormField id="m-name" label="이름" errors={['required']} required hint="힌트">
        <Input name="name" />
      </FormField>,
    );
    const input = screen.getByLabelText(/이름/);
    expect(input).toHaveAttribute('id', 'm-name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input.getAttribute('aria-describedby')).toBe('m-name-hint m-name-error');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('id', 'm-name-error');
    expect(alert).toHaveTextContent(field.required!);
  });

  it('error(번역된 문구) + requiredLabel 은 글자로 필수 표시', () => {
    renderIntl(
      <FormField label="제목" error="제목을 입력하세요" required requiredLabel="필수">
        <textarea />
      </FormField>,
    );
    expect(screen.getByText('(필수)')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('제목을 입력하세요');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('FormRow (A 폼 공통) — D-8', () => {
  it('자식 id === htmlFor 이면 오류 시 aria-invalid·describedby 자동', () => {
    renderIntl(
      <FormRow label="이메일" htmlFor="login-email" errors={['field.email']}>
        <Input id="login-email" aria-describedby="login-email-error" />
      </FormRow>,
    );
    const input = screen.getByLabelText('이메일');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'login-email-error');
    expect(screen.getByRole('alert')).toHaveTextContent(field.email!);
  });

  it('오류가 없으면 aria-invalid 없음, 없는 오류 id 를 가리키지 않음, 힌트는 연결', () => {
    renderIntl(
      <FormRow label="주소명" htmlFor="su-slug" hint="영문 소문자">
        <Input id="su-slug" aria-describedby="su-slug-error" />
      </FormRow>,
    );
    const input = screen.getByLabelText('주소명');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).toHaveAttribute('aria-describedby', 'su-slug-hint');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('입력은 토큰 기반 포커스 링 클래스를 가진다', () => {
    renderIntl(
      <FormRow label="이름" htmlFor="n">
        <Input id="n" />
      </FormRow>,
    );
    expect(screen.getByLabelText('이름').className).toMatch(/focus-visible:ring-ring\/50/);
  });
});
