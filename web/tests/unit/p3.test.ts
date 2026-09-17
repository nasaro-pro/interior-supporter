import { expect, test } from "vitest";
import { ForbiddenError } from "@/lib/errors";
import { assertVisibilityTransition } from "@/lib/visibility";
import { assertPublicHttpUrl } from "@/lib/ssrf";
import { sniffMime } from "@/lib/storage/magic";

test("초안에서 공개로 직접 전이는 거부된다", () => {
  expect(() => assertVisibilityTransition("draft", "published")).toThrow(
    ForbiddenError,
  );
});

test("초안에서 검토는 허용된다", () => {
  expect(() => assertVisibilityTransition("draft", "review")).not.toThrow();
});

test("127.0.0.1 링크 미리보기는 거부된다", async () => {
  await expect(assertPublicHttpUrl("http://127.0.0.1/x")).rejects.toBeInstanceOf(
    ForbiddenError,
  );
});

test("위조 확장자 매직바이트는 거부된다", () => {
  const fakePng = Buffer.from("not-an-image");
  expect(sniffMime(fakePng)).toBeNull();
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  expect(sniffMime(jpeg)).toBe("image/jpeg");
});
