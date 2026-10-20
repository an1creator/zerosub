import { expect, it } from "vitest";
import { localizeMessage } from "./messages";

it("translates plugin errors but keeps unknown diagnostic details", () => {
  expect(localizeMessage("That account no longer exists.")).toBe("Аккаунт больше не существует.");
  expect(localizeMessage("Work is signed out. Sign it in first.")).toBe("Work: сначала войдите в аккаунт.");
  expect(localizeMessage("TLS error: CERT_EXPIRED")).toBe("TLS error: CERT_EXPIRED");
});
