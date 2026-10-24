'use client';
// src/shared/ui/form-parts.tsx (A) — 폼 공통: 필드 래퍼(aria 자동 연결)·필드 오류 문구·제출 버튼(중복 제출 방지)·폼 오류 요약
// 접근성(00 헌법 10.3, D-8): 잘못된 입력 aria-invalid, 오류·힌트 aria-describedby, 오류 문구 role="alert"
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import type { AppError } from '@/shared/contracts/errors';

/**
 * 필드 오류 키 → 문구. 모든 규약을 받는다:
 * 'field.tooLong|120' (A) · 'tooLong:120' (B) · 'required' → errors.field.*  ({max}·{min} 값)
 * 없는 키(zod 기본 영어 문장 등)는 원시 키 대신 errors.field.invalid (B-14)
 */
export function useFieldErrorText() {
  const t = useTranslations('errors');
  return (key: string) => {
    const [rawKey = 'invalid', arg] = key.split(/[|:]/);
    const k = rawKey.startsWith('field.') ? rawKey.slice('field.'.length) : rawKey;
    const name = `field.${k}` as Parameters<typeof t>[0];
    if (!t.has(name)) return t('field.invalid');
    const n = Number(arg);
    return t(name, { max: n, min: n });
  };
}

/** 서버 fieldErrors(키 → 메시지 배열)의 첫 메시지 */
export function firstFieldError(
  error: AppError | null | undefined,
  name: string,
): string | undefined {
  return error?.fieldErrors?.[name]?.[0];
}

/** 힌트·오류 문구 id 를 aria-describedby 값으로 (C 호환) */
export function describedBy(id: string, hint?: unknown, error?: unknown): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

/** 컨트롤에 직접 펼쳐 넣는 aria 속성 묶음 — <Input {...fieldAria('x', { invalid: !!err, hint: true })} /> */
export function fieldAria(
  id: string,
  { hint, invalid }: { hint?: boolean; invalid?: boolean } = {},
) {
  return {
    id,
    'aria-describedby': describedBy(id, hint, invalid),
    'aria-invalid': invalid ? true : undefined,
  } as const;
}

function mergeIds(...lists: (string | undefined)[]): string | undefined {
  const ids = Array.from(new Set(lists.flatMap((l) => (l ? l.split(/\s+/) : [])).filter(Boolean)));
  return ids.length ? ids.join(' ') : undefined;
}

type Controlish = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-required'?: boolean;
};

/** aria-describedby 로 연결되는 필드 오류 (00 헌법 10.3) */
export function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  const text = useFieldErrorText();
  if (!errors?.length) return null;
  return (
    <p id={id} className="text-destructive text-meta mt-1" role="alert">
      {errors.map(text).join(' ')}
    </p>
  );
}

/** 액션 결과 오류 요약 (오류 코드 문구 + 문의 코드). 충돌이면 '최신 불러오기'가 있는 ActionError 를 쓴다 */
export function FormError({ error }: { error?: AppError | null }) {
  const t = useTranslations();
  if (!error) return null;
  return (
    <div
      role="alert"
      className="border-destructive/40 bg-tone-critical-bg text-tone-critical-fg rounded-md border px-3 py-2 text-sm"
    >
      <p>{t(`errors.${error.code}`)}</p>
      {error.ref ? (
        <p className="text-meta mt-1">{t('common.state.errorRef', { ref: error.ref })}</p>
      ) : null}
    </div>
  );
}

/** 제출 중 비활성 (00 헌법 10.3) */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

function RequiredMark({ label }: { label?: string }) {
  return label ? (
    <span className="text-muted-foreground ms-1 text-xs font-normal">({label})</span>
  ) : (
    <span aria-hidden className="text-destructive ms-0.5">
      *
    </span>
  );
}

/**
 * 라벨 + 입력 + 힌트 + 오류 묶음 (A 기존 API).
 * 자식 컨트롤의 id 가 htmlFor 와 같으면 aria-invalid·aria-describedby 를 자동으로 붙인다.
 */
export function FormRow({
  label,
  htmlFor,
  hint,
  children,
  errorId,
  errors,
  required,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
  errorId?: string;
  errors?: string[];
  required?: boolean;
}) {
  const errId = errorId ?? `${htmlFor}-error`;
  const hintId = `${htmlFor}-hint`;
  const invalid = Boolean(errors?.length);
  const wired = Children.map(children, (child) => {
    if (!isValidElement<Controlish>(child) || child.props.id !== htmlFor) return child;
    return cloneElement(child, {
      'aria-invalid': invalid ? true : child.props['aria-invalid'],
      'aria-describedby': mergeIds(
        // 오류가 없을 때는 존재하지 않는 오류 id 를 가리키지 않는다
        child.props['aria-describedby']
          ?.split(/\s+/)
          .filter((x) => invalid || x !== errId)
          .join(' '),
        hint ? hintId : undefined,
        invalid ? errId : undefined,
      ),
    });
  });
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required ? <RequiredMark /> : null}
      </label>
      {wired}
      {hint ? (
        <p id={hintId} className="text-muted-foreground text-meta">
          {hint}
        </p>
      ) : null}
      <FieldError id={errId} errors={errors} />
    </div>
  );
}

/**
 * 표준 필드 래퍼 (B Field · C FormField 대체). 자식 컨트롤 하나에
 * id · aria-describedby(힌트·오류) · aria-invalid · aria-required 를 자동 주입한다.
 * error = 번역된 문구, errors = 오류 키 배열(useFieldErrorText 로 번역)
 */
export function FormField({
  label,
  children,
  id: idProp,
  hint,
  error,
  errors,
  required,
  requiredLabel,
  className,
}: {
  label: ReactNode;
  children: ReactElement<Controlish>;
  id?: string;
  hint?: ReactNode;
  error?: string;
  errors?: string[];
  required?: boolean;
  /** 필수 표시 문구(common.field.required). 없으면 '*' */
  requiredLabel?: string;
  className?: string;
}) {
  const autoId = useId();
  const id = idProp ?? children.props.id ?? autoId;
  const text = useFieldErrorText();
  const message = error ?? (errors?.length ? errors.map(text).join(' ') : undefined);
  const hintId = `${id}-hint`;
  const errId = `${id}-error`;
  const control = cloneElement(children, {
    id,
    'aria-describedby': mergeIds(
      children.props['aria-describedby'],
      hint ? hintId : undefined,
      message ? errId : undefined,
    ),
    'aria-invalid': message ? true : children.props['aria-invalid'],
    'aria-required': required ? true : children.props['aria-required'],
  });
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required ? <RequiredMark label={requiredLabel} /> : null}
      </label>
      {control}
      {hint ? (
        <p id={hintId} className="text-muted-foreground text-meta">
          {hint}
        </p>
      ) : null}
      {message ? (
        <p id={errId} className="text-destructive text-meta" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
