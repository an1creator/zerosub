import { ProxyModal } from "./proxy-form";
import { useHosts, useSettings, type PluginSurfaceProps } from "@getpaseo/plugin/client";
import { Icon, Modal, TextInput, useToast } from "@getpaseo/plugin/client/react-native";
import { SettingsCard, SettingsSwitch } from "@getpaseo/plugin/client/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { accountSubtitle, formatAge, formatPlan, usageSummary } from "../shared/format";
import { FAMILY_LABEL, type AccountView, type Family } from "../shared/model";
import { preferences } from "../shared/preferences";
import {
  clearAccountLimit,
  removeAccount,
  renameAccount,
  setAccountEnabled,
  setDefaultAccount,
  type ReopenSummary,
} from "../shared/rpc";
import { AddAccountModal } from "./add-account";
import { ResetConfirm, redeemToast, resetBadge } from "./reset-confirm";
import { describe, useStore, VISIBLE_POLL_MS, type ZeroSubStore } from "./store";
import { Badge, Button, Card, IconButton, UsageBar, useText } from "./ui";

type Theme = PluginSurfaceProps["theme"];

export function AccountsSurface(props: PluginSurfaceProps & { store: ZeroSubStore }) {
  const { theme, layout, host, store } = props;
  const { state, error } = useStore(store);
  const text = useText(theme);
  const [adding, setAdding] = useState<{ family: Family; accountId?: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const refreshUsage = useCallback(async () => {
    setRefreshing(true);
    try {
      await store.refresh({ refreshUsage: true });
    } finally {
      setRefreshing(false);
    }
  }, [store]);
  // Each host runs its own copy of the plugin with its own accounts; Paseo's host picker switches.
  const hosts = useHosts();
  const multiHost = hosts.length > 1;
  const hostStatus = hosts.find((entry) => entry.serverId === host.id)?.status;
  const offline = hostStatus !== undefined && hostStatus !== "online";
  // Keep usage moving while the screen is open.
  useEffect(() => store.watch(VISIBLE_POLL_MS), [store]);

  const families: Family[] = ["claude", "codex"];
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      <ScrollView
        contentContainerStyle={{
          padding: layout.compact ? 16 : 28,
          gap: layout.compact ? 20 : 28,
          maxWidth: 820,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <View style={{ gap: 6 }}>
          <Text style={[text.small, { fontWeight: "600", letterSpacing: 0.4 }]}>ZeroSub</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <Text style={text.title} accessibilityRole="header">
              Аккаунты подписок
            </Text>
            {state ? (
              <IconButton
                theme={theme}
                icon="RefreshCw"
                label="Обновить лимиты"
                tooltip="Обновить лимиты всех аккаунтов"
                tooltipPlacement="bottom"
                busy={refreshing}
                onPress={() => void refreshUsage()}
              />
            ) : null}
          </View>
          <Text style={text.muted}>
            Добавьте аккаунты Claude и ChatGPT. Каждый агент использует выбранный аккаунт, а при исчерпании лимита может продолжить работу на другом.
          </Text>
        </View>

        {multiHost ? <HostScope theme={theme} label={host.label} /> : null}

        {error && (offline || !state) ? (
          <Card theme={theme}>
            <Text style={text.danger}>
              {offline
                ? `Нет связи с ${host.label}. Аккаунты сохранены на этом хосте${
                    state ? "; показано последнее известное состояние." : "и появятся после восстановления связи."
                  }`
                : `Не удалось подключиться к демону: ${error}`}
            </Text>
            <Button
              theme={theme}
              label="Повторить"
              icon="RefreshCw"
              tooltip="Загрузить аккаунты с этого хоста ещё раз"
              tooltipAlign="start"
              onPress={() => void store.refresh()}
            />
          </Card>
        ) : null}

        {state?.warnings.map((warning) => (
          <Card theme={theme} key={warning}>
            <Text style={text.warning}>{warning}</Text>
          </Card>
        ))}

        {!state && !error ? <Text style={text.muted}>Загрузка аккаунтов…</Text> : null}

        {state
          ? families.map((family) => (
              <FamilySection
                key={family}
                family={family}
                accounts={state.accounts.filter((account) => account.family === family)}
                theme={theme}
                compact={layout.compact}
                store={store}
                onAdd={() => setAdding({ family })}
                onSignIn={(account) => setAdding({ family, accountId: account.id })}
              />
            ))
          : null}

        <AutomationSettings theme={theme} />
      </ScrollView>

      {adding ? (
        <AddAccountModal
          theme={theme}
          layout={layout}
          host={host}
          multiHost={multiHost}
          store={store}
          family={adding.family}
          accountId={adding.accountId}
          onClose={() => setAdding(null)}
        />
      ) : null}
    </View>
  );
}

/** Says whose accounts these are when the app knows several hosts. */
function HostScope({ theme, label }: { theme: Theme; label: string }) {
  const text = useText(theme);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface1,
      }}
    >
      <Icon name="Server" size={16} color={theme.colors.foregroundMuted} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={text.strong}>Аккаунты на {label}</Text>
        <Text style={text.small}>
          Аккаунты и настройки хранятся отдельно на каждом хосте. Войдите на нужном хосте и переключайте хосты в верхнем меню.
        </Text>
      </View>
    </View>
  );
}

