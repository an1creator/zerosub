import { NativeModules, Platform } from "react-native";
import { getLanguage, resolveLanguage, setLanguage, subscribeLanguage } from "../shared/i18n";

/** Paseo uses AsyncStorage for this client-side setting, not the plugin QueryClient. */
export const APP_SETTINGS_STORAGE_KEY = "@paseo:app-settings";
export const LANGUAGE_POLL_MS = 500;
type WebStorageHost = {
  localStorage?: { getItem(key: string): string | null };
  addEventListener?: (event: string, listener: () => void) => void;
  removeEventListener?: (event: string, listener: () => void) => void;
};
type NativeStorage = {
  multiGet(keys: string[], callback: (errors: unknown, rows?: [string, string | null][]) => void): void;
};
export async function readAppLanguageSetting(): Promise<unknown> {
  let raw: string | null = null;
  try {
    if (Platform.OS === "web") {
      raw = (globalThis as WebStorageHost).localStorage?.getItem(APP_SETTINGS_STORAGE_KEY) ?? null;
    } else {
      const storage = (NativeModules.RNCAsyncStorage ?? NativeModules.AsyncSQLiteDBStorage) as NativeStorage | undefined;
      if (storage) raw = await new Promise<string | null>((resolve) => {
        storage.multiGet([APP_SETTINGS_STORAGE_KEY], (errors, rows) => resolve(errors ? null : rows?.[0]?.[1] ?? null));
      });
    }
    return raw ? (JSON.parse(raw) as { language?: unknown }).language : undefined;
  } catch { return undefined; }
}
let users = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let reading = false;
async function refresh() {
  if (reading) return;
  reading = true;
  try {
    const setting = await readAppLanguageSetting();
    if (users) setLanguage(resolveLanguage(setting, Intl.DateTimeFormat().resolvedOptions().locale));
  } finally { reading = false; }
}
const changed = () => { void refresh(); };
export function subscribeAppLanguage(listener: () => void): () => void {
  const unsubscribe = subscribeLanguage(listener);
  if (++users === 1) {
    changed();
    // Same-window localStorage writes do not emit a storage event.
    timer = setInterval(changed, LANGUAGE_POLL_MS);
    if (Platform.OS === "web") {
      const web = globalThis as WebStorageHost;
      web.addEventListener?.("storage", changed);
      web.addEventListener?.("focus", changed);
    }
  }
  return () => {
    unsubscribe();
    if (--users === 0) {
      clearInterval(timer);
      if (Platform.OS === "web") {
        const web = globalThis as WebStorageHost;
        web.removeEventListener?.("storage", changed);
        web.removeEventListener?.("focus", changed);
      }
    }
  };
}
export { getLanguage };
