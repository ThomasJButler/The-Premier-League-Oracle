<script lang="ts">
  import type { NotificationItem, NotificationType } from '$lib/stores/notificationsFeed';
  import { formatRelativeTime } from '$lib/utils/relativeTime';

  interface Props {
    item: NotificationItem;
    onclick?: (item: NotificationItem) => void;
  }

  const { item, onclick }: Props = $props();

  const TYPE_LABEL: Record<NotificationType, string> = {
    'match-start': 'KICK-OFF',
    'model-edge': 'MODEL EDGE',
    'broadsheet-ready': 'BROADSHEET'
  };

  function handleClick(): void {
    onclick?.(item);
  }
</script>

<button
  type="button"
  class="w-full text-left border-b border-rule py-4 hover:bg-paper-inset transition-colors"
  data-notification-item={item.id}
  data-notification-type={item.type}
  data-notification-read={item.read ? 'true' : 'false'}
  onclick={handleClick}
>
  <div class="lg:hidden flex flex-col gap-1" data-notification-mobile>
    <div class="flex items-baseline justify-between gap-2">
      <span
        class="font-mono text-[10px] tracking-[0.18em] uppercase font-bold"
        style="color: var(--persona-accent, var(--red));"
        data-notification-type-label
      >
        {TYPE_LABEL[item.type]}
      </span>
      <span
        class="font-mono text-[10px] tracking-[0.15em] uppercase text-ink-dim"
        data-notification-time
      >
        {formatRelativeTime(item.createdAt)}
      </span>
    </div>
    <span class="font-serif text-[16px] leading-snug text-ink" data-notification-title>
      {#if !item.read}
        <span
          aria-hidden="true"
          class="inline-block align-middle mr-2 rounded-full"
          style="width: 8px; height: 8px; background: var(--persona-accent, var(--red));"
          data-notification-unread-dot
        ></span>
      {/if}
      {item.title}
    </span>
    <span class="font-serif italic text-[13px] text-ink-dim" data-notification-body>
      {item.body}
    </span>
  </div>

  <div
    class="hidden lg:grid items-baseline gap-x-4 gap-y-1"
    style="grid-template-columns: 120px minmax(0, 1fr) auto;"
    data-notification-desktop
  >
    <span
      class="font-mono text-[10px] tracking-[0.18em] uppercase font-bold"
      style="color: var(--persona-accent, var(--red));"
      data-notification-type-label
    >
      {TYPE_LABEL[item.type]}
    </span>
    <span class="font-serif text-[16px] leading-snug text-ink" data-notification-title>
      {#if !item.read}
        <span
          aria-hidden="true"
          class="inline-block align-middle mr-2 rounded-full"
          style="width: 8px; height: 8px; background: var(--persona-accent, var(--red));"
          data-notification-unread-dot
        ></span>
      {/if}
      {item.title}
    </span>
    <span
      class="font-mono text-[10px] tracking-[0.15em] uppercase text-ink-dim"
      data-notification-time
    >
      {formatRelativeTime(item.createdAt)}
    </span>
    <span
      class="col-start-2 font-serif italic text-[13px] text-ink-dim"
      data-notification-body
    >
      {item.body}
    </span>
  </div>
</button>
