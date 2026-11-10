import { isDone, type CamaradeStatus } from './statusLine'

// ponytail: a deny-list on spellings, best effort; an alias or a script that pushes slips through.
const GIT_PUSH = /^(?:\w+=\S*\s+)*git(?:\s+-[cC]\s+\S+|\s+--[\w-]+(?:=\S+)?)*\s+push\b/
const GH_PR_WRITE = /^(?:\w+=\S*\s+)*gh\s+pr\s+(?:create|ready|merge)\b/

export const pushes = (command: string) =>
  command
    .split(/&&|\|\||[;|\n]/)
    .map(segment => segment.trim())
    .some(segment => GIT_PUSH.test(segment) || GH_PR_WRITE.test(segment))

export const PUSH_DENIED =
  "Refusé par le mod camarade : un camarade rend la branche, l'anneau unique décide du push et de la PR. " +
  "Laisse la branche locale, mets ton statut à jour et rends la main."

const STALE_AFTER_MIN = 30

export const RECEIVED = 'reçu'

export const nudge = (name: string, status: CamaradeStatus | undefined, nowMs: number): string | undefined => {
  const file = `/private/tmp/claude-501/anneau-status/${name}.json`
  if (!status) return `Ton fichier de statut ${file} n'existe pas : écris-le ({tache, state, summary, fichiers, updated_at}).`
  if (status.state === RECEIVED)
    return `Ton statut ${file} est resté sur « ${RECEIVED} » depuis le dernier ordre : réécris-le avec où tu en es (tache, state, summary, fichiers, updated_at).`
  if (isDone(status.state)) return undefined
  const updatedMs = status.updated_at ? Date.parse(status.updated_at) : NaN
  const minutes = Number.isNaN(updatedMs) ? Infinity : Math.floor((nowMs - updatedMs) / 60000)
  if (minutes < STALE_AFTER_MIN) return undefined
  return `Ton statut ${file} n'a pas été réécrit depuis ${Number.isFinite(minutes) ? `${minutes} min` : 'ta prise de poste'} : mets-le à jour avec où tu en es.`
}
