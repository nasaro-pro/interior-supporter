import { expect, test } from "vitest";
import {
  auditActionLabels,
  labelOf,
  notifyEventLabels,
  processLabels,
  projectStatusLabels,
  spaceLabels,
} from "@/lib/messages";
import { auditActionEnum, processCategoryEnum, spaceCategoryEnum, projectStatusEnum } from "@/lib/db/enums";
import { DEFAULT_EVENTS } from "@/modules/notification/repo";

/**
 * AGENTS.md 8 / R8 — enum 원문을 화면에 내보내지 않는다.
 * lib/messages 는 클라이언트 번들에도 들어가므로 drizzle 을 import 하지 않는다.
 * 대신 두 목록이 어긋나면 이 테스트가 잡는다.
 */
test("감사 행위 라벨이 enum 을 빠짐없이 덮는다", () => {
  const missing = auditActionEnum.enumValues.filter(
    (value) => !(value in auditActionLabels),
  );
  expect(missing).toEqual([]);
});

test("공정·공간·프로젝트 상태 라벨이 enum 을 빠짐없이 덮는다", () => {
  expect(
    processCategoryEnum.enumValues.filter((v) => !(v in processLabels)),
  ).toEqual([]);
  expect(
    spaceCategoryEnum.enumValues.filter((v) => !(v in spaceLabels)),
  ).toEqual([]);
  expect(
    projectStatusEnum.enumValues.filter((v) => !(v in projectStatusLabels)),
  ).toEqual([]);
});

test("알림 이벤트 라벨이 발송 이벤트를 빠짐없이 덮는다", () => {
  const missing = DEFAULT_EVENTS.filter((e) => !(e in notifyEventLabels));
  expect(missing).toEqual([]);
});

test("labelOf 는 알 수 없는 키에도 화면을 깨뜨리지 않는다", () => {
  expect(labelOf(processLabels, "tile")).toBe(processLabels.tile);
  expect(labelOf(processLabels, "존재하지않음")).toBe("존재하지않음");
  expect(labelOf(processLabels, null)).toBe("-");
});
