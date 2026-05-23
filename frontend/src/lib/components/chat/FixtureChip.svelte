<script lang="ts">
  import { onMount } from 'svelte';
  import { findFixtureByPair } from '$lib/oracle/fixtureLookup';
  import type { Fixture } from '../../../types/redesign';

  interface Props {
    home: string;
    away: string;
  }

  const { home, away }: Props = $props();

  let fixture: Fixture | null = $state(null);
  let resolved = $state(false);

  onMount(async () => {
    if (typeof window === 'undefined') return;
    fixture = await findFixtureByPair(home, away);
    resolved = true;
  });

  function formatKickoff(utc: string): string {
    try {
      const d = new Date(utc);
      return d.toLocaleString(undefined, {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return utc;
    }
  }
</script>

<span
  class="kicker-fixture-chip inline-flex items-baseline gap-2 px-2 py-0.5 mx-1 align-baseline border border-rule bg-paper-warm font-mono text-[11px] tracking-[0.04em] text-ink"
  data-fixture-chip
  data-fixture-home={home}
  data-fixture-away={away}
>
  <span class="font-extrabold" data-fixture-pair>
    {home.toUpperCase()} v {away.toUpperCase()}
  </span>
  {#if fixture}
    <span class="text-ink-dim" data-fixture-kickoff>
      · {formatKickoff(fixture.utcDate)}
    </span>
  {:else if resolved}
    <span class="text-ink-dim italic" data-fixture-missing>· no upcoming match</span>
  {/if}
</span>
