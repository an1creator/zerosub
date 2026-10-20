import { localizeMessage } from "../shared/messages";
import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { Text, View } from "react-native";
import { formatResetIn } from "../shared/format";
import { FAMILY_LABEL } from "../shared/model";
import type { SwitchRow } from "../shared/timeline";

function cause(row: SwitchRow): string | null {
  const reset = formatResetIn(row.resetsAt);
  const from = row.from ?? "Предыдущий аккаунт";
  switch (row.reason) {
    case "limit":
      return `${from} исчерпал лимит${reset ? ` (сброс ${reset})` : ""}.`;
    case "signed_out":
      return `${from} требует повторного входа в разделе «Аккаунты».`;
    case "removed":
      return `${from} удалён.`;
    case "disabled":
      return `${from} временно отключён.`;
    case "enabled":
      return `${row.to} снова включён.`;
    case "default":
      return "Аккаунт по умолчанию изменён.";
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
  if (row.continuedIn) return `Продолжение в новом агенте «${row.continuedIn.title}», аккаунт ${row.to}.${detail}`;
  if (row.reason === "exhausted") return `Лимиты всех аккаунтов ${FAMILY_LABEL[row.family]} исчерпаны.${reset ? ` Сброс ${reset}.` : ""} Добавьте аккаунт, используйте запасной сброс или подождите.${detail}`;
  if (row.outcome === "reset") return `Для ${row.from ?? "аккаунта"} использован запасной сброс.${row.continued ? " Работа продолжается." : ""}${detail}`;
  const lead = cause(row);
  if (row.outcome === "stayed") return `${lead ?? ""} Чат остаётся на аккаунте ${row.from ?? "по умолчанию"}.${detail}`;
  if (row.outcome === "pending") return `${lead ?? ""} Аккаунт ${row.to} будет использован при следующем запуске сессии.${detail}`;
  return `${lead ?? ""} Выбран аккаунт ${row.to}.${row.continued ? " Работа продолжается." : ""}${detail}`;
}

/** Inline note in an agent's timeline when ZeroSub moved it to another account. */
export function SwitchRowView({ item, theme }: PluginTimelineItemProps<SwitchRow>) {
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
