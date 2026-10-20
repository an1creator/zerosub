import type { StateView } from "./model";
import { en } from "./locales/en";
import { ru } from "./locales/ru";
import { t, type MessageKey } from "./i18n";

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exact = new Map<string, MessageKey>();
const templates: Array<{ key: MessageKey; pattern: RegExp; names: string[] }> = [];
for (const [key, value] of [...Object.entries(en), ...Object.entries(ru)]) {
  exact.set(value, key as MessageKey);
  const names = [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!);
  if (names.length && /^(service|proxy|messages)\./.test(key)) {
    const pattern = new RegExp("^" + value.split(/\{\w+\}/).map(escape).join("(.*?)") + "$");
    templates.push({ key: key as MessageKey, pattern, names });
  }
}
/** Only plugin-owned diagnostics are translated. Unknown provider output stays intact. */
export function localizeMessage(message: string): string {
  const key = exact.get(message);
  if (key) return t(key);
  for (const template of templates) {
    const match = template.pattern.exec(message);
    if (match) return t(template.key, Object.fromEntries(template.names.map((name, i) => [name, match[i + 1]])));
  }
  return message;
}
export function localizeState(state: StateView): StateView {
  return { ...state,
    warnings: state.warnings.map(localizeMessage),
    logins: state.logins.map((login) => ({ ...login, message: login.message ? localizeMessage(login.message) : null })),
    accounts: state.accounts.map((account) => ({ ...account, usage: account.usage ? { ...account.usage,
      error: account.usage.error ? localizeMessage(account.usage.error) : null,
      resets: account.usage.resets ? { ...account.usage.resets, blockedReason: account.usage.resets.blockedReason ? localizeMessage(account.usage.resets.blockedReason) : null } : null,
    } : null })),
  };
}
