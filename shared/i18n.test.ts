import { expect, it } from "vitest";
import { en } from "./locales/en";
import { ru } from "./locales/ru";
import { translate, type MessageKey } from "./i18n";

it("keeps English and Russian keys and placeholders in sync", () => {
  expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
  const slots = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const key of Object.keys(en) as MessageKey[]) {
    expect(ru[key].trim(),key).not.toBe("");
    expect(slots(ru[key]), key).toEqual(slots(en[key]));
    expect(en[key],key).not.toMatch(/[а-яА-Я]/);
  }
});
it("preserves user values and keeps proxy result copy short", () => {
  expect(translate("ru","proxy-form.020",{v0:"Personal {v1}"})).toBe("Подключение: Personal {v1}");
  expect(translate("en","proxy.010")).toBe("Proxy works.");
  expect(translate("ru","proxy.010")).toBe("Прокси работает.");
});
