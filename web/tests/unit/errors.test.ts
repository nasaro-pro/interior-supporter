import { expect, test } from "vitest";
import { errorToHttp, UnauthorizedError } from "@/lib/errors";

test("UnauthorizedError maps to 401", () => {
  const mapped = errorToHttp(new UnauthorizedError());
  expect(mapped.status).toBe(401);
  expect(mapped.code).toBe("unauthorized");
});
