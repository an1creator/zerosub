import { useLanguage } from "./i18n";
import { t } from "../shared/i18n";
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
  useLanguage();
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
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <Text style={text.title} accessibilityRole="header">{t("index.client.001")}</Text>
            {state ? (
              <IconButton
                theme={theme}
                icon="RefreshCw"
                label={t("accounts-surface.001")}
                tooltip={t("accounts-surface.002")}
                tooltipPlacement="bottom"
                busy={refreshing}
                onPress={() => void refreshUsage()}
              />
            ) : null}
          </View>
          <Text style={text.muted}>{t("accounts-surface.003")}</Text>
        </View>

        {multiHost ? <HostScope theme={theme} label={host.label} /> : null}

        {error && (offline || !state) ? (
          <Card theme={theme}>
            <Text style={text.danger}>
              {offline
                ? t("accounts-surface.004", { v0: host.label, v1: state ? t("accounts-surface.082") : t("accounts-surface.083") })
                : t("accounts-surface.005", { v0: error })}
            </Text>
            <Button
              theme={theme}
              label={t("accounts-surface.006")}
              icon="RefreshCw"
              tooltip={t("accounts-surface.007")}
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

        {!state && !error ? <Text style={text.muted}>{t("accounts-surface.008")}</Text> : null}

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
  useLanguage();
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
        <Text style={text.strong}>{t("accounts-surface.009", { v0: label })}</Text>
        <Text style={text.small}>{t("accounts-surface.010")}</Text>
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
  useLanguage();
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
          label={compact ? "Add" : t("accounts-surface.011")}
          accessibilityLabel={t("accounts-surface.012", { v0: FAMILY_LABEL[family] })}
          tooltip={t("accounts-surface.013", { v0: FAMILY_LABEL[family] })}
          tooltipAlign="end"
          onPress={onAdd}
        />
      </View>
      {accounts.length === 0 ? (
        <Text style={text.muted}>{t("accounts-surface.014", { v0: FAMILY_LABEL[family] })}</Text>
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
  useLanguage();
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
  const agents = account.agentCount === 0 ? t("accounts-surface.015") : t("accounts-surface.016", { v0: account.agentCount });
  const freshness = !signedOut && account.usage && windows.length > 0 ? formatAge(account.usage.fetchedAt) : null;

  // Sets the account aside for a while, or brings it back; its agents move off it and back.
  const toggle = useCallback(async () => {
    const enabling = account.status === "disabled";
    setBusy("toggle");
    try {
      const result = await store.rpc(setAccountEnabled, { accountId: account.id, enabled: enabling });
      const message = describeReopen(`${account.label}: ${enabling ? t("accounts-surface.017") : t("accounts-surface.018")}`, result);
      const stayed =
        result.stayed > 0
          ? t("accounts-surface.019", { v0: result.stayed })
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
      toast.show(describeReopen(t("accounts-surface.020", { v0: account.label }), summary), { variant: "success" });
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
      toast.show(t("accounts-surface.021", { v0: account.label }), { variant: "success" });
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
          ? t("accounts-surface.022", { v0: account.label, v1: result.movedAgents })
          : t("accounts-surface.023", { v0: account.label }),
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
              label={t("accounts-surface.024")}
              tooltip={t("accounts-surface.025")}
              busy={busy === "clear"}
              onPress={() => void markAvailable()}
            />
          ) : null}
          {!account.isDefault && !signedOut && !disabled ? (
            <IconButton
              theme={theme}
              icon="Star"
              label={t("accounts-surface.026")}
              tooltip={t("accounts-surface.027")}
              busy={busy === "default"}
              onPress={() => void makeDefault()}
            />
          ) : null}
          <IconButton
            theme={theme}
            icon={disabled ? "CirclePlay" : "CirclePause"}
            label={disabled ? t("accounts-surface.028") : t("accounts-surface.029")}
            tooltip={
              disabled
                ? t("accounts-surface.030")
                : t("accounts-surface.031")
            }
            busy={busy === "toggle"}
            onPress={() => void toggle()}
          />
          <IconButton theme={theme} icon="Globe" label={t("accounts-surface.032")} tooltip={t("accounts-surface.033")} onPress={() => setEditingProxy(true)} />
          <IconButton theme={theme} icon="Pencil" label={t("accounts-surface.034")} tooltip={t("accounts-surface.035")} onPress={() => setRenaming(true)} />
          {account.kind !== "main" ? (
            <IconButton
              theme={theme}
              icon="Trash2"
              label={t("accounts-surface.036")}
              tooltip={t("accounts-surface.037")}
              tone="danger"
              busy={busy === "remove"}
              onPress={() => setConfirmRemove(true)}
            />
          ) : null}
        </View>
      </View>

      <View style={[{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }, faded]}>
        {account.proxy ? <Badge theme={theme} label={`${account.proxy.type.toUpperCase()} · ${account.proxy.host}:${account.proxy.port}`} /> : null}
        {account.isDefault ? <Badge theme={theme} label={t("accounts-surface.026")} tone="accent" /> : null}
        {disabled ? <Badge theme={theme} label={t("accounts-surface.038")} /> : null}
        {plan ? <Badge theme={theme} label={plan} /> : null}
        {account.kind === "main" ? <Badge theme={theme} label={t("accounts-surface.039")} /> : null}
        {account.status === "limited" ? <Badge theme={theme} label={t("accounts-surface.040")} tone="danger" /> : null}
        {account.status === "signed_out" ? <Badge theme={theme} label={t("accounts-surface.041")} tone="warning" /> : null}
        {resets && !signedOut ? <Badge theme={theme} label={resetBadge(resets)} tone="accent" /> : null}
      </View>

      <View style={[{ gap: 10 }, faded]}>
        {signedOut ? (
          <Text style={text.small}>{t("accounts-surface.042")}</Text>
        ) : windows.length > 0 ? (
          windows.map((limit) => <UsageBar key={limit.id} theme={theme} limit={limit} />)
        ) : (
          <Text style={text.small}>{account.usage?.error ?? summary ?? t("accounts-surface.043")}</Text>
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
          {disabled ? t("accounts-surface.044") : freshness ? `${agents} · ${freshness}` : agents}
        </Text>
        {signedOut ? (
          <Button
            theme={theme}
            size="small"
            tone="primary"
            icon="LogIn"
            label={t("accounts-surface.045")}
            tooltip={t("accounts-surface.046")}
            tooltipAlign="end"
            onPress={onSignIn}
          />
        ) : disabled ? (
          <Button
            theme={theme}
            size="small"
            tone="primary"
            icon="CirclePlay"
            label={t("accounts-surface.047")}
            tooltip={t("accounts-surface.048")}
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
            label={t("accounts-surface.049")}
            accessibilityLabel={t("accounts-surface.050")}
            tooltip={t("accounts-surface.051")}
            tooltipAlign="end"
            disabled={!resets.usableNow}
            onPress={() => setConfirmReset(true)}
          />
        ) : null}
      </View>
      <Modal title={t("accounts-surface.052")} open={confirmReset} onOpenChange={setConfirmReset}>
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
      <Modal title={t("accounts-surface.053", { v0: account.label })} open={confirmRemove} onOpenChange={setConfirmRemove}>
        <Modal.Content>
          <Text style={text.body}>
            {account.family === "claude"
              ? t("accounts-surface.054")
              : t("accounts-surface.055")}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
            <Button theme={theme} label={t("accounts-surface.056")} tooltip={t("accounts-surface.057")} tooltipAlign="end" onPress={() => setConfirmRemove(false)} />
            <Button
              theme={theme}
              tone="danger"
              icon="Trash2"
              label={t("accounts-surface.036")}
              tooltip={t("accounts-surface.058")}
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
  useLanguage();
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
    <Modal title={t("accounts-surface.035")} open onOpenChange={(open) => (open ? undefined : onClose())}>
      <Modal.Content>
        <Text style={text.muted}>{t("accounts-surface.059")}</Text>
        <TextInput
          value={label}
          onChangeText={setLabel}
          autoFocus
          maxLength={40}
          placeholder={t("accounts-surface.060")}
          placeholderTextColor={theme.colors.foregroundMuted}
          onSubmitEditing={() => void save()}
          style={inputStyle}
          accessibilityLabel={t("accounts-surface.060")}
        />
        <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
          <Button theme={theme} label={t("accounts-surface.056")} tooltip={t("accounts-surface.061")} tooltipAlign="end" onPress={onClose} />
          <Button
            theme={theme}
            tone="primary"
            label={t("accounts-surface.062")}
            tooltip={t("accounts-surface.063")}
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
  useLanguage();
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
  useLanguage();
  const settings = useSettings(preferences);
  const text = useText(theme);
  if (settings.status === "loading") return null;
  if (settings.status !== "ready") {
    return <Text style={text.danger}>{t("accounts-surface.064", { v0: settings.error })}</Text>;
  }
  const save = (patch: Partial<typeof settings.values>) =>
    void settings.save({ ...settings.values, ...patch }, settings.revision);
  return (
    <View style={{ gap: 10 }}>
      <Text style={text.heading} accessibilityRole="header">{t("accounts-surface.065")}</Text>
      <SettingsCard>
        <SettingsSwitch
          label={t("accounts-surface.066")}
          hint={t("accounts-surface.067")}
          value={settings.values.autoSwitch}
          disabled={settings.saving}
          onValueChange={(autoSwitch) => save({ autoSwitch })}
        />
        <SettingsSwitch
          label={t("accounts-surface.068")}
          hint={t("accounts-surface.069")}
          value={settings.values.autoContinue}
          disabled={settings.saving || !settings.values.autoSwitch}
          onValueChange={(autoContinue) => save({ autoContinue })}
        />
        <SettingsSwitch
          label={t("accounts-surface.070")}
          hint={t("accounts-surface.071")}
          value={settings.values.balanceNewAgents}
          disabled={settings.saving}
          onValueChange={(balanceNewAgents) => save({ balanceNewAgents })}
        />
        <SettingsSwitch
          label={t("accounts-surface.072")}
          hint={t("accounts-surface.073")}
          value={settings.values.moveAgentsOnDefaultChange}
          disabled={settings.saving}
          onValueChange={(moveAgentsOnDefaultChange) => save({ moveAgentsOnDefaultChange })}
        />
        <SettingsSwitch
          label={t("accounts-surface.074")}
          hint={t("accounts-surface.075")}
          value={settings.values.autoRedeem}
          disabled={settings.saving || !settings.values.autoSwitch}
          onValueChange={(autoRedeem) => save({ autoRedeem })}
        />
        <SettingsSwitch
          label={t("accounts-surface.076")}
          hint={t("accounts-surface.077")}
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
  if (summary.continuedIn) parts.push(t("accounts-surface.078", { v0: summary.continuedIn.title }));
  if (summary.reopened.length > 0) parts.push(t("accounts-surface.079", { v0: summary.reopened.length }));
  if (summary.deferred.length > 0) parts.push(t("accounts-surface.080", { v0: summary.deferred.length }));
  if (summary.failed.length > 0) parts.push(t("accounts-surface.081", { v0: summary.failed.length }));
  return parts.join(" · ");
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

