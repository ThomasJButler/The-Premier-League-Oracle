# Spec 07: UI / UX

**JTBD: Deliver a polished, accessible, mobile-responsive UI using shadcn-svelte primitives layered with the existing glassmorphism design system**

---

## Design Philosophy

Keep the glassmorphism aesthetic. The dark/light theme system, the glow effects, the gradient backgrounds, and the CSS variable palette in `frontend/src/app.css` are all staying. ShadCN provides accessible, well-tested **structural primitives** — we layer the glassmorphism on top.

---

## ShadCN Setup

shadcn-svelte is **initialised**. `components.json` exists at `frontend/components.json`. Five components are installed in `frontend/src/lib/components/ui/`: Button, Card, Badge, Separator, Skeleton. The `$lib/utils.ts` file provides the standard `cn()` utility (clsx + tailwind-merge). Only the Separator component is currently wired into the UI — the remaining 4 are installed but unused.

To add more components:

```bash
cd frontend
npx shadcn-svelte@latest add <component-name>
```

---

## CSS Variable Mapping

shadcn-svelte requires its own CSS variable scheme. Map the existing palette by adding these to `app.css` inside `:root` and `.dark` blocks:

```css
/* shadcn-svelte compatibility — mapped from existing palette */
:root {
  --background: 0 0% 100%;
  --foreground: 215 28% 17%;
  --card: 0 0% 100%;
  --card-foreground: 215 28% 17%;
  --popover: 0 0% 100%;
  --popover-foreground: 215 28% 17%;
  --primary: 210 90% 50%;          /* matches existing primary */
  --primary-foreground: 0 0% 100%;
  --secondary: 180 70% 50%;        /* matches existing secondary (teal) */
  --secondary-foreground: 0 0% 100%;
  --muted: 210 40% 96%;
  --muted-foreground: 215 16% 47%;
  --accent: 260 85% 60%;           /* matches existing accent (purple) */
  --accent-foreground: 0 0% 100%;
  --destructive: 0 72% 51%;
  --destructive-foreground: 0 0% 100%;
  --border: 214 32% 91%;
  --input: 214 32% 91%;
  --ring: 210 90% 50%;
  --radius: 0.75rem;
}

.dark {
  --background: 222 47% 6%;        /* matches --bg-base dark */
  --foreground: 213 31% 91%;
  --card: 222 47% 9%;
  --card-foreground: 213 31% 91%;
  --popover: 222 47% 9%;
  --popover-foreground: 213 31% 91%;
  --primary: 210 90% 60%;          /* slightly lighter in dark mode */
  --primary-foreground: 222 47% 6%;
  --secondary: 180 70% 50%;
  --secondary-foreground: 222 47% 6%;
  --muted: 223 47% 12%;
  --muted-foreground: 215 20% 65%;
  --accent: 260 85% 65%;
  --accent-foreground: 222 47% 6%;
  --destructive: 0 62% 50%;
  --destructive-foreground: 0 0% 100%;
  --border: 216 34% 17%;
  --input: 216 34% 17%;
  --ring: 210 90% 60%;
}
```

---

## Component Migration Priority

### Priority 1: Button
Replace all `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost` CSS classes with shadcn `Button`.

```svelte
<script>
  import { Button } from '$lib/components/ui/button'
</script>
<Button variant="default">Predict</Button>
<Button variant="outline">Export</Button>
<Button variant="ghost">Cancel</Button>
```

Keep `.btn-glass` for special cases where the glassmorphism glow is needed — add as a `class` override.

### Priority 2: Card
Wrap glassmorphism cards with shadcn `Card` as the structural base:

```svelte
<script>
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card'
</script>
<Card class="card-glass">
  <CardHeader><CardTitle>Predictions</CardTitle></CardHeader>
  <CardContent><slot /></CardContent>
</Card>
```

### Priority 3: Dialog
Replace the hand-rolled `ApiSetupWizard` modal with shadcn `Dialog`. The existing modal in `ApiSetupWizard.svelte` uses custom CSS and `bind:showModal` — replace with Dialog's controlled open state.

### Priority 4: Badge
Replace all `.badge`, `.badge-success`, `.badge-warning`, `.badge-error` CSS classes with shadcn `Badge`:

```svelte
<Badge variant="default">Home Win</Badge>
<Badge variant="secondary">Draw</Badge>
<Badge variant="destructive">Away Win</Badge>
```

### Priority 5: Tabs
Use shadcn `Tabs` for the Predictions view (currently switches between Upcoming/Recent/Analysis via `{#if}` blocks).

### Priority 6 onwards: Skeleton, Select, Table, Progress, Tooltip
- **Skeleton:** Replace `.skeleton` CSS loading placeholders
- **Select:** Settings page form selects
- **Table:** StandingsTable and BettingHistory
- **Progress:** Batch prediction progress bar
- **Tooltip:** Probability bars, confidence scores, odds displays

---

## Dark Mode Persistence Fix

In `frontend/src/components/Header.svelte`, the `toggleTheme()` function saves to localStorage but the page doesn't **restore** the theme on load.

Fix: In `App.svelte` `onMount`, add:

```typescript
onMount(() => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark')
  } else if (savedTheme === 'light') {
    document.documentElement.classList.remove('dark')
  } else {
    // System preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark')
    }
  }
})
```

---

## Mobile Improvements

### Sidebar as Sheet
On mobile (< 768px), the sidebar should use shadcn `Sheet` component to slide in from the left rather than pushing content.

`Sidebar.svelte` currently uses CSS `transform` to show/hide. Replace the mobile behaviour with:

```svelte
<Sheet open={isSidebarOpen} on:close={() => isSidebarOpen = false}>
  <SheetContent side="left" class="w-64 p-0">
    <!-- existing sidebar content -->
  </SheetContent>
</Sheet>
```

### Bottom Navigation
`MobileNav.svelte` already exists at the bottom. Ensure it has active state styling that matches the current `currentView`.

---

## Accessibility

The following must have proper ARIA labels:

| Element | Required ARIA |
|---------|---------------|
| Prediction probability bars | `role="meter"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label="Home win probability"` |
| Kelly calculator inputs | `<label>` elements with `for` attribute matching input `id` |
| Confidence indicator | `aria-label="Prediction confidence: {confidence}%"` |
| Theme toggle button | `aria-label="Toggle dark mode"` |
| Navigation items | `aria-current="page"` on active item |

---

## Dead Code Removal

- `Dashboard.svelte`: there is unreachable code after a `return` in `onMount` — the profit chart setup. Remove it.
- `BettingHistory.svelte`: remove the commented-out Supabase import line (`// import { getBettingHistory... }`)
- `Predictions.svelte`: form strings like `'WWDLW'` are hardcoded in multiple places — replace with real data from `dataService.getTeamForm()`

---

## Acceptance Criteria

- [ ] shadcn CSS variables added to `app.css` mapping existing palette
- [ ] Button component replaces all `.btn*` CSS classes
- [ ] Card component wraps glassmorphism cards
- [ ] Dialog component replaces ApiSetupWizard modal
- [ ] Badge component replaces all `.badge*` CSS classes
- [ ] Dark mode restores from localStorage on page load
- [ ] Sidebar uses shadcn Sheet on mobile
- [ ] Probability bars have ARIA meter attributes
- [ ] Kelly calculator inputs have proper `<label>` elements
- [ ] Dead code removed from Dashboard and BettingHistory
- [ ] Form strings computed from real data, not hardcoded
