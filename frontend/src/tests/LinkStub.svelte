<!--
  Test fixture: stand-in for svelte-routing's <Link>.
  Renders as a plain <a> so component tests don't need a <Router> ancestor
  to provide routing context. Used via vi.mock('svelte-routing', ...).
-->
<script lang="ts">
  export let to: string = '';
  let className: string = '';
  export { className as class };
</script>

<a href={to} class={className} {...$$restProps}><slot /></a>
