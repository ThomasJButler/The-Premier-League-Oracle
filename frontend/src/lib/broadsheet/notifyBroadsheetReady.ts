// K1f-α.1 — Broadsheet-ready notification producer.
//
// Called from `/broadsheet` after a successful `requestBroadsheet` so the
// notifications inbox (K1f-α) actually populates from a real producer.
//
// One entry per successful generation, keyed per `(gameweek, persona)` via the
// notification id so the inbox can dedupe if a future caller wants to.

import { addNotification, type NotificationItem } from '$lib/stores/notificationsFeed';

export interface NotifyBroadsheetReadyInput {
  personaId: string;
  personaName: string;
  gameweek: number;
  headline: string;
}

export function notifyBroadsheetReady(input: NotifyBroadsheetReadyInput): NotificationItem[] {
  const { personaId, personaName, gameweek, headline } = input;
  return addNotification({
    id: `broadsheet-ready-gw${gameweek}-${personaId}-${Date.now()}`,
    type: 'broadsheet-ready',
    title: `GW${gameweek} broadsheet filed by ${personaName}`,
    body: headline,
    href: '/broadsheet'
  });
}
