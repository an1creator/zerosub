import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it } from "vitest";
import { APP_LANGUAGE_QUERY, useLanguage } from "./i18n";
import { getLanguage, resolveLanguage, setLanguage, t } from "../shared/i18n";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => setLanguage("en"));
it("follows Paseo language changes without a plugin preference or reload", async () => {
  const query = new QueryClient();
  query.setQueryData(APP_LANGUAGE_QUERY, { language: "en" });
  function Label() { useLanguage(); return <>{t("proxy-form.018")}</>; }
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<QueryClientProvider client={query}><Label /></QueryClientProvider>); });
  expect(tree.toJSON()).toBe("Test");
  await act(async () => { query.setQueryData(APP_LANGUAGE_QUERY, { language: "ru" }); });
  expect(tree.toJSON()).toBe("Проверить");
  expect(getLanguage()).toBe("ru");
  await act(async () => { query.setQueryData(APP_LANGUAGE_QUERY, { language: "en" }); });
  expect(tree.toJSON()).toBe("Test");
  await act(async () => tree.unmount());
  query.clear();
});
it("respects explicit app language and resolves system/fallback language", () => {
  expect(resolveLanguage("en", "ru-RU")).toBe("en");
  expect(resolveLanguage("ru", "en-US")).toBe("ru");
  expect(resolveLanguage("system", "ru-RU")).toBe("ru");
  expect(resolveLanguage("fr", "ru-RU")).toBe("en");
  expect(resolveLanguage(undefined, "de-DE")).toBe("en");
});
