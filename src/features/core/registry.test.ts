// TC-907 모든 page 의 data-screen-id 가 screens.ts 와 일치 · TC-908 TS 열거형 = DB 열거형 · A-T09 제외 범위 화면 없음
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCREENS } from '@/shared/contracts/screens';
import * as domain from '@/shared/contracts/domain';

const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const pages = walk('src/app').filter((f) => /[\\/]page\.tsx$/.test(f));
const ids = new Set<string>(SCREENS.map((s) => s.id));

describe('TC-907 화면 레지스트리', () => {
  it('TC-907 화면을 그리는 page 는 모두 등록된 data-screen-id 를 가진다', () => {
    const problems: string[] = [];
    for (const f of pages) {
      const src = readFileSync(f, 'utf8');
      if (/\bredirect\(/.test(src) && !/data-screen-id/.test(src)) continue; // 빈 중간 화면 없이 이동만 하는 경로
      const m = /data-screen-id="([A-Z]+-\d+)"/.exec(src) ?? /screenId="([A-Z]+-\d+)"/.exec(src);
      if (!m) problems.push(`${f}: data-screen-id 없음`);
      else if (!ids.has(m[1] ?? '')) problems.push(`${f}: 미등록 ${m[1]}`);
    }
    expect(problems).toEqual([]);
  });

  it('A-T09 제외·보류 화면(OP·대시보드·마이페이지 등)이 레지스트리에 active 로 없다', () => {
    const routes = SCREENS.filter((s) => s.status === 'active').map((s) => s.route);
    // '/admin' 은 2차 수정 CR-3(사이트 관리, 통합본 3장)으로 범위에 들어왔다
    for (const bad of ['/op', '/dashboard', '/mypage', '/meeting', '/billing'])
      expect(routes.some((r) => r.includes(bad))).toBe(false);
  });
});

describe('TC-908 TS 열거형 = DB 열거형', () => {
  const sql = readFileSync('supabase/migrations/20261006000100_a_foundation.sql', 'utf8');
  const dbEnum = (name: string) => {
    const m = new RegExp(`create type public\\.${name}\\s+as enum \\(([^;]+)\\);`).exec(sql);
    return m ? [...(m[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) : null;
  };
  const pairs: [string, readonly string[]][] = [
    ['member_role', domain.MEMBER_ROLES],
    ['participant_role', domain.PARTICIPANT_ROLES],
    ['project_status', domain.PROJECT_STATUSES],
    ['confirm_state', domain.CONFIRM_STATES],
    ['request_status', domain.REQUEST_STATUSES],
    ['material_space', domain.MATERIAL_SPACES],
    ['photo_phase', domain.PHOTO_PHASES],
    ['file_kind', domain.FILE_KINDS],
  ];
  it.each(pairs)('TC-908 %s', (name, values) => {
    expect(dbEnum(name)).toEqual([...values]);
  });
});
