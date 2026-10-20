import { en } from "./locales/en";
import { ru } from "./locales/ru";

export type Language = "en" | "ru";
export type MessageKey = keyof typeof en;
let language: Language = "en";
const listeners = new Set<() => void>();
export function resolveLanguage(setting: unknown, systemLocale: string): Language {
  const requested = typeof setting === "string" && setting !== "system" ? setting : systemLocale;
  return /^ru(?:-|_|$)/i.test(requested) ? "ru" : "en";
}
export const getLanguage = () => language;
export function setLanguage(next: Language): void {
  if (language === next) return;
  language = next;
  for (const listener of [...listeners]) listener();
}
export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function translate(locale: Language, key: MessageKey, values: Record<string, unknown> = {}): string {
  const template: string = (locale === "ru" ? ru[key] : en[key]) ?? en[key];
  return template.replace(/\{(\w+)\}/g, (match, name: string) => values[name] === undefined ? match : String(values[name] ?? ""));
}
export function t(key: MessageKey, values: Record<string, unknown> = {}): string {
  return translate(language, key, values);
}
