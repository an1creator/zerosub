import { AccountPicker } from "./client/account-picker";
import { t, subscribeLanguage } from "./shared/i18n";
import { useLanguage } from "./client/i18n";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import type { PluginClientContext, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { AccountsSurface } from "./client/accounts-surface";
import { contributeCommands } from "./client/commands";
import { contributePills } from "./client/pills";
import { PreferencesScreen } from "./client/settings-screen";
import { createZeroSubStore } from "./client/store";
import { SwitchRowView } from "./client/switch-row";
import { SWITCH_ROW_KIND, SWITCH_ROW_VERSION, SwitchRowSchema } from "./shared/timeline";

export default function contribute(client: PluginClientContext) {
  const store = createZeroSubStore(client);
  store.start();

  client.addScreen({ id: "accounts", title: () => t("index.client.001"), Component: (props) => <AccountsSurface {...props} store={store} /> });
  client.addScreen({ id: "account-picker", title: () => t("index.client.001"), Component: (props) => <AccountPicker {...props} store={store} onManage={() => client.openScreen({ screenId: "accounts" })} /> });
  function AccountsSidebar(props: PluginSidebarItemProps) {
    useLanguage();
    return <SidebarRow icon="Users" label={t("index.client.001")} active={props.currentScreen?.screenId === "accounts"} onPress={() => props.openScreen({ screenId: "accounts" })} />;
  }
  const registerSidebar = () => client.addSidebarHeaderItem({ id: "accounts", title: t("index.client.001"), Component: AccountsSidebar });
  const registerSettings = () => client.addSettingsScreen({
    id: "preferences",
    title: t("index.client.002"),
    icon: "SlidersHorizontal",
    Component: (props) => (
      <PreferencesScreen {...props} onOpenAccounts={() => client.openSurface("accounts")} />
    ),
  });
  client.addTimelineRenderer({
    kind: SWITCH_ROW_KIND,
    version: SWITCH_ROW_VERSION,
    schema: SwitchRowSchema,
    Component: SwitchRowView,
  });

  let stopSidebar = registerSidebar();
  let stopSettings = registerSettings();
  let stopCommands = contributeCommands(client, store);
  const stopLanguage = subscribeLanguage(() => {
    stopSidebar(); stopSettings(); stopCommands();
    stopSidebar = registerSidebar();
    stopSettings = registerSettings();
    stopCommands = contributeCommands(client, store);
  });
  const stopPills = contributePills(client, store);

  return () => {
    stopLanguage();
    stopSidebar();
    stopSettings();
    stopPills();
    stopCommands();
    store.stop();
  };
}
