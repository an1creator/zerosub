import { useLanguage } from "./i18n";
import { t, getLanguage } from "../shared/i18n";
import { localizeMessage } from "../shared/messages";
import { usageLabel } from "../shared/format";
import type { PluginButtonContentProps, PluginHostProps } from "@getpaseo/plugin/client";
import { useToast } from "@getpaseo/plugin/client/react-native";
import { useCallback, useState, type ComponentType } from "react";
import { Text, View } from "react-native";
import type { AccountView, ResetOffer } from "../shared/model";
import { redeemReset, type RedeemResult } from "../shared/rpc";
import { describe, type ZeroSubStore } from "./store";
import { Button, useText } from "./ui";

type Theme = PluginHostProps["theme"];

function formatDay(iso: string | null): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? null : at.toLocaleDateString(getLanguage(), { month: "short", day: "numeric" });
}

function list(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return t("reset-confirm.001", { v0: items.slice(0, -1).join(", "), v1: items.at(-1) });
}

/** "2 left · use by Sep 30". */
export function resetDetail(resets: ResetOffer): string {
  const until = formatDay(resets.expiresAt);
  return t("reset-confirm.002", { v0: resets.available, v1: until ? t("reset-confirm.013", { v0: until }) : "" });
}

/** "1 reset · use by Oct 23". */
export function resetBadge(resets: ResetOffer): string {
  const until = formatDay(resets.expiresAt);
  return t("reset-confirm.003", { v0: resets.available, v1: until ? t("reset-confirm.013", { v0: until }) : t("reset-confirm.014") });
}

/**
 * Confirmation for spending a banked reset. A reset is scarce and can't be undone, so the user
 * always confirms it here, whether they came from the account card or an agent's account button.
 */
export function ResetConfirm({
  theme,
  store,
  account,
  agentId,
  onFinished,
  onCancel,
}: {
  theme: Theme;
  store: ZeroSubStore;
  account: AccountView;
  /** The agent stopped by this account's limit; it carries on after the reset. */
  agentId?: string;
  onFinished(result: RedeemResult): void;
  onCancel(): void;
}) {
  useLanguage();
  const text = useText(theme);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resets = account.usage?.resets ?? null;

  const confirm = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      onFinished(await store.rpc(redeemReset, { accountId: account.id, agentId }));
    } catch (failure) {
      setError(describe(failure));
    } finally {
      setBusy(false);
    }
  }, [store, account.id, agentId, onFinished]);

  if (!resets) {
    return (
      <View style={{ gap: 12 }}>
        <Text style={text.body}>{t("reset-confirm.004", { v0: account.label })}</Text>
        <Button theme={theme} label={t("add-account.003")} tooltip={t("add-account.012")} tooltipAlign="end" onPress={onCancel} />
      </View>
    );
  }
  const refills = resets.refills.length > 0 ? t("reset-confirm.005", { v0: list(resets.refills.map(usageLabel)) }) : t("reset-confirm.006");
  return (
    <View style={{ gap: 12 }}>
      <Text style={text.body}>{t("reset-confirm.007", { v0: refills, v1: account.label, v2: agentId ? t("reset-confirm.015") : "" })}</Text>
      <Text style={text.muted}>{resetDetail(resets)}</Text>
      {resets.blockedReason ? <Text style={text.warning}>{resets.blockedReason}</Text> : null}
      {error ? <Text style={text.danger}>{error}</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
        <Button theme={theme} label={t("reset-confirm.008")} tooltip={t("reset-confirm.009")} tooltipAlign="end" onPress={onCancel} disabled={busy} />
        <Button
          theme={theme}
          tone="primary"
          icon="TimerReset"
          label={t("reset-confirm.010")}
          tooltip={t("reset-confirm.011")}
          tooltipAlign="end"
          busy={busy}
          disabled={!resets.usableNow}
          onPress={() => void confirm()}
        />
      </View>
    </View>
  );
}

/** The confirmation as popover content for an agent's account button. */
export function resetPopover(store: ZeroSubStore, account: AccountView, agentId: string): ComponentType<PluginButtonContentProps> {
  return function ResetPopover({ theme, close }: PluginButtonContentProps) {
    const toast = useToast();
    const text = useText(theme);
    return (
      <View style={{ gap: 12, maxWidth: 360 }}>
        <Text style={text.heading}>{t("accounts-surface.052")}</Text>
        <ResetConfirm
          theme={theme}
          store={store}
          account={account}
          agentId={agentId}
          onCancel={close}
          onFinished={(result) => {
            close();
            const { message, variant } = redeemToast(account.label, result);
            if (variant === "error") toast.error(message);
            else toast.show(message, { variant, durationMs: 5_000 });
          }}
        />
      </View>
    );
  };
}

/** Toast wording and tone for a redeem result. */
export function redeemToast(label: string, result: RedeemResult): { message: string; variant: "success" | "warning" | "error" } {
  if (result.outcome === "reset") {
    return { message: `${label}: ${localizeMessage(result.message)}${result.continued ? t("reset-confirm.012") : ""}`, variant: "success" };
  }
  if (result.outcome === "error") return { message: localizeMessage(result.message), variant: "error" };
  return { message: localizeMessage(result.message), variant: "warning" };
}
