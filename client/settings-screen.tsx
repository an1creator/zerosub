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
  const settings = useSettings(preferences);
  const multiHost = useHosts().length > 1;
  const [prompt, setPrompt] = useState<string | null>(null);
  const muted = { color: theme.colors.foregroundMuted };
  if (settings.status === "loading") return <Text style={muted}>Загрузка…</Text>;
  if (settings.status !== "ready") {
    return (
      <SettingsSection title="Настройки">
        <Text style={{ color: theme.colors.statusDanger }}>{settings.error}</Text>
        <SettingsAction label="Повторить" actionLabel="Обновить" onPress={() => void settings.reload()} />
        {settings.status === "invalid" ? (
          <SettingsAction label="Вернуть настройки по умолчанию" actionLabel="Сбросить" onPress={() => void settings.reset()} />
        ) : null}
      </SettingsSection>
    );
  }
  const save = (patch: Partial<Preferences>) =>
    void settings.save({ ...settings.values, ...patch }, settings.revision);
  return (
    <>
      {multiHost ? (
        <Text style={muted}>Настройки для агентов на {host.label}. У каждого хоста свои аккаунты и настройки.</Text>
      ) : null}
      <SettingsSection title="Аккаунты">
        <SettingsCard>
          <SettingsAction
            label="Добавление, удаление и выбор основного аккаунта"
            actionLabel="Открыть аккаунты"
            onPress={onOpenAccounts}
          />
          <SettingsSwitch
            label="Переключать открытых агентов при смене аккаунта по умолчанию"
            hint="Если выключено, открытые агенты сохраняют свой аккаунт. Новые и закрытые сессии используют новый аккаунт по умолчанию."
            value={settings.values.moveAgentsOnDefaultChange}
            disabled={settings.saving}
            onValueChange={(moveAgentsOnDefaultChange) => save({ moveAgentsOnDefaultChange })}
          />
        </SettingsCard>
      </SettingsSection>
      <SettingsSection title="Автоматическое переключение">
        <SettingsCard>
          <SettingsSwitch
            label="Переключать при исчерпании лимита"
            hint="Агент переходит на аккаунт с наибольшим остатком лимита."
            value={settings.values.autoSwitch}
            disabled={settings.saving}
            onValueChange={(autoSwitch) => save({ autoSwitch })}
          />
          <SettingsSwitch
            label="Продолжать после переключения"
            hint="Отправляет указанное ниже сообщение для продолжения задачи."
            value={settings.values.autoContinue}
            disabled={settings.saving || !settings.values.autoSwitch}
            onValueChange={(autoContinue) => save({ autoContinue })}
          />
          <SettingsInput
            label="Сообщение для продолжения"
            initialValue={settings.values.continuePrompt}
            onChangeText={setPrompt}
            disabled={settings.saving || !settings.values.autoContinue}
            error={settings.saveError}
          />
          <SettingsAction
            label="Сохранить сообщение для продолжения"
            actionLabel="Сохранить"
            disabled={settings.saving || prompt === null || !prompt.trim()}
            onPress={() => {
              if (prompt?.trim()) save({ continuePrompt: prompt.trim() });
            }}
          />
          <SettingsAction
            label="Вернуть стандартное сообщение"
            actionLabel="Восстановить"
            disabled={settings.saving || settings.values.continuePrompt === DEFAULT_CONTINUE_PROMPT}
            onPress={() => save({ continuePrompt: DEFAULT_CONTINUE_PROMPT })}
          />
        </SettingsCard>
      </SettingsSection>
      <SettingsSection title="Новые агенты и поле ввода">
        <SettingsCard>
          <SettingsSwitch
            label="Распределять новых агентов по аккаунтам"
            hint="Новый агент выбирает аккаунт с наибольшим остатком лимита."
            value={settings.values.balanceNewAgents}
            disabled={settings.saving}
            onValueChange={(balanceNewAgents) => save({ balanceNewAgents })}
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
          <SettingsSwitch
            label="Показывать кнопку аккаунта в поле ввода"
            hint="Появляется у агентов Claude и Codex, когда добавлено два аккаунта или больше."
            value={settings.values.showComposerPill}
            disabled={settings.saving}
            onValueChange={(showComposerPill) => save({ showComposerPill })}
          />
        </SettingsCard>
      </SettingsSection>
    </>
  );
}
