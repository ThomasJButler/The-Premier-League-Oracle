<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { pushState } from '$app/navigation';
  import KickerShell from '$lib/components/shell/KickerShell.svelte';
  import MobileHeader from '$lib/components/shell/MobileHeader.svelte';
  import MobileNav from '$lib/components/shell/MobileNav.svelte';
  import MobilePersonaPill from '$lib/components/persona/MobilePersonaPill.svelte';
  import PunditPickerCard from '$lib/components/persona/PunditPickerCard.svelte';
  import PrefToggle from '$lib/components/settings/PrefToggle.svelte';
  import Rule from '$lib/components/atoms/Rule.svelte';
  import TierBadge from '$lib/components/paywall/TierBadge.svelte';
  import UpgradeModal from '$lib/components/paywall/UpgradeModal.svelte';
  import { personaStore } from '$lib/stores/persona';
  import { entitlementsStore, TIERS } from '$lib/stores/entitlementsStore';
  import { KICKER_PERSONA_ORDER, PERSONAS, type PersonaId } from '$lib/personas';
  import { ANTHROPIC_API_KEY_STORAGE_KEY } from '$lib/constants';
  import { demoModeStore, setDemoMode } from '$lib/demo/demoMode';

  const FOOTBALL_DATA_KEY = 'football_data_api_key';
  const NOTIFICATIONS_KEY = 'kicker:notifications';

  interface NotificationPrefs {
    matchStart: boolean;
    modelEdge: boolean;
    broadsheetReady: boolean;
  }

  const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
    matchStart: false,
    modelEdge: false,
    broadsheetReady: false
  };

  let footballDataKey = $state('');
  let anthropicKey = $state('');
  let notifications = $state<NotificationPrefs>({ ...DEFAULT_NOTIFICATIONS });

  function persistFootballDataKey(value: string): void {
    if (typeof localStorage === 'undefined') return;
    if (value) localStorage.setItem(FOOTBALL_DATA_KEY, value);
    else localStorage.removeItem(FOOTBALL_DATA_KEY);
  }

  function persistAnthropicKey(value: string): void {
    if (typeof localStorage === 'undefined') return;
    if (value) localStorage.setItem(ANTHROPIC_API_KEY_STORAGE_KEY, value);
    else localStorage.removeItem(ANTHROPIC_API_KEY_STORAGE_KEY);
  }

  // API keys are read by the salvaged services in their constructors
  // (footballData.ts, etc.) so changes only take effect on next page load.
  // Save + Remove both write localStorage and then reload so the user
  // sees the new state reflected app-wide immediately.
  function saveFootballDataKey(): void {
    persistFootballDataKey(footballDataKey.trim());
    if (typeof window !== 'undefined') window.location.reload();
  }

  function removeFootballDataKey(): void {
    footballDataKey = '';
    persistFootballDataKey('');
    if (typeof window !== 'undefined') window.location.reload();
  }

  function saveAnthropicKey(): void {
    persistAnthropicKey(anthropicKey.trim());
    if (typeof window !== 'undefined') window.location.reload();
  }

  function removeAnthropicKey(): void {
    anthropicKey = '';
    persistAnthropicKey('');
    if (typeof window !== 'undefined') window.location.reload();
  }

  function persistNotifications(next: NotificationPrefs): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
  }

  function setNotification<K extends keyof NotificationPrefs>(
    key: K,
    value: NotificationPrefs[K]
  ): void {
    notifications = { ...notifications, [key]: value };
    persistNotifications(notifications);
  }

  function hydrateFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    footballDataKey = localStorage.getItem(FOOTBALL_DATA_KEY) ?? '';
    anthropicKey = localStorage.getItem(ANTHROPIC_API_KEY_STORAGE_KEY) ?? '';
    const rawNotif = localStorage.getItem(NOTIFICATIONS_KEY);
    if (rawNotif) {
      try {
        const parsed = JSON.parse(rawNotif) as Partial<NotificationPrefs>;
        notifications = { ...DEFAULT_NOTIFICATIONS, ...parsed };
      } catch {
        notifications = { ...DEFAULT_NOTIFICATIONS };
      }
    }
  }

  type TabId = 'pundit' | 'api' | 'display' | 'account' | 'notifications' | 'privacy';

  interface TabSpec {
    id: TabId;
    label: string;
    sub: string;
  }

  const TABS: readonly TabSpec[] = [
    { id: 'pundit', label: 'Your Pundit', sub: 'Voice cast · 10 personas' },
    { id: 'api', label: 'API & data', sub: 'Football-Data · Anthropic' },
    { id: 'display', label: 'Display', sub: 'Light · comfortable' },
    { id: 'account', label: 'Account', sub: 'Touchline tier' },
    { id: 'notifications', label: 'Notifications', sub: 'Match alerts' },
    { id: 'privacy', label: 'Privacy', sub: 'Data & tracking' }
  ] as const;

  const VALID_TABS = new Set<TabId>(TABS.map((t) => t.id));

  let activeTab = $state<TabId>('pundit');

  function isTabId(v: string): v is TabId {
    return VALID_TABS.has(v as TabId);
  }

  function setTab(id: TabId): void {
    activeTab = id;
    if (typeof window !== 'undefined' && window.location.hash !== `#${id}`) {
      pushState(`#${id}`, {});
    }
  }

  function syncFromHash(): void {
    if (typeof window === 'undefined') return;
    const raw = window.location.hash.slice(1);
    activeTab = raw && isTabId(raw) ? raw : 'pundit';
  }

  onMount(() => {
    syncFromHash();
    hydrateFromStorage();
    window.addEventListener('hashchange', syncFromHash);
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('hashchange', syncFromHash);
    }
  });

  const personaId = $derived($personaStore as PersonaId);
  const activePersona = $derived(PERSONAS[personaId]);

  let upgradeOpen = $state(false);
  const activeTier = $derived($entitlementsStore);
  const activeTierSpec = $derived(TIERS.find((t) => t.id === activeTier) ?? TIERS[0]);
