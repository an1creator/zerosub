import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { Modal, TextInput } from "@getpaseo/plugin/client/react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import type { AccountView, Family } from "../shared/model";
import { ProxyInputSchema, type ProxyInput, type ProxyView } from "../shared/proxy";
import { checkProxy, setAccountProxy } from "../shared/rpc";
import { describe, type ZeroSubStore } from "./store";
import { Button, useText } from "./ui";

type Theme = PluginSurfaceProps["theme"];
export type ProxyDraft = { enabled: boolean; type: "http" | "https" | "socks5"; host: string; port: string; username: string; password: string; changedPassword: boolean; hasPassword: boolean };
export function proxyDraft(value?: ProxyView | null): ProxyDraft {
  return { enabled: Boolean(value), type: value?.type ?? "http", host: value?.host ?? "", port: String(value?.port ?? 8080),
    username: value?.username ?? "", password: "", changedPassword: false, hasPassword: value?.hasPassword ?? false };
}
export function proxyInput(draft: ProxyDraft): ProxyInput | null {
  if (!draft.enabled) return null;
  const value = { type: draft.type, host: draft.host.trim(), port: Number(draft.port), username: draft.username,
    password: draft.changedPassword || !draft.hasPassword ? draft.password : undefined };
  const parsed = ProxyInputSchema.safeParse(value);
  if (!parsed.success) throw new Error("Проверьте адрес сервера и порт (1–65535). Адрес вводится без http:// и без порта.");
  if (value.password && !value.username) throw new Error("Для пароля прокси укажите логин.");
  return parsed.data;
}
export function ProxyForm({ theme, draft, onChange, store, family, accountId }: {
  theme: Theme; draft: ProxyDraft; onChange(value: ProxyDraft): void; store: ZeroSubStore; family: Family; accountId?: string;
}) {
  const text = useText(theme);
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; level?: "success" | "warning" | "error" } | null>(null);
  const change = (patch: Partial<ProxyDraft>) => { setResult(null); onChange({ ...draft, ...patch }); };
  const style = { color: theme.colors.foreground, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border,
    borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, minWidth: 0 };
  const test = async () => {
    setTesting(true); setResult(null);
    try {
      const proxy = proxyInput(draft);
      if (proxy) setResult(await store.rpc(checkProxy, { family, accountId, proxy }));
    } catch (e) { setResult({ ok: false, message: describe(e) }); }
    finally { setTesting(false); }
  };
  return <View style={{ gap: 12 }}>
    <Text style={text.heading}>Прокси аккаунта</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <Button theme={theme} label="Системное подключение" tone={!draft.enabled ? "primary" : "secondary"} onPress={() => change({ enabled: false })} />
      <Button theme={theme} label="Свой прокси" tone={draft.enabled ? "primary" : "secondary"} onPress={() => change({ enabled: true })} />
    </View>
    {draft.enabled ? <>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(["http", "https", "socks5"] as const).map((type) => <Button key={type} theme={theme} label={type.toUpperCase()}
          tone={draft.type === type ? "primary" : "secondary"} onPress={() => change({ type, port: draft.host ? draft.port : type === "socks5" ? "1080" : type === "https" ? "443" : "8080" })} />)}
      </View>
      <Text style={text.small}>{draft.type === "http" ? "HTTP CONNECT: соединение до прокси без TLS; трафик HTTPS к сервису остаётся зашифрованным."
        : draft.type === "https" ? "HTTPS-прокси: TLS также защищает соединение до прокси. Сертификат проверяется."
        : "SOCKS5: имена серверов разрешает прокси. Поддерживается авторизация по логину и паролю."}</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 3, gap: 5 }}><Text style={text.small}>Сервер</Text>
          <TextInput style={style} value={draft.host} onChangeText={(host) => change({ host })} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Сервер прокси" placeholder="proxy.example.com" placeholderTextColor={theme.colors.foregroundMuted} />
        </View>
        <View style={{ flex: 1, gap: 5 }}><Text style={text.small}>Порт</Text>
          <TextInput style={style} value={draft.port} onChangeText={(port) => change({ port })} keyboardType="number-pad" accessibilityLabel="Порт прокси" maxLength={5} />
        </View>
      </View>
      <Text style={text.small}>Логин (если требуется)</Text>
      <TextInput style={style} value={draft.username} onChangeText={(username) => change({ username })} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Логин прокси" />
      <Text style={text.small}>Пароль</Text>
      <TextInput style={style} value={draft.password} onChangeText={(password) => change({ password, changedPassword: true })} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false}
        placeholder={draft.hasPassword && !draft.changedPassword ? "Сохранён; оставьте пустым, чтобы не менять" : "Необязательно"} placeholderTextColor={theme.colors.foregroundMuted} accessibilityLabel="Пароль прокси" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button theme={theme} label={showPassword ? "Скрыть ввод" : "Показать ввод"} onPress={() => setShowPassword(!showPassword)} />
        {draft.hasPassword ? <Button theme={theme} label="Убрать сохранённый пароль" onPress={() => change({ password: "", changedPassword: true, hasPassword: false })} /> : null}
        <Button theme={theme} label="Проверить подключение" busy={testing} onPress={() => void test()} />
      </View>
      <Text style={text.small}>Проверка обращается к API через этот прокси без токена подписки. HTTP 401 — ожидаемый ответ. Пароль хранится только на этом хосте и не возвращается в интерфейс.</Text>
    </> : <Text style={text.small}>Используются настройки сети хоста, в том числе системный VPN или прокси.</Text>}
    {result ? <Text style={result.ok ? text.body : result.level === "warning" ? text.warning : text.danger}>{result.message}</Text> : null}
    <Text style={text.small}>Прокси применяется к запросам агента, входу через CLI и проверке лимитов. Страница входа в браузере использует сеть браузера. Команды и MCP могут иметь собственные настройки сети.</Text>
  </View>;
}
export function ProxyModal({ theme, account, store, onClose }: { theme: Theme; account: AccountView; store: ZeroSubStore; onClose(): void }) {
  const [draft, setDraft] = useState(() => proxyDraft(account.proxy));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = useText(theme);
  const save = async () => {
    setSaving(true); setError(null);
    try { await store.rpc(setAccountProxy, { accountId: account.id, proxy: proxyInput(draft) }); onClose(); }
    catch (e) { setError(describe(e)); }
    finally { setSaving(false); }
  };
  return <Modal title={`Подключение: ${account.label}`} open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
    <Modal.Content>
      <ProxyForm theme={theme} draft={draft} onChange={setDraft} family={account.family} accountId={account.id} store={store} />
      <Text style={text.small}>Сохранение не прерывает работу. Для уже открытых агентов перезапустите сессию; новые запросы проверки лимитов используют новую настройку.</Text>
      {error ? <Text style={text.danger}>{error}</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
        <Button theme={theme} label="Отмена" disabled={saving} onPress={onClose} />
        <Button theme={theme} label="Сохранить" tone="primary" busy={saving} onPress={() => void save()} />
      </View>
    </Modal.Content>
  </Modal>;
}
