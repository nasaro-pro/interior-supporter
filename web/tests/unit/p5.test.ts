import { expect, test } from "vitest";
import { ForbiddenError } from "@/lib/errors";
import { assertVisibilityTransition } from "@/lib/visibility";
import { staffPolicy } from "@/modules/membership/policy";
import { pageBuilderPolicy } from "@/modules/page-builder/policy";
import { blockContentSchemas } from "@/modules/page-builder/blocks/schemas";
import { matchesCurrentCodeVersion } from "@/modules/access";

test("초안에서 공개로 직접 전이는 거부된다", () => {
  expect(() => assertVisibilityTransition("draft", "published")).toThrow(ForbiddenError);
});

test("PM 은 승격을 승인할 수 없다", () => {
  expect(pageBuilderPolicy.approvePromotion(["project_manager"])).toBe(false);
  expect(staffPolicy.approvePromotion(["company_admin"])).toBe(true);
});

test("텍스트 블록 HTML 상한을 넘기면 실패한다", () => {
  expect(() =>
    blockContentSchemas.text.parse({ html: "x".repeat(20_001), align: "left" }),
  ).toThrow();
});

test("확정 코드 세대가 다르면 무효다", () => {
  expect(matchesCurrentCodeVersion(1, 1)).toBe(true);
  expect(matchesCurrentCodeVersion(1, 2)).toBe(false);
});
