import { useLanguage } from "./i18n";
import { t } from "../shared/i18n";
import { localizeMessage } from "../shared/messages";
import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { Modal, TextInput } from "@getpaseo/plugin/client/react-native";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import type { AccountView, Family } from "../shared/model";
import { ProxyInputSchema, type ProxyInput, type ProxyView } from "../shared/proxy";
import { checkProxy, setAccountProxy, revealProxyPassword } from "../shared/rpc";
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
  if (!parsed.success) throw new Error(t("proxy-form.001"));
  if (value.password && !value.username) throw new Error(t("proxy-form.002"));
  return parsed.data;
}
export function ProxyForm({ theme, draft, onChange, store, family, accountId }: {
  theme: Theme; draft: ProxyDraft; onChange(value: ProxyDraft): void; store: ZeroSubStore; family: Family; accountId?: string;
}) {
  useLanguage();
  const text = useText(theme);
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const revision = useRef(0);
  useEffect(() => () => { revision.current++; }, []);
  const [result, setResult] = useState<{ ok: boolean; message: string; level?: "success" | "warning" | "error" } | null>(null);
  const change = (patch: Partial<ProxyDraft>) => { revision.current++; setResult(null); onChange({ ...draft, ...patch }); };
  const togglePassword = async () => {
    if (showPassword) {
      setShowPassword(false);
      if (!draft.changedPassword) change({ password: "" });
      return;
    }
    if (draft.changedPassword || !draft.hasPassword || !accountId) {
      setShowPassword(true);
      return;
    }
    const requestRevision = ++revision.current;
    setRevealing(true);
    try {
      const { password } = await store.rpc(revealProxyPassword, { accountId });
      // Ignore a late result after editing the form or closing the modal.
      if (revision.current !== requestRevision) return;
      onChange({ ...draft, password });
      setShowPassword(true);
    } catch (error) {
      if (revision.current === requestRevision) setResult({ ok: false, message: describe(error) });
    } finally { setRevealing(false); }
  };
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
    <Text style={text.heading}>{t("proxy-form.003")}</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <Button theme={theme} label={t("proxy-form.004")} tone={!draft.enabled ? "primary" : "secondary"} onPress={() => change({ enabled: false })} />
      <Button theme={theme} label={t("accounts-surface.032")} tone={draft.enabled ? "primary" : "secondary"} onPress={() => change({ enabled: true })} />
    </View>
    {draft.enabled ? <>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(["http", "https", "socks5"] as const).map((type) => <Button key={type} theme={theme} label={type.toUpperCase()}
          tone={draft.type === type ? "primary" : "secondary"} onPress={() => change({ type, port: draft.host ? draft.port : type === "socks5" ? "1080" : type === "https" ? "443" : "8080" })} />)}
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 3, gap: 5 }}><Text style={text.small}>{t("proxy-form.005")}</Text>
          <TextInput style={style} value={draft.host} onChangeText={(host) => change({ host })} autoCapitalize="none" autoCorrect={false} accessibilityLabel={t("proxy-form.006")} placeholder="proxy.example.com" placeholderTextColor={theme.colors.foregroundMuted} />
        </View>
        <View style={{ flex: 1, gap: 5 }}><Text style={text.small}>{t("proxy-form.007")}</Text>
          <TextInput style={style} value={draft.port} onChangeText={(port) => change({ port })} keyboardType="number-pad" accessibilityLabel={t("proxy-form.008")} maxLength={5} />
        </View>
      </View>
      <Text style={text.small}>{t("proxy-form.009")}</Text>
      <TextInput style={style} value={draft.username} onChangeText={(username) => change({ username })} autoCapitalize="none" autoCorrect={false} accessibilityLabel={t("proxy-form.010")} />
      <Text style={text.small}>{t("proxy-form.011")}</Text>
      <TextInput style={style} value={draft.password} onChangeText={(password) => change({ password, changedPassword: true })} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false}
        placeholder={draft.hasPassword && !draft.changedPassword ? t("proxy-form.012") : t("proxy-form.013")} placeholderTextColor={theme.colors.foregroundMuted} accessibilityLabel={t("proxy-form.014")} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button theme={theme} label={showPassword ? t("proxy-form.015") : t("proxy-form.016")} busy={revealing} onPress={() => void togglePassword()} />
        {draft.hasPassword ? <Button theme={theme} label={t("proxy-form.017")} onPress={() => change({ password: "", changedPassword: true, hasPassword: false })} /> : null}
        <Button theme={theme} label={t("proxy-form.018")} busy={testing} onPress={() => void test()} />
      </View>
    </> : <Text style={text.small}>{t("proxy-form.019")}</Text>}
    {result ? <Text style={result.ok ? text.body : result.level === "warning" ? text.warning : text.danger}>{localizeMessage(result.message)}</Text> : null}
  </View>;
}
export function ProxyModal({ theme, account, store, onClose }: { theme: Theme; account: AccountView; store: ZeroSubStore; onClose(): void }) {
  useLanguage();
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
  return <Modal title={t("proxy-form.020", { v0: account.label })} open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
    <Modal.Content>
      <ProxyForm theme={theme} draft={draft} onChange={setDraft} family={account.family} accountId={account.id} store={store} />
      <Text style={text.small}>{t("proxy-form.021")}</Text>
      {error ? <Text style={text.danger}>{error}</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
        <Button theme={theme} label={t("accounts-surface.056")} disabled={saving} onPress={onClose} />
        <Button theme={theme} label={t("accounts-surface.062")} tone="primary" busy={saving} onPress={() => void save()} />
      </View>
    </Modal.Content>
  </Modal>;
}
