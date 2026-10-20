import { useLanguage } from "./i18n";
import { t } from "../shared/i18n";
import { useHosts, useSettings, type PluginSurfaceProps } from "@getpaseo/plugin/client";
import {
  SettingsAction,
  SettingsCard,
  SettingsInput,
  SettingsSection,
  SettingsSwitch,
} from "@getpaseo/plugin/client/ui";
import { useState } from "react";
import { Text } from "react-native";
import { DEFAULT_CONTINUE_PROMPT, preferences, type Preferences } from "../shared/preferences";

/** Settings → Plugins → zerosub. Accounts themselves live in the sidebar surface. */
export function PreferencesScreen({ theme, host, onOpenAccounts }: PluginSurfaceProps & { onOpenAccounts(): void }) {
  useLanguage();
  const settings = useSettings(preferences);
  const multiHost = useHosts().length > 1;
  const [prompt, setPrompt] = useState<string | null>(null);
  const muted = { color: theme.colors.foregroundMuted };
  if (settings.status === "loading") return <Text style={muted}>{t("settings-screen.001")}</Text>;
  if (settings.status !== "ready") {
    return (
      <SettingsSection title={t("settings-screen.002")}>
        <Text style={{ color: theme.colors.statusDanger }}>{settings.error}</Text>
        <SettingsAction label={t("accounts-surface.006")} actionLabel={t("settings-screen.003")} onPress={() => void settings.reload()} />
        {settings.status === "invalid" ? (
          <SettingsAction label={t("settings-screen.004")} actionLabel={t("accounts-surface.049")} onPress={() => void settings.reset()} />
        ) : null}
      </SettingsSection>
    );
  }
  const save = (patch: Partial<Preferences>) =>
    void settings.save({ ...settings.values, ...patch }, settings.revision);
  return (
    <>
      {multiHost ? (
        <Text style={muted}>{t("settings-screen.005", { v0: host.label })}</Text>
      ) : null}
      <SettingsSection title={t("index.client.001")}>
        <SettingsCard>
          <SettingsAction
            label={t("settings-screen.006")}
            actionLabel={t("settings-screen.007")}
            onPress={onOpenAccounts}
          />
          <SettingsSwitch
            label={t("accounts-surface.072")}
            hint={t("accounts-surface.073")}
            value={settings.values.moveAgentsOnDefaultChange}
            disabled={settings.saving}
            onValueChange={(moveAgentsOnDefaultChange) => save({ moveAgentsOnDefaultChange })}
          />
        </SettingsCard>
      </SettingsSection>
      <SettingsSection title={t("accounts-surface.065")}>
        <SettingsCard>
          <SettingsSwitch
            label={t("accounts-surface.066")}
            hint={t("settings-screen.008")}
            value={settings.values.autoSwitch}
            disabled={settings.saving}
            onValueChange={(autoSwitch) => save({ autoSwitch })}
          />
          <SettingsSwitch
            label={t("accounts-surface.068")}
            hint={t("settings-screen.009")}
            value={settings.values.autoContinue}
            disabled={settings.saving || !settings.values.autoSwitch}
            onValueChange={(autoContinue) => save({ autoContinue })}
          />
          <SettingsInput
            label={t("settings-screen.010")}
            initialValue={settings.values.continuePrompt}
            onChangeText={setPrompt}
            disabled={settings.saving || !settings.values.autoContinue}
            error={settings.saveError}
          />
          <SettingsAction
            label={t("settings-screen.011")}
            actionLabel={t("accounts-surface.062")}
            disabled={settings.saving || prompt === null || !prompt.trim()}
            onPress={() => {
              if (prompt?.trim()) save({ continuePrompt: prompt.trim() });
            }}
          />
          <SettingsAction
            label={t("settings-screen.012")}
            actionLabel={t("settings-screen.013")}
            disabled={settings.saving || settings.values.continuePrompt === DEFAULT_CONTINUE_PROMPT}
            onPress={() => save({ continuePrompt: DEFAULT_CONTINUE_PROMPT })}
          />
        </SettingsCard>
      </SettingsSection>
      <SettingsSection title={t("settings-screen.014")}>
        <SettingsCard>
          <SettingsSwitch
            label={t("accounts-surface.070")}
            hint={t("accounts-surface.071")}
            value={settings.values.balanceNewAgents}
            disabled={settings.saving}
            onValueChange={(balanceNewAgents) => save({ balanceNewAgents })}
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
          <SettingsSwitch
            label={t("settings-screen.015")}
            hint={t("settings-screen.016")}
            value={settings.values.showComposerPill}
            disabled={settings.saving}
            onValueChange={(showComposerPill) => save({ showComposerPill })}
          />
        </SettingsCard>
      </SettingsSection>
    </>
  );
}
