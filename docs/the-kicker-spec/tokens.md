# The Kicker — Design Tokens

Newsprint design system. 13 CSS custom properties, no dark mode, no hex
literals in component code. All colour, spacing-adjacent, and accent decisions
in components MUST consume these custom properties (or their Tailwind aliases)
rather than hardcoding hex.

## Token table

| Token            | Hex       | Role                                    |
| ---------------- | --------- | --------------------------------------- |
| `--paper`        | `#f4ecdb` | Newsprint cream — page background       |
| `--paper-deep`   | `#ebe1c9` | Sidebar / rail backgrounds              |
| `--paper-inset`  | `#e1d6ba` | Inset wells, inputs                     |
| `--paper-warm`   | `#f8f0df` | Raised cards                            |
| `--ink`          | `#1a1611` | Body ink — primary text + borders       |
| `--ink-soft`     | `#3d362a` | Secondary text                          |
| `--ink-dim`      | `#6b6249` | Tertiary text / muted captions          |
| `--ink-faint`    | `#a39a7e` | Quaternary / disabled                   |
| `--ink-ghost`    | `#cdc4a8` | Ghost overlays (e.g. market-implied bar)|
| `--rule`         | `#c9bf9f` | Hairline rules                          |
| `--rule-strong`  | `#9a8f6c` | Ticker border + strong dividers         |
| `--red`          | `#9c1a1a` | Editorial red — kickers, LIVE, accents  |
| `--amber`        | `#c47a14` | CHEERS GEOFF callout, model-edge chips  |
| `--green`        | `#4a7c2a` | Confirmed / positive outcomes           |

The `--amber` and `--green` tokens are listed alongside the 13 because they're
the only other colours allowed in the system; the "13" count refers to the
canonical greyscale + red palette excluding the two semantic accents. Both
must still resolve via custom property, never inline hex.

## Persona accent

Each of the 10 personas owns an accent colour applied to avatar backgrounds,
signature-line borders, drop-caps, and the "ON DUTY" badge. The accent is
exposed via `var(--persona-accent)` — set by a `[data-persona="<id>"]`
selector block in `tokens.css` keyed on the active persona ID written to
`<html data-persona>` by the `personaStore`. See `personas.md` for the
per-persona hex values.

## Typography

| Role                        | Family            | Size      | Weight  | Notes                           |
| --------------------------- | ----------------- | --------- | ------- | ------------------------------- |
| Masthead                    | Instrument Serif  | 44–88px   | 700     | `letter-spacing: -0.02em`       |
| Section headers             | Instrument Serif  | 28–56px   | 700     | `letter-spacing: -0.02em`       |
| Body / pundit voice         | Instrument Serif  | 13–15px   | 400     | `line-height: 1.65`             |
| Pull quotes / hot takes     | Instrument Serif  | 19–36px   | 700     | italic                          |
| Drop caps                   | Instrument Serif  | 52–76px   | 700     | `float: left`, persona accent   |
| UI kickers / labels         | Inter             | 9–11px    | 700     | tracking 0.25–0.4em, UPPERCASE  |
| Data / odds / picks         | JetBrains Mono    | 10–42px   | 400–700 | `letter-spacing: -0.04em` for hero numbers |

Google Fonts import line for `app.html`:

```html
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

## Source of truth

- `the_kicker_handoff/CLAUDE.md` (handoff CLAUDE.md, gitignored) — original token block
- `the_kicker_handoff/design_reference/geoff-shared.jsx` — primitive consumers
- This file is the committed mirror; if it diverges from the handoff, the handoff wins for visual decisions. Update this file whenever tokens change.
