export type CamaradeStatus = { tache?: string; state?: string; updated_at?: string }

// Camarades write their state in English or French depending on the brief they got.
const STATE_LABELS: Record<string, string> = {
  in_progress: 'en cours',
  'en cours': 'en cours',
  plan_ready: '⏸ plan prêt',
  'plan prêt': '⏸ plan prêt',
  blocked: '⚠ bloqué',
  bloqué: '⚠ bloqué',
  waiting: '⏸ attend',
  attend: '⏸ attend',
  reçu: '📥 reçu',
  done: '✓ fini',
  fini: '✓ fini',
  terminé: '✓ fini',
  livré: '✓ fini',
}

export const isDone = (state: string | undefined) => state !== undefined && STATE_LABELS[state.toLowerCase()] === '✓ fini'

// Past this age a status still "in progress" usually means the camarade forgot to rewrite it.
const STALE_AFTER_MIN = 30

const ticketOf = (tache: string) => tache.match(/[A-Z][A-Z0-9]+-\d+/)?.[0] ?? tache.slice(0, 24)

const ageLabel = (minutes: number) => (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h`)

export const statusLine = (name: string, status: CamaradeStatus | undefined, nowMs: number): string => {
  if (!status) return `${name} · pas de statut`
  const parts = [name]
  if (status.tache) parts.push(ticketOf(status.tache))
  if (status.state) parts.push(STATE_LABELS[status.state.toLowerCase()] ?? status.state)
  const updatedMs = status.updated_at ? Date.parse(status.updated_at) : NaN
  if (!Number.isNaN(updatedMs)) {
    const minutes = Math.max(0, Math.floor((nowMs - updatedMs) / 60000))
    const stale = minutes >= STALE_AFTER_MIN && !isDone(status.state)
    parts.push(`${stale ? '⚠ ' : ''}maj ${ageLabel(minutes)}`)
  }
  return parts.join(' · ')
}
