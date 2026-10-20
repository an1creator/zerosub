import { t } from "../shared/i18n";
import type { PluginButtonContentProps } from "@getpaseo/plugin/client";
import { useToast } from "@getpaseo/plugin/client/react-native";
import { useState, type ComponentType } from "react";
import { Text, View } from "react-native";
import { FAMILY_LABEL, type Family } from "../shared/model";
import { forkAgent } from "../shared/rpc";
import { describe, type ZeroSubStore } from "./store";
import { Button, useText } from "./ui";

/**
 * Confirmation for carrying a stopped agent's work on with the other provider. It starts a new agent
 * that goes straight to work, so it's worth a second look; refusals (say, no mode as careful as this
 * agent's) show right here.
 */
export function forkPopover(store: ZeroSubStore, agentId: string, from: Family, to: Family): ComponentType<PluginButtonContentProps> {
  return function ForkPopover({ theme, close }: PluginButtonContentProps) {
    const toast = useToast();
    const text = useText(theme);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const start = async () => {
      setBusy(true);
      setError(null);
      try {
        const fork = await store.rpc(forkAgent, { agentId });
        close();
        toast.show(t("fork-confirm.001", { v0: FAMILY_LABEL[to], v1: fork.title }), { variant: "success", durationMs: 5_000 });
      } catch (failure) {
        setError(describe(failure));
        setBusy(false);
      }
    };

    return (
      <View style={{ gap: 12, maxWidth: 360 }}>
        <Text style={text.heading}>{t("fork-confirm.002", { v0: FAMILY_LABEL[to] })}</Text>
        <Text style={text.body}>{t("fork-confirm.003", { v0: FAMILY_LABEL[from], v1: FAMILY_LABEL[to] })}</Text>
        {error ? <Text style={text.danger}>{error}</Text> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
          <Button theme={theme} label={t("fork-confirm.004")} tooltip={t("fork-confirm.005")} tooltipAlign="end" onPress={close} disabled={busy} />
          <Button
            theme={theme}
            tone="primary"
            icon="GitFork"
            label={t("fork-confirm.006", { v0: FAMILY_LABEL[to] })}
            tooltip={t("fork-confirm.007", { v0: FAMILY_LABEL[to] })}
            tooltipAlign="end"
            busy={busy}
            onPress={() => void start()}
          />
        </View>
      </View>
    );
  };
}
