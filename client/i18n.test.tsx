import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLanguage } from "./i18n";
import { APP_SETTINGS_STORAGE_KEY, LANGUAGE_POLL_MS, readAppLanguageSetting } from "./language-source";
import { getLanguage, resolveLanguage, setLanguage, t } from "../shared/i18n";

const native = vi.hoisted(() => ({ Platform: { OS: "web" }, NativeModules: {} as Record<string, unknown> }));
vi.mock("react-native", () => native);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  native.Platform.OS = "web";
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null });
});
afterEach(() => { setLanguage("en"); vi.useRealTimers(); vi.unstubAllGlobals(); });
it("follows same-window Paseo storage changes despite an isolated plugin QueryClient", async () => {
  vi.useFakeTimers();
  const query = new QueryClient();
  query.setQueryData(["app-settings"], { language: "ru" }); // Deliberately stale plugin-only cache.
  values.set(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ language: "en" }));
  function Label() { useLanguage(); return <>{t("proxy-form.018")}</>; }
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<QueryClientProvider client={query}><Label /></QueryClientProvider>); });
  expect(tree.toJSON()).toBe("Test");
  values.set(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ language: "ru" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(LANGUAGE_POLL_MS); });
  expect(tree.toJSON()).toBe("Проверить");
  values.set(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ language: "en" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(LANGUAGE_POLL_MS); });
  expect(tree.toJSON()).toBe("Test");
  expect(getLanguage()).toBe("en");
  await act(async () => tree.unmount());
  query.clear();
});
it("reads the native app language without accessing web storage", async () => {
  native.Platform.OS = "android";
  native.NativeModules.RNCAsyncStorage = { multiGet: (keys: string[], callback: (error: unknown, rows: string[][]) => void) => {
    expect(keys).toEqual([APP_SETTINGS_STORAGE_KEY]);
    callback(null, [[APP_SETTINGS_STORAGE_KEY, JSON.stringify({language:"ru"})]]);
  }};
  expect(await readAppLanguageSetting()).toBe("ru");
});
it("respects explicit language and falls back for unsupported locales", () => {
  expect(resolveLanguage("en", "ru-RU")).toBe("en");
  expect(resolveLanguage("ru", "en-US")).toBe("ru");
  expect(resolveLanguage("system", "ru-RU")).toBe("ru");
  expect(resolveLanguage("fr", "ru-RU")).toBe("en");
});
