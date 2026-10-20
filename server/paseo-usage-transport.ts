import { dirname, resolve } from "node:path";
import { readJson } from "./json-file";
import { accountFetch } from "./proxy";
import { mainCodexHome, paseoHome } from "./paths";

interface StoredAccounts { defaults?: { codex?: string | null }; accounts?: Array<{ id: string; family: string; home: string | null }> }
/** Preserve each native source's credential identity; only select its outbound route. */
export function usageProxyHome(input: unknown, state: StoredAccounts): string | null | undefined {
  const value = input as { route?: { store?: string; path?: string }; store?: string };
  if (value.route) {
    if (value.route.store !== "codex" || !value.route.path) return undefined;
    const home = resolve(dirname(value.route.path));
    return home === resolve(mainCodexHome()) ? null : home;
  }
  // Cursor is outside the account manager: its usage check follows the default Codex proxy.
  const account = state.accounts?.find(a => a.id === state.defaults?.codex && a.family === "codex");
  return account?.home ?? null;
}
export function usageFetch(input: unknown): typeof fetch {
  return (async (url: unknown, init?: RequestInit) => {
    const state = await readJson(`${paseoHome()}/zerosub/state.json`) as StoredAccounts | undefined;
    const home = usageProxyHome(input, state ?? {});
    if (home === undefined) return fetch(url as string, init);
    return accountFetch("codex", home, String(url), init ?? {});
  }) as typeof fetch;
}