</script>

{#snippet subNav()}
  <nav aria-label="Settings sections" data-settings-subnav>
    <ul
      class="flex lg:flex-col gap-2 lg:gap-0.5 overflow-x-auto lg:overflow-visible -mx-4 px-4 lg:mx-0 lg:px-0"
      data-settings-subnav-list
    >
      {#each TABS as tab (tab.id)}
        {@const isActive = tab.id === activeTab}
        <li class="shrink-0 lg:shrink lg:w-full">
          <button
            type="button"
            data-subnav-id={tab.id}
            aria-current={isActive ? 'page' : undefined}
            class="kicker-subnav__row w-auto lg:w-full text-left px-3 py-2.5 transition-colors"
            class:is-active={isActive}
            onclick={() => setTab(tab.id)}
          >
            <span
              class="block font-sans text-[13px] font-semibold leading-tight"
              data-subnav-label
            >
              {tab.label}
            </span>
            <span
              class="block font-serif italic text-[10px] mt-0.5"
              data-subnav-sub
            >
              {tab.sub}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  </nav>
{/snippet}

{#snippet panelPundit()}
  <section data-tab-panel="pundit">
    <Rule
      kicker="YOUR PUNDIT · PICK ONE"
      title="Who writes your morning paper?"
      action="LIVE SWITCH"
    />
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-6" data-pundit-grid>
      {#each KICKER_PERSONA_ORDER as id (id)}
        <PunditPickerCard
          persona={PERSONAS[id]}
          selected={personaId === id}
          locked={activeTier === 'touchline' && id !== 'voice'}
          onclick={(next) => personaStore.set(next)}
          onLockedClick={() => (upgradeOpen = true)}
        />
      {/each}
    </div>
    <p
      class="font-serif italic text-[12px] text-ink-soft"
      data-pundit-active-line
    >
      Active: <span class="font-bold not-italic">{activePersona.name}</span> —
      "{activePersona.tic}"
    </p>
  </section>
{/snippet}

{#snippet panelApi()}
  <section data-tab-panel="api">
    <Rule kicker="API & DATA" title="Connections" action="LOCAL ONLY" />
    <div class="grid grid-cols-1 gap-4 mb-6" data-api-fields>
      <div class="flex flex-col gap-1" data-field="football-data">
        <label for="kicker-input-football-data" class="font-sans text-[9px] tracking-[0.25em] font-bold text-red">
          FOOTBALL-DATA.ORG API KEY
        </label>
        <input
          id="kicker-input-football-data"
          type="password"
          autocomplete="off"
          placeholder="paste key — saved to this device only"
          class="kicker-input font-mono text-[13px] px-3 py-2 border border-rule bg-paper-inset"
          data-input-football-data
          bind:value={footballDataKey}
        />
        <div class="flex gap-2 mt-1" data-actions="football-data">
          <button
            type="button"
            class="font-sans text-[10px] tracking-[0.25em] font-bold uppercase bg-ink text-paper px-3 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
            data-action="save-football-data"
            disabled={!footballDataKey.trim()}
            onclick={saveFootballDataKey}
          >
            Save & reload
          </button>
          <button
            type="button"
            class="font-sans text-[10px] tracking-[0.25em] font-bold uppercase bg-paper-inset text-ink-dim border border-rule px-3 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
            data-action="remove-football-data"
            disabled={!footballDataKey.trim()}
            onclick={removeFootballDataKey}
          >
            Remove
          </button>
        </div>
        <span class="font-serif italic text-[11px] text-ink-dim mt-1">
          Stored in this browser only. Falls back to
          <code class="font-mono">VITE_FOOTBALL_DATA_API_KEY</code> when empty.
        </span>
      </div>
      <div class="flex flex-col gap-1" data-field="anthropic">
        <label for="kicker-input-anthropic" class="font-sans text-[9px] tracking-[0.25em] font-bold text-red">
          ANTHROPIC API KEY · OPTIONAL
        </label>
        <input
          id="kicker-input-anthropic"
          type="password"
          autocomplete="off"
          placeholder="bring-your-own-key (Touchline tier)"
          class="kicker-input font-mono text-[13px] px-3 py-2 border border-rule bg-paper-inset"
          data-input-anthropic
          bind:value={anthropicKey}
        />
        <div class="flex gap-2 mt-1" data-actions="anthropic">
          <button
            type="button"
            class="font-sans text-[10px] tracking-[0.25em] font-bold uppercase bg-ink text-paper px-3 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
            data-action="save-anthropic"
            disabled={!anthropicKey.trim()}
            onclick={saveAnthropicKey}
          >
            Save & reload
          </button>
          <button
            type="button"
            class="font-sans text-[10px] tracking-[0.25em] font-bold uppercase bg-paper-inset text-ink-dim border border-rule px-3 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
            data-action="remove-anthropic"
            disabled={!anthropicKey.trim()}
            onclick={removeAnthropicKey}
          >
            Remove
          </button>
        </div>
        <span class="font-serif italic text-[11px] text-ink-dim mt-1">
          Server-held key used by default. Saved locally for future bring-your-own-key support.
        </span>
      </div>
    </div>
  </section>
{/snippet}

{#snippet panelDisplay()}
  <section data-tab-panel="display">
    <Rule kicker="DISPLAY" title="Paper feel" action="LIGHT THEME" />
    <p class="font-serif text-[14px] leading-relaxed text-ink-soft" data-display-copy>
      The Kicker is a daylight publication. Dark mode is intentionally not
      shipped — newsprint cream is the design contract.
    </p>
    <div class="mt-6 border border-rule bg-paper-warm p-4" data-demo-mode-row>
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="font-mono text-[10px] tracking-[0.18em] text-red mb-1">DEMO MODE</div>
          <div class="font-serif text-[15px] text-ink mb-1">Sample fixtures &amp; standings</div>
          <p class="font-serif text-[13px] italic leading-relaxed text-ink-soft m-0">
            Renders every route against bundled sample data — 10 Gameweek 35 fixtures,
            full table, top scorers, predictions. Useful for screenshots and previewing
            the paper before adding a Football-Data API key.
          </p>
        </div>
        <button
          type="button"
          onclick={() => setDemoMode(!$demoModeStore)}
          class="shrink-0 border-2 border-ink px-4 py-2 font-mono text-[11px] tracking-[0.18em]"
          class:bg-ink={$demoModeStore}
          class:text-paper={$demoModeStore}
          class:bg-paper={!$demoModeStore}
          class:text-ink={!$demoModeStore}
          data-demo-mode-toggle
        >
          {$demoModeStore ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  </section>
{/snippet}

{#snippet panelAccount()}
  <section data-tab-panel="account">
    <Rule kicker="ACCOUNT" title="Your tier" action="MOCK · MVP" />
    <div
      class="flex flex-col gap-3 mb-4 border border-rule bg-paper-warm p-4"
      data-account-tier-panel
    >
      <div class="flex items-center justify-between gap-3">
        <div>
          <p
            class="font-sans text-[9px] tracking-[0.3em] font-bold text-red uppercase"
            data-account-tier-kicker
          >
            CURRENT TIER
          </p>
          <p
            class="font-serif text-[22px] font-bold leading-tight text-ink mt-0.5"
            data-account-tier-label
          >
            {activeTierSpec.label}
          </p>
          <p
            class="font-serif italic text-[12px] text-ink-soft mt-0.5"
            data-account-tier-tagline
          >
            {activeTierSpec.tagline}
          </p>
        </div>
        <TierBadge tier={activeTier} size="md" />
      </div>
      <ul
        class="flex flex-col gap-1 font-serif text-[13px] text-ink-soft"
        data-account-tier-perks
      >
        {#each activeTierSpec.perks as perk}
          <li class="flex gap-2">
            <span aria-hidden="true">·</span>
            <span>{perk}</span>
          </li>
        {/each}
      </ul>
      <div class="flex gap-2">
        <button
          type="button"
          class="font-sans text-[10px] tracking-[0.25em] font-bold uppercase bg-ink text-paper px-3 py-1.5"
          data-account-upgrade-cta
          onclick={() => (upgradeOpen = true)}
        >
          {activeTier === 'print-run' ? 'Manage tier' : 'Upgrade'}
        </button>
      </div>
    </div>
    <p class="font-serif italic text-[12px] text-ink-dim" data-account-copy>
      Mock entitlements at MVP — Stripe + Clerk wire in at K2c. Selecting a
      tier persists to this device only.
    </p>
  </section>
{/snippet}

{#snippet panelNotifications()}
  <section data-tab-panel="notifications">
    <Rule kicker="NOTIFICATIONS" title="Match alerts" action="DEVICE LOCAL" />
    <div class="flex flex-col divide-y divide-rule" data-notifications-toggles>
      <PrefToggle
        id="match-start"
        label="Match start"
        sub="Ping me when kick-off is imminent."
        checked={notifications.matchStart}
        onchange={(next) => setNotification('matchStart', next)}
      />
      <PrefToggle
        id="model-edge"
        label="Model edge"
        sub="Surface fixtures where the model disagrees with the market."
        checked={notifications.modelEdge}
        onchange={(next) => setNotification('modelEdge', next)}
      />
      <PrefToggle
        id="broadsheet-ready"
        label="Broadsheet ready"
        sub="Alert me when this gameweek's paper is generated."
        checked={notifications.broadsheetReady}
        onchange={(next) => setNotification('broadsheetReady', next)}
      />
    </div>
  </section>
{/snippet}

{#snippet panelPrivacy()}
  <section data-tab-panel="privacy">
    <Rule kicker="PRIVACY" title="Data & tracking" action="DEVICE LOCAL" />
    <p class="font-serif text-[14px] leading-relaxed text-ink-soft" data-privacy-copy>
      Your persona, predictions, and API keys live in this device's
      localStorage. Nothing leaves the browser except match queries to
      Football-Data.org and Anthropic.
    </p>
  </section>
{/snippet}

{#snippet panel()}
  {#if activeTab === 'pundit'}
    {@render panelPundit()}
  {:else if activeTab === 'api'}
    {@render panelApi()}
  {:else if activeTab === 'display'}
    {@render panelDisplay()}
  {:else if activeTab === 'account'}
    {@render panelAccount()}
  {:else if activeTab === 'notifications'}
    {@render panelNotifications()}
  {:else if activeTab === 'privacy'}
    {@render panelPrivacy()}
  {/if}
{/snippet}

{#snippet body()}
  <div class="kicker-settings grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6" data-settings-grid>
    <div>{@render subNav()}</div>
    <div data-settings-panel-host>{@render panel()}</div>
  </div>
{/snippet}

<div class="hidden lg:block" data-desktop-shell>
  <KickerShell active="settings" kicker="ACCOUNT · PUNDIT · DISPLAY · API" title="SETTINGS">
    {@render body()}
  </KickerShell>
</div>

<UpgradeModal bind:open={upgradeOpen} />

<div class="lg:hidden flex flex-col min-h-screen" data-mobile-shell data-settings-page>
  <MobileHeader title="Settings" sub="THE KICKER">
    {#snippet action()}<MobilePersonaPill />{/snippet}
  </MobileHeader>
  <main class="flex-1 px-4 py-4 pb-24 overflow-y-auto" data-mobile-body>
    {@render body()}
  </main>
  <div class="fixed bottom-0 inset-x-0 z-10">
    <MobileNav active="more" />
  </div>
</div>

<style>
  .kicker-subnav__row {
    background: transparent;
    border: 1px solid transparent;
    color: var(--ink);
  }
  .kicker-subnav__row :global([data-subnav-sub]) {
    color: var(--ink-dim);
  }
  .kicker-subnav__row:hover {
    background: var(--paper-warm);
  }
  .kicker-subnav__row.is-active {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--paper);
  }
  .kicker-subnav__row.is-active :global([data-subnav-sub]) {
    color: var(--rule-strong);
  }
  .kicker-input:focus {
    outline: 2px solid var(--ink);
    outline-offset: -2px;
  }
</style>
