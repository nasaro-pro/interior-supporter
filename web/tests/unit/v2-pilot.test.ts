import { expect, test } from "vitest";
import { ForbiddenError } from "@/lib/errors";
import { sundayMonthCells } from "@/lib/datetime";
import { sniffMime, isCadMime } from "@/lib/storage/magic";
import { staffPolicy } from "@/modules/membership/policy";
import { isFieldOnly, isOfficeStaff } from "@/lib/tenancy/context";
import { editComment } from "@/modules/comment/service";
import { DEFAULT_EVENTS } from "@/modules/notification/repo";
import { presetBlocks } from "@/modules/page-builder/presets";

test("시공팀 역할은 현장 기록만 하고 사무실 권한과 분리된다", () => {
  expect(staffPolicy.recordFieldWork(["field_worker"])).toBe(true);
  expect(staffPolicy.editProjectContent(["field_worker"])).toBe(false);
  expect(isFieldOnly(["field_worker"])).toBe(true);
  expect(isOfficeStaff(["field_worker"])).toBe(false);
  expect(isOfficeStaff(["project_manager"])).toBe(true);
});

test("일요일 시작 월간 그리드는 42칸이고 첫 칸이 일요일이다", () => {
  const cells = sundayMonthCells("2026-09");
  expect(cells).toHaveLength(42);
  expect(cells[0]?.date).toBe("2026-08-30");
  expect(cells[2]?.date).toBe("2026-09-01");
  expect(cells[2]?.inMonth).toBe(true);
  expect(cells[0]?.inMonth).toBe(false);
});

test("SKP/DWG 는 파일명으로 식별하고 CAD MIME 으로 분류한다", () => {
  expect(sniffMime(new Uint8Array([0x00, 0x01]), "plan.skp")).toBe("application/x-sketchup");
  expect(sniffMime(new Uint8Array([0x00, 0x01]), "plan.dwg")).toBe("application/x-dwg");
  expect(isCadMime("application/x-sketchup")).toBe(true);
  expect(isCadMime("application/pdf")).toBe(false);
});

test("고객은 요청/댓글 원문을 수정할 수 없다", async () => {
  await expect(
    editComment(
      {
        kind: "customer",
        companyId: "00000000-0000-0000-0000-000000000001",
        projectId: "00000000-0000-0000-0000-000000000002",
        userId: "00000000-0000-0000-0000-000000000003",
        verified: true,
      },
      "00000000-0000-0000-0000-000000000004",
      "changed",
    ),
  ).rejects.toBeInstanceOf(ForbiddenError);
});

test("파일럿 알림 6종이 기본 이벤트에 포함된다", () => {
  expect(DEFAULT_EVENTS).toEqual(
    expect.arrayContaining([
      "design.published",
      "request.created",
      "schedule.changed",
      "photo.published",
      "assignment.changed",
      "estimate.published",
    ]),
  );
});

test("홈 프리셋 3종이 블록을 만든다", () => {
  expect(presetBlocks("atelier").length).toBeGreaterThan(2);
  expect(presetBlocks("gallery").some((b) => b.blockType === "gallery")).toBe(true);
  expect(presetBlocks("journal").some((b) => b.blockType === "process")).toBe(true);
});

test("TOTP 코드는 같은 30초 창에서 검증된다", async () => {
  const { randomTotpSecret, verifyTotp, generateTotp } = await import("@/lib/auth/totp");
  const secret = randomTotpSecret();
  const now = Date.parse("2026-09-16T00:00:00Z");
  const code = generateTotp(secret, now);
  expect(code).toMatch(/^\d{6}$/);
  expect(verifyTotp(secret, code, now)).toBe(true);
  expect(verifyTotp(secret, "000000", now)).toBe(false);
});
