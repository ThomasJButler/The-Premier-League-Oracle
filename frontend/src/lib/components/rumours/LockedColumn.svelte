<script lang="ts">
  interface Props {
    unlockLabel?: string;
  }

  const { unlockLabel = 'JUNE 9' }: Props = $props();
</script>

<div class="text-center" data-locked-column>
  <div
    class="font-mono font-extrabold text-[18px] flex items-center justify-center text-ink-faint"
    data-locked-glyph
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  </div>
  <div class="font-sans text-[8px] tracking-[0.25em] mt-0.5 text-ink-faint uppercase" data-locked-unlock-label>
    {unlockLabel}
  </div>
</div>
