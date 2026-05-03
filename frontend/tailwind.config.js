/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        'paper-deep': 'var(--paper-deep)',
        'paper-inset': 'var(--paper-inset)',
        'paper-warm': 'var(--paper-warm)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'ink-dim': 'var(--ink-dim)',
        'ink-faint': 'var(--ink-faint)',
        'ink-ghost': 'var(--ink-ghost)',
        rule: 'var(--rule)',
        'rule-strong': 'var(--rule-strong)',
        red: 'var(--red)',
        amber: 'var(--amber)',
        green: 'var(--green)',
        'persona-accent': 'var(--persona-accent)'
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      }
    }
  },
  plugins: []
};
