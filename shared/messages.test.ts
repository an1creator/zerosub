import { setLanguage } from "./i18n";
beforeEach(() => setLanguage("ru"));
import { beforeEach, expect, it } from "vitest";
import { localizeMessage } from "./messages";

it("translates plugin errors but keeps unknown diagnostic details", () => {
  expect(localizeMessage("That account no longer exists.")).toBe("Аккаунт больше не существует.");
  expect(localizeMessage("Work is signed out. Sign it in first.")).toBe("Work: сначала войдите в аккаунт.");
  expect(localizeMessage("TLS error: CERT_EXPIRED")).toBe("TLS error: CERT_EXPIRED");
});

it("relocalizes a visible proxy result after a language change", () => {
  expect(localizeMessage("Proxy works.")).toBe("Прокси работает.");
  setLanguage("en");
  expect(localizeMessage("Прокси работает.")).toBe("Proxy works.");
});
