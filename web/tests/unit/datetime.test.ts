import { expect, test } from "vitest";
import {
  formatSeoul,
  parseSeoulDayEnd,
  parseSeoulInput,
  parseSeoulInputOptional,
  seoulMonthRange,
  toSeoulInputValue,
} from "@/lib/datetime";

/**
 * ARCHITECTURE.md 5.1 — 입력은 Asia/Seoul, 저장은 UTC.
 * 이 테스트는 CI 가 TZ=UTC 로 돌 때 의미가 있다(20.2).
 * 개발 환경(KST)에서는 new Date() 로도 우연히 통과하므로 결함이 드러나지 않는다.
 */
test("datetime-local 입력은 KST 로 해석된다", () => {
  expect(parseSeoulInput("2026-09-13T10:00").toISOString()).toBe(
    "2026-09-13T01:00:00.000Z",
  );
});

test("date 입력은 KST 자정으로 해석된다", () => {
  expect(parseSeoulInput("2026-09-13").toISOString()).toBe(
    "2026-09-12T15:00:00.000Z",
  );
});

test("기간 필터의 끝 경계는 KST 그날 마지막 순간이다", () => {
  expect(parseSeoulDayEnd("2026-09-13").toISOString()).toBe(
    "2026-09-13T14:59:59.999Z",
  );
});

test("표시와 입력값은 왕복해도 같은 시각을 가리킨다", () => {
  const iso = parseSeoulInput("2026-01-01T00:30");
  expect(formatSeoul(iso)).toBe("2026-01-01 00:30");
  expect(toSeoulInputValue(iso)).toBe("2026-01-01T00:30");
});

test("월 범위는 KST 기준으로 잘린다", () => {
  const { from, to } = seoulMonthRange("2026-12");
  expect(from.toISOString()).toBe("2026-11-30T15:00:00.000Z");
  expect(to.toISOString()).toBe("2026-12-31T15:00:00.000Z");
});

test("빈 입력은 undefined 로 처리하고 잘못된 입력은 거부한다", () => {
  expect(parseSeoulInputOptional("")).toBeUndefined();
  expect(parseSeoulInputOptional(null)).toBeUndefined();
  expect(() => parseSeoulInput("")).toThrow();
  expect(() => parseSeoulInput("날짜아님")).toThrow();
});
