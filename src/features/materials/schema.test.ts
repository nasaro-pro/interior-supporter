import { describe, expect, it } from 'vitest';
import {
  coreFieldsChanged,
  materialFieldsSchema,
  parseMaterialFilter,
  ilikeValue,
  materialSearchFilter,
  type MaterialFields,
} from '@/features/materials/schema';
import { parseVersionNo } from '@/features/estimates/schema';
import { parseLimit, withQuery } from '@/features/designs/lib/query';

const base: MaterialFields = {
  name: '욕실 벽 타일',
  category: '타일',
  space: 'bathroom',
  spec: '300x600 무광',
  quantity: 12.5,
  unit: '㎡',
  unitPrice: 45000,
  imageFileId: null,
  locationNote: '욕실 벽면',
  description: '',
};

describe('TC-111 자재 입력 검증 (REQ-111)', () => {
  it('수량은 0 이상·소수 2자리, 단가는 원 단위 정수', () => {
    expect(materialFieldsSchema.safeParse(base).success).toBe(true);
    expect(materialFieldsSchema.safeParse({ ...base, quantity: -1 }).success).toBe(false);
    expect(materialFieldsSchema.safeParse({ ...base, quantity: 1.234 }).success).toBe(false);
    expect(materialFieldsSchema.safeParse({ ...base, quantity: 0.1 + 0.2 }).success).toBe(true);
    expect(materialFieldsSchema.safeParse({ ...base, unitPrice: 100.5 }).success).toBe(false);
    expect(
      materialFieldsSchema.safeParse({ ...base, quantity: null, unitPrice: null }).success,
    ).toBe(true);
    expect(materialFieldsSchema.safeParse({ ...base, name: '  ' }).success).toBe(false);
  });

  it('POL-012 핵심 필드 변경만 재확인 대상으로 판단한다', () => {
    expect(
      coreFieldsChanged(base, { ...base, locationNote: '다른 위치', description: '메모' }),
    ).toBe(false);
    expect(coreFieldsChanged(base, { ...base, unitPrice: 46000 })).toBe(true);
    expect(
      coreFieldsChanged(base, { ...base, imageFileId: '00000000-0000-4000-8000-000000000001' }),
    ).toBe(true);
  });
});

describe('REQ-110 자재 필터 (카테고리·공간·검색어 독립 결합)', () => {
  it('query 에서 필터를 읽고 잘못된 공간 값은 버린다', () => {
    expect(parseMaterialFilter({ category: '타일', space: 'bathroom', q: ' 무광 ' })).toEqual({
      category: '타일',
      space: 'bathroom',
      q: '무광',
    });
    expect(parseMaterialFilter({ space: 'rooftop' }).space).toBeUndefined();
  });

  it('B-11: 검색어의 . * : 를 지우지 않고 큰따옴표 값으로 감싼다', () => {
    expect(materialSearchFilter('2.5T')).toBe('name.ilike."*2.5T*",spec.ilike."*2.5T*"');
    expect(materialSearchFilter(' 600*600 ')).toBe('name.ilike."*600*600*",spec.ilike."*600*600*"');
    expect(materialSearchFilter('a:b')).toBe('name.ilike."*a:b*",spec.ilike."*a:b*"');
    expect(materialSearchFilter('  ')).toBeNull();
    expect(materialSearchFilter(undefined)).toBeNull();
  });

  it('B-11: , ( ) 는 따옴표 안에 머물러 or() 구문을 깨지 않는다', () => {
    expect(ilikeValue('a,b)')).toBe('"*a,b)*"');
  });

  it('B-11: LIKE 와일드카드 % _ \\ 와 큰따옴표를 이스케이프한다', () => {
    expect(ilikeValue('50%')).toBe(String.raw`"*50\\%*"`);
    expect(ilikeValue('a_b')).toBe(String.raw`"*a\\_b*"`);
    expect(ilikeValue('say "hi"')).toBe(String.raw`"*say \"hi\"*"`);
    expect(ilikeValue(String.raw`c:\d`)).toBe(String.raw`"*c:\\\\d*"`);
  });
});

describe('목록·버전 query', () => {
  it('?limit 는 30 단위, 최대 300', () => {
    expect(parseLimit(undefined)).toBe(30);
    expect(parseLimit('60')).toBe(60);
    expect(parseLimit('65')).toBe(60);
    expect(parseLimit('9999')).toBe(300);
    expect(parseLimit('abc')).toBe(30);
  });

  it('REQ-132 ?v=N 은 1 이상 정수만', () => {
    expect(parseVersionNo('2')).toBe(2);
    expect(parseVersionNo('0')).toBeUndefined();
    expect(parseVersionNo('1.5')).toBeUndefined();
    expect(parseVersionNo(undefined)).toBeUndefined();
  });

  it('정규 경로에 query 를 붙인다', () => {
    expect(withQuery('/a', { x: 1, y: undefined, z: '' })).toBe('/a?x=1');
    expect(withQuery('/a?v=2', { limit: 60 })).toBe('/a?v=2&limit=60');
    expect(withQuery('/a', {})).toBe('/a');
  });
});

describe('B-14 화면에 보이는 필드는 규약 메시지 키만 낸다', () => {
  it('잘못된 이미지 id 는 errors.field.invalid 키 (zod 기본 영어 문장 아님)', () => {
    const r = materialFieldsSchema.safeParse({ ...base, imageFileId: 'not-a-uuid' });
    expect(r.success).toBe(false);
    if (r.success) return;
    const issue = r.error.issues.find((i) => i.path[0] === 'imageFileId');
    expect(issue?.message).toBe('invalid');
  });
  it('이미지 없음(null)은 통과', () => {
    expect(materialFieldsSchema.safeParse({ ...base, imageFileId: null }).success).toBe(true);
  });
});