function FamilySection({
  family,
  accounts,
  theme,
  compact,
  store,
  onAdd,
  onSignIn,
}: {
  family: Family;
  accounts: AccountView[];
  theme: Theme;
  compact: boolean;
  store: ZeroSubStore;
  onAdd(): void;
  onSignIn(account: AccountView): void;
}) {
  const text = useText(theme);
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={text.heading} accessibilityRole="header">
          {family === "claude" ? "Claude" : "ChatGPT (Codex)"}
        </Text>
        <Button
          theme={theme}
          icon="Plus"
          label={compact ? "Add" : "Добавить аккаунт"}
          accessibilityLabel={`Добавить аккаунт ${FAMILY_LABEL[family]}`}
          tooltip={`Добавить ещё один аккаунт ${FAMILY_LABEL[family]}`}
          tooltipAlign="end"
          onPress={onAdd}
        />
      </View>
      {accounts.length === 0 ? (
        <Text style={text.muted}>Аккаунтов {FAMILY_LABEL[family]} пока нет.</Text>
      ) : null}
      {chunk(accounts, compact ? 1 : 2).map((row) => (
        <View key={row.map((account) => account.id).join()} style={{ flexDirection: "row", gap: 10 }}>
          {row.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              theme={theme}
              store={store}
              onSignIn={() => onSignIn(account)}
            />
          ))}
          {!compact && row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

function AccountCard({
  account,
  theme,
  store,
  onSignIn,
}: {
  account: AccountView;
  theme: Theme;
  store: ZeroSubStore;
  onSignIn(): void;
}) {
  const text = useText(theme);
  const toast = useToast();
  const [busy, setBusy] = useState<"default" | "remove" | "clear" | "toggle" | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [editingProxy, setEditingProxy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const resets = account.usage?.resets ?? null;
  const plan = formatPlan(account.plan);
  const summary = usageSummary(account);
  const subtitle = accountSubtitle(account);
  const signedOut = account.status === "signed_out";
  const disabled = account.status === "disabled";
  const faded = disabled ? { opacity: 0.55 } : null;
  const windows = account.usage?.windows ?? [];
  const agents = account.agentCount === 0 ? "Нет агентов" : `Агентов: ${account.agentCount}`;
  const freshness = !signedOut && account.usage && windows.length > 0 ? `обновлено ${formatAge(account.usage.fetchedAt)}` : null;

  // Sets the account aside for a while, or brings it back; its agents move off it and back.
  const toggle = useCallback(async () => {
    const enabling = account.status === "disabled";
    setBusy("toggle");
    try {
      const result = await store.rpc(setAccountEnabled, { accountId: account.id, enabled: enabling });
      const message = describeReopen(`${account.label}: ${enabling ? "включён" : "отключён"}`, result);
      const stayed =
        result.stayed > 0
          ? ` · Чатов ChatGPT на прежнем аккаунте: ${result.stayed}`
          : "";
      toast.show(`${message}${stayed}`, { variant: "success", durationMs: 5_000 });
    } catch (error) {
      toast.error(describe(error));
    } finally {
      setBusy(null);
    }
  }, [account, store, toast]);

  const makeDefault = useCallback(async () => {
    setBusy("default");
    try {
      const summary = await store.rpc(setDefaultAccount, { accountId: account.id });
      toast.show(describeReopen(`${account.label} выбран по умолчанию`, summary), { variant: "success" });
      await store.refresh();
    } catch (error) {
      toast.error(describe(error));
    } finally {
      setBusy(null);
    }
  }, [account, store, toast]);

  // For when the user knows better, e.g. after upgrading the plan or buying credits.
  const markAvailable = useCallback(async () => {
    setBusy("clear");
    try {
      await store.rpc(clearAccountLimit, { accountId: account.id });
      toast.show(`${account.label} снова доступен`, { variant: "success" });
    } catch (error) {
      toast.error(describe(error));
    } finally {
      setBusy(null);
    }
  }, [account, store, toast]);

  const remove = useCallback(async () => {
    setBusy("remove");
    try {
      const result = await store.rpc(removeAccount, { accountId: account.id });
      toast.show(
        result.movedAgents > 0
          ? `Удалён ${account.label}; переключено агентов: ${result.movedAgents}`
          : `Удалён ${account.label}`,
        { variant: "success" },
      );
      await store.refresh();
    } catch (error) {
      toast.error(describe(error));
    } finally {
      setBusy(null);
      setConfirmRemove(false);
    }
  }, [account, store, toast]);

  return (
    <Card theme={theme} fill>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={faded}>
          <Avatar theme={theme} label={account.label} />
        </View>
        <View style={[{ flex: 1, minWidth: 0, gap: 3 }, faded]}>
          <Text style={text.strong} numberOfLines={1}>
            {account.label}
          </Text>
          {subtitle ? (
            <Text style={text.small} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginTop: -4, marginRight: -6 }}>
          {account.status === "limited" ? (
            <IconButton
              theme={theme}
              icon="CircleCheck"
              label="Отметить доступным"
              tooltip="Использовать снова до сброса лимита, например после смены тарифа"
              busy={busy === "clear"}
              onPress={() => void markAvailable()}
            />
          ) : null}
          {!account.isDefault && !signedOut && !disabled ? (
            <IconButton
              theme={theme}
              icon="Star"
              label="По умолчанию"
              tooltip="Новые агенты будут использовать этот аккаунт"
              busy={busy === "default"}
              onPress={() => void makeDefault()}
            />
          ) : null}
          <IconButton
            theme={theme}
            icon={disabled ? "CirclePlay" : "CirclePause"}
            label={disabled ? "Включить аккаунт" : "Временно отключить аккаунт"}
            tooltip={
              disabled
                ? "Снова разрешить агентам использовать аккаунт"
                : "Отключить аккаунт и переключить поддерживаемые сессии на другие аккаунты"
            }
            busy={busy === "toggle"}
            onPress={() => void toggle()}
          />
          <IconButton theme={theme} icon="Globe" label="Прокси" tooltip="Настроить подключение аккаунта" onPress={() => setEditingProxy(true)} />
          <IconButton theme={theme} icon="Pencil" label="Переименовать" tooltip="Переименовать аккаунт" onPress={() => setRenaming(true)} />
          {account.kind !== "main" ? (
            <IconButton
              theme={theme}
              icon="Trash2"
              label="Удалить"
              tooltip="Выйти и удалить сохранённую авторизацию"
              tone="danger"
              busy={busy === "remove"}
              onPress={() => setConfirmRemove(true)}
            />
          ) : null}
        </View>
      </View>

      <View style={[{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }, faded]}>
        {account.proxy ? <Badge theme={theme} label={`${account.proxy.type.toUpperCase()} · ${account.proxy.host}:${account.proxy.port}`} /> : null}
        {account.isDefault ? <Badge theme={theme} label="По умолчанию" tone="accent" /> : null}
        {disabled ? <Badge theme={theme} label="Отключён" /> : null}
        {plan ? <Badge theme={theme} label={plan} /> : null}
        {account.kind === "main" ? <Badge theme={theme} label="Основной вход CLI" /> : null}
        {account.status === "limited" ? <Badge theme={theme} label="Лимит исчерпан" tone="danger" /> : null}
        {account.status === "signed_out" ? <Badge theme={theme} label="Требуется вход" tone="warning" /> : null}
        {resets && !signedOut ? <Badge theme={theme} label={resetBadge(resets)} tone="accent" /> : null}
      </View>

      <View style={[{ gap: 10 }, faded]}>
        {signedOut ? (
          <Text style={text.small}>Войдите заново, чтобы использовать аккаунт.</Text>
        ) : windows.length > 0 ? (
          windows.map((limit) => <UsageBar key={limit.id} theme={theme} limit={limit} />)
        ) : (
          <Text style={text.small}>{account.usage?.error ?? summary ?? "Проверка лимитов…"}</Text>
        )}
        {!signedOut && windows.length > 0 && account.usage?.error ? <Text style={text.small}>{account.usage.error}</Text> : null}
        {!signedOut && resets?.blockedReason ? <Text style={text.small}>{resets.blockedReason}</Text> : null}
      </View>

      {/* Pinned to the bottom, so cards side by side line up however much each one shows. */}
      <View
        style={{
          marginTop: "auto",
          minHeight: 38,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          columnGap: 8,
          rowGap: 8,
        }}
      >
        <Text style={[text.small, { flexShrink: 1 }]} numberOfLines={1}>
          {disabled ? "Отключён · не используется агентами" : freshness ? `${agents} · ${freshness}` : agents}
        </Text>
        {signedOut ? (
          <Button
            theme={theme}
            size="small"
            tone="primary"
            icon="LogIn"
            label="Войти"
            tooltip="Войти в аккаунт заново"
            tooltipAlign="end"
            onPress={onSignIn}
          />
        ) : disabled ? (
          <Button
            theme={theme}
            size="small"
            tone="primary"
            icon="CirclePlay"
            label="Включить"
            tooltip="Включить аккаунт и вернуть поддерживаемые сессии"
            tooltipAlign="end"
            busy={busy === "toggle"}
            onPress={() => void toggle()}
          />
        ) : resets ? (
          <Button
            theme={theme}
            size="small"
            tone={account.status === "limited" ? "primary" : "secondary"}
            icon="TimerReset"
            label="Сбросить лимиты"
            accessibilityLabel="Использовать запасной сброс"
            tooltip="Потратить запасной сброс для восстановления лимитов"
            tooltipAlign="end"
            disabled={!resets.usableNow}
            onPress={() => setConfirmReset(true)}
          />
        ) : null}
      </View>
      <Modal title="Использовать запасной сброс?" open={confirmReset} onOpenChange={setConfirmReset}>
        <Modal.Content>
          <ResetConfirm
            theme={theme}
            store={store}
            account={account}
            onCancel={() => setConfirmReset(false)}
            onFinished={(result) => {
              setConfirmReset(false);
              const { message, variant } = redeemToast(account.label, result);
              if (variant === "error") toast.error(message);
              else toast.show(message, { variant, durationMs: 5_000 });
            }}
          />
        </Modal.Content>
      </Modal>

      {editingProxy ? <ProxyModal theme={theme} account={account} store={store} onClose={() => setEditingProxy(false)} /> : null}
      {renaming ? (
        <RenameModal theme={theme} account={account} store={store} onClose={() => setRenaming(false)} />
      ) : null}
      <Modal title={`Удалить ${account.label}?`} open={confirmRemove} onOpenChange={setConfirmRemove}>
        <Modal.Content>
          <Text style={text.body}>
            {account.family === "claude"
              ? "Аккаунт выйдет из системы на этом хосте, сохранённая авторизация будет удалена. Агенты перейдут на аккаунт по умолчанию, история сохранится."
              : "Сохранённая авторизация будет удалена. Новые агенты используют аккаунт по умолчанию. Существующие чаты ChatGPT нельзя перенести: сначала создайте продолжение на другом аккаунте или архивируйте их."}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
            <Button theme={theme} label="Отмена" tooltip="Оставить аккаунт" tooltipAlign="end" onPress={() => setConfirmRemove(false)} />
            <Button
              theme={theme}
              tone="danger"
              icon="Trash2"
              label="Удалить"
              tooltip="Удалить сохранённую авторизацию аккаунта"
              tooltipAlign="end"
              busy={busy === "remove"}
              onPress={() => void remove()}
            />
          </View>
        </Modal.Content>
      </Modal>
    </Card>
  );
}

function RenameModal({
  theme,
  account,
  store,
  onClose,
}: {
  theme: Theme;
  account: AccountView;
  store: ZeroSubStore;
  onClose(): void;
}) {
  const text = useText(theme);
  const toast = useToast();
  const [label, setLabel] = useState(account.label);
  const [saving, setSaving] = useState(false);
  const save = useCallback(async () => {
    const next = label.trim();
    if (!next) return;
    setSaving(true);
    try {
      await store.rpc(renameAccount, { accountId: account.id, label: next });
      await store.refresh();
      onClose();
    } catch (error) {
      toast.error(describe(error));
    } finally {
      setSaving(false);
    }
  }, [label, account.id, store, onClose, toast]);
  const inputStyle = useMemo(
    () => ({
      color: theme.colors.foreground,
      backgroundColor: theme.colors.surface2,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
    }),
    [theme],
  );
  return (
    <Modal title="Переименовать аккаунт" open onOpenChange={(open) => (open ? undefined : onClose())}>
      <Modal.Content>
        <Text style={text.muted}>Короткое понятное название, например «Рабочий» или «Личный».</Text>
        <TextInput
          value={label}
          onChangeText={setLabel}
          autoFocus
          maxLength={40}
          placeholder="Название аккаунта"
          placeholderTextColor={theme.colors.foregroundMuted}
          onSubmitEditing={() => void save()}
          style={inputStyle}
          accessibilityLabel="Название аккаунта"
        />
        <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
          <Button theme={theme} label="Отмена" tooltip="Оставить прежнее название" tooltipAlign="end" onPress={onClose} />
          <Button
            theme={theme}
            tone="primary"
            label="Сохранить"
            tooltip="Сохранить название"
            tooltipAlign="end"
            busy={saving}
            disabled={!label.trim()}
            onPress={() => void save()}
          />
        </View>
      </Modal.Content>
    </Modal>
  );
}

function Avatar({ theme, label }: { theme: Theme; label: string }) {
  const initial = label.trim().charAt(0).toUpperCase() || "?";
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.colors.surface2,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Text style={{ color: theme.colors.foreground, fontSize: 15, fontWeight: "700" }}>{initial}</Text>
    </View>
  );
}

function AutomationSettings({ theme }: { theme: Theme }) {
  const settings = useSettings(preferences);
  const text = useText(theme);
  if (settings.status === "loading") return null;
  if (settings.status !== "ready") {
    return <Text style={text.danger}>Настройки недоступны: {settings.error}</Text>;
  }
  const save = (patch: Partial<typeof settings.values>) =>
    void settings.save({ ...settings.values, ...patch }, settings.revision);
  return (
    <View style={{ gap: 10 }}>
      <Text style={text.heading} accessibilityRole="header">
        Автоматическое переключение
      </Text>
      <SettingsCard>
        <SettingsSwitch
          label="Переключать при исчерпании лимита"
          hint="Агенты переходят на аккаунт с наибольшим остатком лимита."
          value={settings.values.autoSwitch}
          disabled={settings.saving}
          onValueChange={(autoSwitch) => save({ autoSwitch })}
        />
        <SettingsSwitch
          label="Продолжать после переключения"
          hint="Отправляет сообщение для продолжения прерванной задачи."
          value={settings.values.autoContinue}
          disabled={settings.saving || !settings.values.autoSwitch}
          onValueChange={(autoContinue) => save({ autoContinue })}
        />
        <SettingsSwitch
          label="Распределять новых агентов по аккаунтам"
          hint="Новый агент выбирает аккаунт с наибольшим остатком лимита."
          value={settings.values.balanceNewAgents}
          disabled={settings.saving}
          onValueChange={(balanceNewAgents) => save({ balanceNewAgents })}
        />
        <SettingsSwitch
          label="Переключать открытых агентов при смене аккаунта по умолчанию"
          hint="Если выключено, открытые агенты сохраняют свой аккаунт. Новые и закрытые сессии используют новый аккаунт по умолчанию."
          value={settings.values.moveAgentsOnDefaultChange}
          disabled={settings.saving}
          onValueChange={(moveAgentsOnDefaultChange) => save({ moveAgentsOnDefaultChange })}
        />
        <SettingsSwitch
          label="Использовать запасные сбросы, когда лимиты исчерпаны везде"
          hint="Автоматически тратит запасной сброс вместо остановки. По умолчанию выключено."
          value={settings.values.autoRedeem}
          disabled={settings.saving || !settings.values.autoSwitch}
          onValueChange={(autoRedeem) => save({ autoRedeem })}
        />
        <SettingsSwitch
          label="Продолжать у другого провайдера при исчерпании всех лимитов"
          hint="Создаёт продолжение разговора в ChatGPT вместо Claude или наоборот. Права нового агента не расширяются; исходный чат сохраняется."
          value={settings.values.forkOtherProvider}
          disabled={settings.saving || !settings.values.autoSwitch}
          onValueChange={(forkOtherProvider) => save({ forkOtherProvider })}
        />
      </SettingsCard>
      {settings.saveError ? <Text style={text.danger}>{settings.saveError}</Text> : null}
    </View>
  );
}

export function describeReopen(prefix: string, summary: ReopenSummary): string {
  const parts = [prefix];
  if (summary.continuedIn) parts.push(`продолжение в «${summary.continuedIn.title}»`);
  if (summary.reopened.length > 0) parts.push(`${summary.reopened.length} агентов переключено`);
  if (summary.deferred.length > 0) parts.push(`${summary.deferred.length} переключатся после текущего ответа`);
  if (summary.failed.length > 0) parts.push(`${summary.failed.length} переключатся при перезапуске`);
  return parts.join(" · ");
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

