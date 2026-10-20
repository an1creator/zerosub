import { useLanguage } from "./i18n";
import { t } from "../shared/i18n";
import { localizeMessage } from "../shared/messages";
import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { Text, View } from "react-native";
import { formatResetIn } from "../shared/format";
import { FAMILY_LABEL } from "../shared/model";
import type { SwitchRow } from "../shared/timeline";

function cause(row: SwitchRow): string | null {
  const reset = formatResetIn(row.resetsAt);
  const from = row.from ?? t("switch-row.001");
  switch (row.reason) {
    case "limit":
      return t("switch-row.002", { v0: from, v1: reset ? t("switch-row.014", { v0: reset }) : "" });
    case "signed_out":
      return t("switch-row.003", { v0: from });
    case "removed":
      return t("switch-row.004", { v0: from });
    case "disabled":
      return t("switch-row.005", { v0: from });
    case "enabled":
      return t("switch-row.006", { v0: row.to });
    case "default":
      return t("switch-row.007");
    default:
      return null;
  }
}

/** The work went on in a new agent on the other provider (Claude ↔ ChatGPT). */
function isFork(row: SwitchRow): boolean {
  return row.toFamily !== null && row.toFamily !== row.family;
}

export function describeRow(row: SwitchRow): string {
  const detail = row.detail ? ` ${localizeMessage(row.detail)}` : "";
  const reset = formatResetIn(row.resetsAt);
  if (row.continuedIn) return t("switch-row.008", { v0: row.continuedIn.title, v1: row.to, v2: detail });
  if (row.reason === "exhausted") return t("switch-row.009", { v0: FAMILY_LABEL[row.family], v1: reset ? t("switch-row.015", { v0: reset }) : "", v2: detail });
  if (row.outcome === "reset") return t("switch-row.010", { v0: row.from ?? t("switch-row.016"), v1: row.continued ? t("switch-row.017") : "", v2: detail });
  const lead = cause(row);
  if (row.outcome === "stayed") return t("switch-row.011", { v0: lead ?? "", v1: row.from ?? t("switch-row.018"), v2: detail });
  if (row.outcome === "pending") return t("switch-row.012", { v0: lead ?? "", v1: row.to, v2: detail });
  return t("switch-row.013", { v0: lead ?? "", v1: row.to, v2: row.continued ? t("switch-row.017") : "", v3: detail });
}

/** Inline note in an agent's timeline when ZeroSub moved it to another account. */
export function SwitchRowView({ item, theme }: PluginTimelineItemProps<SwitchRow>) {
  useLanguage();
  const row = item.data;
  const forked = isFork(row);
  const warning =
    !forked && (row.reason === "limit" || row.reason === "signed_out" || row.reason === "exhausted" || row.outcome === "stayed");
  const icon = forked
    ? "GitFork"
    : row.reason === "exhausted" || row.outcome === "stayed"
      ? "CircleAlert"
      : row.outcome === "continued"
        ? "CopyPlus"
        : row.outcome === "reset"
          ? "TimerReset"
          : "ArrowRightLeft";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface1,
        alignSelf: "flex-start",
        maxWidth: "100%",
      }}
    >
      <Icon name={icon} size={14} color={warning ? theme.colors.statusWarning : theme.colors.foregroundMuted} />
      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 13, flexShrink: 1 }}>{describeRow(row)}</Text>
    </View>
  );
}
