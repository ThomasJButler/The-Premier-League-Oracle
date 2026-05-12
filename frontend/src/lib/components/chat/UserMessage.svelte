<script lang="ts">
  interface Props {
    body: string;
    time?: string;
  }

  const { body, time = '' }: Props = $props();
</script>

<article
  class="kicker-user-msg grid gap-6 mb-6"
  data-user-message
>
  <div class="text-right">
    <div
      class="inline-block max-w-[70%] px-3 py-2 rounded-sm font-mono text-[12px] bg-paper-inset border border-rule text-ink"
      data-user-body
    >
      {body}
    </div>
    <div class="font-mono text-[10px] mt-1 text-ink-dim" data-user-stamp>
      YOU{time ? ` · ${time}` : ''}
    </div>
  </div>
  <div></div>
</article>

<style>
  .kicker-user-msg {
    grid-template-columns: 1fr 120px;
  }
  @media (max-width: 768px) {
    .kicker-user-msg {
      grid-template-columns: 1fr;
    }
  }
</style>
