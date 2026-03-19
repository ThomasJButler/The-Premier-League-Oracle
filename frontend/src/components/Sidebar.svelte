<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import * as Sheet from '$lib/components/ui/sheet';
  import SidebarNav from './SidebarNav.svelte';

  export let currentView: string;
  export let isOpen: boolean;

  let isMobile = false;
  function checkMobile() { isMobile = window.innerWidth < 1024; }
  if (typeof window !== 'undefined') {
    checkMobile();
    window.addEventListener('resize', checkMobile);
  }
  onDestroy(() => {
    if (typeof window !== 'undefined') window.removeEventListener('resize', checkMobile);
  });

  const dispatch = createEventDispatcher();

  function closeSidebar() {
    dispatch('closeSidebar');
  }

  function handleNavClick(e: CustomEvent<{ view: string }>) {
    dispatch('navigate', e.detail);
    if (isMobile) closeSidebar();
  }
</script>

<!-- Desktop sidebar — always in DOM, slides via CSS transform -->
<aside class="sidebar-container hidden lg:flex {isOpen ? 'translate-x-0' : '-translate-x-full'}">
  <SidebarNav {currentView} on:navigate={handleNavClick} />
</aside>

<!-- Mobile sidebar — Sheet overlay -->
<div class="lg:hidden">
  <Sheet.Root open={isOpen && isMobile} on:close={closeSidebar}>
    <Sheet.Content side="left" class="w-64 p-0">
      <SidebarNav {currentView} showCloseButton on:navigate={handleNavClick} on:close={closeSidebar} />
    </Sheet.Content>
  </Sheet.Root>
</div>
