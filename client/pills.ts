import { t, subscribeLanguage } from "../shared/i18n";
import type {
  PluginButton,
  PluginButtonRegistration,
  PluginClientContext,
} from "@getpaseo/plugin/client";
import { shortLabel } from "../shared/format";
import { type Family, type StateView } from "../shared/model";
import type { ZeroSubStore } from "./store";

/** The most agents Paseo returns per page. */
const PAGE_SIZE = 200;
const MAX_PAGES = 10;

interface TrackedAgent {
  id: string;
  workspaceId: string;
  provider: string;
}

/**
 * One composer pill per Claude/Codex agent showing the account it runs on. Tapping it opens a menu
 * of that provider's accounts. Pills only appear once a provider has more than one account, so a
 * single-account setup looks exactly like stock Paseo.
 */
export function contributePills(client: PluginClientContext, store: ZeroSubStore): () => void {
  const agents = new Map<string, TrackedAgent>();
  const pills = new Map<string, { registration: PluginButtonRegistration; key: string }>();
  const lifetime = new AbortController();
  let stopped = false;

  function sync(): void {
    if (stopped) return;
    const state = store.current.state;
    for (const [agentId, pill] of pills) {
      if (!agents.has(agentId)) {
        pill.registration.remove();
        pills.delete(agentId);
      }
    }
    for (const agent of agents.values()) {
      const button = state ? buttonFor(client, store, state, agent) : null;
      const existing = pills.get(agent.id);
      if (!button) {
        existing?.registration.remove();
        pills.delete(agent.id);
        continue;
      }
      const key = JSON.stringify([button.label, button.title, button.icon, []]);
      if (existing) {
        if (existing.key !== key) {
          existing.registration.update(button);
          existing.key = key;
        }
        continue;
      }
      try {
        const registration = client.addComposerPill({
          id: "account",
          workspaceId: agent.workspaceId,
          agentId: agent.id,
          button,
        });
        pills.set(agent.id, { registration, key });
      } catch (error) {
        console.warn("[ZeroSub] could not add account pill", error);
      }
    }
  }

  const unsubscribeStore = store.subscribe(sync);
  const unsubscribeLanguage = subscribeLanguage(sync);

  const track = (agent: { id: string; workspaceId?: string | null; provider: string }) => {
    if (!agent.workspaceId) return;
    agents.set(agent.id, { id: agent.id, workspaceId: agent.workspaceId, provider: agent.provider });
  };

  // The subscription covers the newest page and every later change. Older agents come from the
  // remaining pages, so an agent that has been idle for a while still gets its pill.
  const newestFirst = () => [{ key: "updated_at" as const, direction: "desc" as const }];
  let snapshots = 0;
  async function loadOlder(cursor: string | null, generation: number): Promise<void> {
    for (let page = 1; cursor && page < MAX_PAGES; page += 1) {
      const result = await client.paseo.agents.list({
        signal: lifetime.signal,
        sort: newestFirst(),
        page: { limit: PAGE_SIZE, cursor },
      });
      if (stopped || generation !== snapshots) return;
      for (const { agent } of result.entries) track(agent);
      sync();
      cursor = result.pageInfo.hasMore ? (result.pageInfo.nextCursor ?? null) : null;
    }
  }

  void client.paseo.agents
    .list({ subscribe: {}, signal: lifetime.signal, sort: newestFirst(), page: { limit: PAGE_SIZE } })
    .then(({ subscription }) => {
      subscription.subscribe({
        snapshot: ({ entries, pageInfo }) => {
          const generation = ++snapshots;
          agents.clear();
          for (const { agent } of entries) track(agent);
          sync();
          const next = pageInfo.hasMore ? (pageInfo.nextCursor ?? null) : null;
          void loadOlder(next, generation).catch((error: unknown) => {
            if (!stopped) console.warn("[ZeroSub] could not list older agents", error);
          });
        },
        update: (message) => {
          if (message.type !== "agent_update") return;
          const update = message.payload;
          if (update.kind === "remove") agents.delete(update.agentId);
          else {
            const known = agents.has(update.agent.id);
            track(update.agent);
            // A new agent may have been routed by the daemon a moment ago; fetch its account.
            if (!known) void store.refresh();
          }
          sync();
        },
      });
      return undefined;
    })
    .catch((error: unknown) => {
      if (!stopped) console.error("[ZeroSub] agent observation failed", error);
    });

  return () => {
    stopped = true;
    lifetime.abort();
    unsubscribeLanguage();
    unsubscribeStore();
    for (const pill of pills.values()) pill.registration.remove();
    pills.clear();
  };
}

export function buttonFor(
  client: PluginClientContext,
  store: ZeroSubStore,
  state: StateView,
  agent: TrackedAgent,
): PluginButton | null {
  if (!state.showComposerPill) return null;
  const family = state.providers[agent.provider];
  if (!family) return null;
  const accounts = state.accounts.filter((account) => account.family === family);
  const route = state.agents.find((entry) => entry.agentId === agent.id);
  const current =
    accounts.find((account) => account.id === route?.accountId) ??
    accounts.find((account) => account.isDefault) ??
    accounts[0];
  if (!current) return null;
  // A banked reset is worth offering right where the agent stopped, even with a single account.
  const resets = current.usage?.resets ?? null;
  const offerReset = resets !== null && (current.status === "limited" || resets.usableNow);
  // With every account of this provider out, the work can carry on with the other provider.
  const other: Family = family === "claude" ? "codex" : "claude";
  const offerFork =
    current.status === "limited" &&
    accounts.every((account) => account.status === "limited" || account.status === "signed_out" || account.status === "disabled") &&
    state.accounts.some((account) => account.family === other && account.status === "ready");
  if (accounts.length < 2 && !(current.status === "limited" && (offerReset || offerFork))) return null;

  const pending = route?.pendingAccountId ? t("pills.007") : "";
  return {
    title: t("pills.008", { v0: current.label, v1: current.email && current.email !== current.label ? ` (${current.email})` : "" }),
    icon: current.status === "limited" ? "CircleAlert" : "CircleUserRound",
    label: `${shortLabel(current)}${pending}`,
    behavior: { kind: "action", onPress: () => client.openScreen({ screenId: "account-picker", params: { agentId: agent.id, workspaceId: agent.workspaceId } }) },
  };
}
