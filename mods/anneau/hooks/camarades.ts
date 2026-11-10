import type { Attention, Camarade, Tone } from '../types'

export type StatusFile = { tache?: string; state?: string; summary?: string; updated_at?: string }

export type HerdrAgent = {
  name?: string
  pane_id: string
  agent_status: string
  agent_session?: { value?: string }
}

export const RING_NAME = 'anneau-unique'

// Same threshold as the camarade mod's status line, so both flag the same files.
const STALE_AFTER_MIN = 30

// A status file with no live pane behind it is a closed camarade; past this age it is history.
const FORGET_AFTER_MIN = 24 * 60

// Camarades write their state in English or French depending on the brief they got.
const STATES: Record<string, { label: string; attention?: Attention }> = {
  in_progress: { label: 'en cours' },
  'en cours': { label: 'en cours' },
  en_cours: { label: 'en cours' },
  reçu: { label: '📥 reçu' },
  plan_ready: { label: '⏸ plan prêt', attention: 'plan' },
  'plan prêt': { label: '⏸ plan prêt', attention: 'plan' },
  blocked: { label: '⚠ bloqué', attention: 'bloque' },
  bloqué: { label: '⚠ bloqué', attention: 'bloque' },
  waiting: { label: '⏸ attend' },
  attend: { label: '⏸ attend' },
  'en attente': { label: '⏸ attend' },
  done: { label: '✓ fini', attention: 'fini' },
  fini: { label: '✓ fini', attention: 'fini' },
  terminé: { label: '✓ fini', attention: 'fini' },
  livré: { label: '✓ fini', attention: 'fini' },
}

export const ATTENTION_LABELS: Record<Attention, string> = {
  touche: 'attend une touche',
  plan: 'plan prêt',
  bloque: 'bloqué',
  perime: 'statut périmé',
  fini: 'fini',
}

const TONES: Record<Attention, Tone> = { touche: 'crit', plan: 'crit', bloque: 'crit', perime: 'warn', fini: 'ok' }

const TONE_ORDER: Record<Tone, number> = { crit: 0, warn: 1, ok: 2 }

export const ticketOf = (tache: string) => tache.match(/[A-Z][A-Z0-9]+-\d+|#\d+/)?.[0]

export const ageLabel = (minutes: number) => (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h`)

export const parseAgents = (stdout: string): HerdrAgent[] => JSON.parse(stdout).result.agents

export const ctxOf = (screen: string) => [...screen.matchAll(/ctx:([0-9.]+)%/g)].at(-1)?.[1]

const camaradeOf = (name: string, status: StatusFile | undefined, agent: HerdrAgent | undefined, nowMs: number): Camarade => {
  const known = status?.state ? STATES[status.state.toLowerCase()] : undefined
  const updatedMs = status?.updated_at ? Date.parse(status.updated_at) : NaN
  const ageMin = Number.isNaN(updatedMs) ? undefined : Math.max(0, Math.floor((nowMs - updatedMs) / 60000))
  const isStale = ageMin !== undefined && ageMin >= STALE_AFTER_MIN && known?.attention !== 'fini'
  const attention: Attention | undefined =
    agent?.agent_status === 'blocked' ? 'touche' : known?.attention && known.attention !== 'fini' ? known.attention : isStale ? 'perime' : known?.attention
  return {
    name,
    ticket: status?.tache ? ticketOf(status.tache) : undefined,
    stateLabel: status ? (known?.label ?? status.state ?? '?') : 'pas de statut',
    summary: status?.summary,
    ageMin,
    pane: agent?.pane_id,
    session: agent?.agent_session?.value,
    herdrStatus: agent?.agent_status,
    attention,
    tone: attention ? TONES[attention] : 'ok',
  }
}

export const merge = (
  statuses: Readonly<Record<string, StatusFile | undefined>>,
  agents: readonly HerdrAgent[] | undefined,
  nowMs: number,
): Camarade[] => {
  const byName = new Map(agents?.filter(a => a.name && a.name !== RING_NAME).map(a => [a.name!, a]))
  const names = new Set([...byName.keys(), ...Object.keys(statuses)])
  return [...names]
    .map(name => camaradeOf(name, statuses[name], byName.get(name), nowMs))
    .filter(c => c.pane !== undefined || (c.ageMin !== undefined && c.ageMin < FORGET_AFTER_MIN))
    .sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone] || a.name.localeCompare(b.name))
}

export const transitions = (previous: readonly Camarade[] | undefined, next: readonly Camarade[]): string[] => {
  if (previous === undefined) return []
  const before = new Map(previous.map(c => [c.name, c.attention]))
  return next
    .filter(c => c.attention !== undefined && c.attention !== before.get(c.name))
    .map(c => `${c.name}${c.ticket ? ` (${c.ticket})` : ''} : ${ATTENTION_LABELS[c.attention!]}`)
}

export const bandItem = (c: Camarade) =>
  [c.name, c.ticket, c.attention ? ATTENTION_LABELS[c.attention] : c.stateLabel, c.ageMin !== undefined ? ageLabel(c.ageMin) : undefined]
    .filter(Boolean)
    .join(' · ')
