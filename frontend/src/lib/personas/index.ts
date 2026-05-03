import { voice } from './voice';
import { scouser } from './scouser';
import { manc } from './manc';
import { charmer } from './charmer';
import { hardman } from './hardman';
import { volcano } from './volcano';
import { wanderer } from './wanderer';
import { philosopher } from './philosopher';
import { chaos } from './chaos';
import { optimist } from './optimist';

export type PersonaId =
  | 'voice'
  | 'scouser'
  | 'manc'
  | 'charmer'
  | 'hardman'
  | 'volcano'
  | 'wanderer'
  | 'philosopher'
  | 'chaos'
  | 'optimist';

export interface PersonaConfig {
  id: PersonaId;
  name: string;
  short: string;
  region: string;
  accent: string;
  tic: string;
  voice: string;
  systemPrompt: string;
}

export const KICKER_PERSONA_ORDER: readonly PersonaId[] = [
  'voice',
  'scouser',
  'manc',
  'charmer',
  'hardman',
  'volcano',
  'wanderer',
  'philosopher',
  'chaos',
  'optimist'
] as const;

export const PERSONAS: Record<PersonaId, PersonaConfig> = {
  voice,
  scouser,
  manc,
  charmer,
  hardman,
  volcano,
  wanderer,
  philosopher,
  chaos,
  optimist
};

export function isPersonaId(value: unknown): value is PersonaId {
  return typeof value === 'string' && value in PERSONAS;
}

export function getPersona(id: PersonaId): PersonaConfig {
  return PERSONAS[id];
}
