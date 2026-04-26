/**
 * Typed icon registry for the broadcast redesign.
 * Each entry is a stroke-based SVG path string.
 * Add icons by extending this map; consumers are type-checked via `keyof typeof iconRegistry`.
 *
 * View box for all entries: 0 0 24 24. Stroke width applied at the consumer.
 */

export const iconRegistry = {
  'chevron-down':  'M6 9l6 6 6-6',
  'chevron-up':    'M6 15l6-6 6 6',
  'chevron-right': 'M9 18l6-6-6-6',
  'arrow-up':      'M12 19V5M5 12l7-7 7 7',
  'arrow-down':    'M12 5v14M5 12l7 7 7-7',
  'circle':        'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z',
  'dot':           'M12 13a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  'flame':         'M8.5 14.5A2.5 2.5 0 0 0 11 17a2.5 2.5 0 0 0 2.5-2.5c0-2-2.5-4-2.5-7-2 1-4 4-4 6 .002 1.4.99 1 1.5 1Z',
  'trophy':        'M6 9V4h12v5a6 6 0 0 1-12 0Zm6 6v6m-3 0h6',
  'bolt':          'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
  'home':          'M3 12 12 3l9 9M5 10v10h14V10',
  'target':        'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Zm-6 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  'clock':         'M12 6v6l4 2M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z',
  'chart-line':    'M3 3v18h18M7 17l4-4 4 4 4-4',
  'chart-bar':     'M3 3v18h18M7 17V11M11 17V7M15 17v-4M19 17v-9',
  'settings':      'M12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm0 6 1.5-3 3 .8L18 16l3-1.2-.8-3 2.8-1.5L20 8l1.2-3-3-.8L17 1l-3 .8L12 .2 10 1l-3-.8L6 1l1.2 3-3 .8 1 3.5L2 10l3 1.5L4.2 14l3 .8L7 18l3-.8 1.5 3Z',
  'menu':          'M3 6h18M3 12h18M3 18h18',
  'close':         'M6 6l12 12M18 6L6 18',
  'check':         'M5 13l4 4L19 7',
  'info':          'M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  'warning':       'M12 9v4M12 17h.01M12 2 1 22h22L12 2Z',
  'download':      'M12 3v12M5 12l7 7 7-7M5 21h14',
  'share':         'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13',
  'copy':          'M9 5h11v15H9zM5 1h11v3H5zM5 1v18h3',
  'external-link': 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3',
  'tv':            'M2 7h20v12H2zM7 22h10M12 2 8 7M12 2l4 5',
  'calendar':      'M3 6h18v15H3zM8 2v6M16 2v6M3 11h18',
} as const;

export type IconName = keyof typeof iconRegistry;
