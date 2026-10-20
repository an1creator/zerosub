import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useToast } from "@getpaseo/plugin/client/react-native";
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { t } from "../shared/i18n";
import { usageSummary } from "../shared/format";
import { setAgentAccount } from "../shared/rpc";
import { describe, useStore, type ZeroSubStore } from "./store";
import { useLanguage } from "./i18n";
import { Button, Card, useText } from "./ui";
import { ResetConfirm } from "./reset-confirm";
import { forkPopover } from "./fork-confirm";

/** A single navigable surface, avoiding host MenuRoot state shared by retained composers. */
export function AccountPicker(props: PluginScreenProps & { store: ZeroSubStore; onManage(): void }) {
  useLanguage();
  const { theme, store, params, navigation, onManage } = props;
  const text = useText(theme);
  const toast = useToast();
  const { state, error } = useStore(store);
  const agentId = params.agentId ?? "";
  const route = state?.agents.find(item => item.agentId === agentId);
  const accounts = state?.accounts.filter(account => account.family === route?.family) ?? [];
  const current = accounts.find(account => account.id === route?.accountId);
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(false);
  const [fork, setFork] = useState(false);
  const other = route?.family === "codex" ? "claude" : "codex";
  const Fork = useMemo(() => route ? forkPopover(store, agentId, route.family, other) : null, [store, agentId, route?.family, other]);
  const choose = async (accountId: string | null) => {
    setBusy(true);
    try {
      const reply = await store.rpc(setAgentAccount, { agentId, accountId });
      if (reply.continuedIn) navigation?.openAgent({ agentId: reply.continuedIn.agentId });
      else navigation?.openAgent({ agentId });
      if (reply.failed.length) toast.error(reply.failed.map(item => item.error).join(" · "));
    } catch (e) { toast.error(describe(e)); }
    finally { setBusy(false); }
  };
  return <ScrollView contentContainerStyle={{ padding: 24, gap: 14, maxWidth: 600, width: "100%", alignSelf: "center" }}>
    <Text style={text.title}>{t("index.client.001")}</Text>
    {error ? <Text style={text.danger}>{error}</Text> : null}
    {!route ? <Text style={text.muted}>{t(state ? "messages.2" : "accounts-surface.008")}</Text> : accounts.map(account => (
      <Card key={account.id} theme={theme}>
        <View style={{ gap: 6 }}>
          <Text style={text.heading}>{account.label}</Text>
          <Text style={text.small}>{usageSummary(account)}</Text>
          <Button theme={theme} icon={account.id === current?.id ? "CircleCheck" : "ArrowRightLeft"}
            label={account.id === current?.id ? t("picker.current") : route.movable ? t("picker.select") : t("pills.001", {v0:account.label})}
            disabled={busy || account.id === current?.id || account.status === "signed_out" || account.status === "disabled"}
            onPress={() => void choose(account.id)} />
        </View>
      </Card>
    ))}
    {route?.pinned && route.movable ? <Button theme={theme} label={t("pills.005")} disabled={busy} onPress={() => void choose(null)} /> : null}
    {current?.usage?.resets ? <Button theme={theme} label={t("accounts-surface.049")} onPress={() => setReset(!reset)} /> : null}
    {reset && current ? <ResetConfirm theme={theme} store={store} account={current} agentId={agentId} onCancel={() => setReset(false)} onFinished={() => setReset(false)} /> : null}
    {current?.status === "limited" && accounts.every(a => a.status !== "ready") && state?.accounts.some(a => a.family === other && a.status === "ready") ? <Button theme={theme} label={t("fork-confirm.006",{v0:other === "codex" ? "ChatGPT" : "Claude"})} onPress={() => setFork(!fork)} /> : null}
    {fork && Fork ? <Fork context="agent" workspaceId={params.workspaceId ?? ""} agentId={agentId} theme={theme} host={props.host} layout={props.layout} close={() => setFork(false)} /> : null}
    <Button theme={theme} icon="Users" label={t("pills.006")} onPress={onManage} />
  </ScrollView>;
}
