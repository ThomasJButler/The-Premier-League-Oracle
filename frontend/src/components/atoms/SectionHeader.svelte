<script lang="ts">
  export let kicker: string | undefined = undefined;
  export let title: string;
</script>

<header class="flex items-end justify-between mb-4">
  <div class="flex flex-col gap-1">
    {#if kicker}<span data-kicker class="text-eyebrow">{kicker}</span>{/if}
    <h2 class="text-display">{title}</h2>
  </div>
  <div><slot name="right" /></div>
</header>
