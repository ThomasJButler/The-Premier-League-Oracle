<script lang="ts">
  import KickerShell from '$lib/components/shell/KickerShell.svelte';
  import MobileHeader from '$lib/components/shell/MobileHeader.svelte';
  import MobileNav from '$lib/components/shell/MobileNav.svelte';
  import MobilePersonaPill from '$lib/components/persona/MobilePersonaPill.svelte';
  import Rule from '$lib/components/atoms/Rule.svelte';
  import ColumnHero from '$lib/components/column/ColumnHero.svelte';
  import PullQuote from '$lib/components/column/PullQuote.svelte';
  import CheersGeoffCallout from '$lib/components/match/CheersGeoffCallout.svelte';
  import { getColumn } from '$lib/fixtures/columns';
  import { PERSONAS } from '$lib/personas';
  import { personaStore } from '$lib/stores/persona';
  import { onMount } from 'svelte';

  interface PageData {
    slug: string;
  }

  const { data }: { data: PageData } = $props();

  const column = $derived(getColumn(data.slug));
  const persona = $derived(column ? PERSONAS[column.byline.personaId] : null);

  onMount(() => {
    if (column) personaStore.set(column.byline.personaId);
  });

  const titleLine = $derived(
    column ? column.headline.map((s) => s.text).join('') : 'Column'
  );

  const introFirst = $derived(column ? column.dropCapIntro.charAt(0) : '');
  const introRest = $derived(column ? column.dropCapIntro.slice(1) : '');
</script>

{#snippet body()}
  {#if column && persona}
    <article
      class="max-w-[900px] mx-auto"
      data-column-article
      data-column-slug={column.slug}
    >
      <ColumnHero
        eyebrow={column.eyebrow}
        headline={column.headline}
        bylineName={persona.name}
        bylineSub={column.byline.sub}
        readTimeMinutes={column.byline.readTimeMinutes}
        dateline={column.byline.dateline}
      />

      <p
        class="kicker-column-intro mt-8 font-serif text-ink text-[18px] leading-[1.55]"
        data-column-intro
      >
        <span
          class="kicker-column-intro__drop float-left font-serif font-extrabold leading-[0.85] mr-2 mt-1"
          data-column-dropcap
          aria-hidden="true"
        >{introFirst}</span>
        <span class="sr-only">{introFirst}</span>{introRest}
      </p>

      <PullQuote body={column.pullQuote.body} attribution={column.pullQuote.attribution} />

      <div
        class="kicker-column-body grid gap-8 sm:grid-cols-2 font-serif text-ink text-[16px] leading-[1.6]"
        data-column-body
      >
        {#each column.body as paragraph, i (i)}
          <p data-column-paragraph>{paragraph}</p>
        {/each}
      </div>

      {#if column.cheers}
        <div class="mt-8" data-column-cheers>
          <CheersGeoffCallout
            stat={column.cheers.stat}
            label={column.cheers.label}
            gloriouslyUseless={column.cheers.gloriouslyUseless}
          />
        </div>
      {/if}
    </article>
  {:else}
    <div data-column-missing>
      <Rule kicker="404" title="Column not found" />
      <p class="font-serif italic text-ink-dim text-[14px] mt-3">
        That column isn't on file. <a class="underline" href="/today">Back to today's paper</a>.
      </p>
    </div>
  {/if}
{/snippet}

<div class="hidden lg:block" data-desktop-shell>
  <KickerShell active="today" kicker="COLUMN" title={titleLine}>
    <div class="px-8 py-6">
      {@render body()}
    </div>
  </KickerShell>
</div>

<div class="lg:hidden flex flex-col min-h-screen" data-mobile-shell data-column-page-mobile>
  <MobileHeader title={titleLine} sub="THE KICKER · COLUMN">
    {#snippet action()}<MobilePersonaPill />{/snippet}
  </MobileHeader>
  <main class="flex-1 px-4 py-4 pb-24 overflow-y-auto" data-mobile-body>
    {@render body()}
  </main>
  <div class="fixed bottom-0 inset-x-0 z-10">
    <MobileNav active="today" />
  </div>
</div>

<style>
  .kicker-column-intro__drop {
    font-size: 72px;
    color: var(--persona-accent, var(--red));
  }
</style>
