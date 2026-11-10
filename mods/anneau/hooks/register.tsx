import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Camarade, Tone } from '../types'
import { ATTENTION_LABELS, ageLabel, bandItem, ctxOf, merge, parseAgents, transitions, type HerdrAgent, type StatusFile } from './camarades'

const STATUS_DIR = '/private/tmp/claude-501/anneau-status'
const POLL_MS = 20_000
const PANE = 'camarades'
const TOOL = 'camarades_etat'

const TONE_COLOR: Record<Tone, string> = { ok: 'success', warn: 'warning', crit: 'error' }

const camarades = atom({ plugin: 'anneau', key: 'camarades' } as const, [])

const readStatuses = async ($: EngineInterface) => {
  const statuses: Record<string, StatusFile | undefined> = {}
  const entries = await $.fs.list(STATUS_DIR).catch(() => [])
  for (const entry of entries) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue
    try {
      statuses[entry.name.slice(0, -'.json'.length)] = JSON.parse(await $.fs.read(`${STATUS_DIR}/${entry.name}`))
    } catch {
      // A camarade mid-write leaves half a file: the next poll reads it whole.
    }
  }
  return statuses
}

const readAgents = async ($: EngineInterface): Promise<HerdrAgent[] | undefined> => {
  if ((await $.env.get('HERDR_ENV')) !== '1') return undefined
  try {
    const run = await $.process.run(['herdr', 'agent', 'list'], { timeoutMs: 10_000 })
    return run.exitCode === 0 ? parseAgents(run.stdout) : undefined
  } catch {
    return undefined
  }
}

const readCtx = async ($: EngineInterface, pane: string) => {
  try {
    return ctxOf((await $.process.run(['herdr', 'agent', 'read', pane], { timeoutMs: 10_000 })).stdout)
  } catch {
    return undefined
  }
}

const prefill = ($: EngineInterface, text: string) => $.prompt.fill({ text })

// Module state on purpose: a reload starts from no baseline, so it raises no stale toasts.
let previous: Camarade[] | undefined

const poll = async ($: EngineInterface) => {
  const [statuses, agents] = await Promise.all([readStatuses($), readAgents($)])
  const next = merge(statuses, agents, await $.clock.now())
  const changes = transitions(previous, next)
  previous = next
  await update($, camarades, () => next)
  for (const change of changes) $.ui.toast(change, { timeoutMs: 8000 })
  if (changes.length > 0 && (await $.env.get('ANNEAU_REVEIL')) === '1') {
    await $.prompt.submit({ text: `[anneau] ${changes.join(' ; ')}` })
  }
  return next
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: PANE, description: "Ouvre le panneau d'état des camarades" })
    await $.tool.register({
      name: TOOL,
      description:
        "État de chaque camarade de l'anneau unique, en un appel : son fichier anneau-status/<nom>.json joint par nom à `herdr agent list`, " +
        "l'âge du statut, le pane, l'UUID de session et ce qui demande ton attention (attend une touche, plan prêt, bloqué, statut périmé, fini). " +
        'Avec `ctx: true`, lit aussi le contexte (ctx:%) de chaque pane. Utilise-le au lieu de lire les fichiers de statut et herdr un par un ; ' +
        'il ne remplace pas la lecture du pane avant de conclure sur un camarade.',
      inputSchema: {
        type: 'object',
        properties: { ctx: { type: 'boolean', description: 'Lire aussi le contexte de chaque pane (un appel herdr par camarade).' } },
      },
      isDeferred: false,
    })
    await poll($)
    $.clock.every(POLL_MS, () => void poll($))
    return next(e)
  })

  on('command.run', { command: PANE }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: 'Camarades' })
    return { text: opened.isPlaced ? 'Panneau Camarades ouvert.' : `Panneau Camarades en attente : ${opened.reason}` }
  })

  on('tool.call', { tool: 'mcp__anneau__camarades_etat' }, async ($, e) => {
    const list = await poll($)
    const withCtx = e.ctx === true
    const rows = await Promise.all(
      list.map(async c => ({
        ...c,
        attention: c.attention ? ATTENTION_LABELS[c.attention] : undefined,
        ctx: withCtx && c.pane ? await readCtx($, c.pane) : undefined,
      })),
    )
    return { result: rows.length > 0 ? JSON.stringify(rows, null, 2) : `Aucun camarade : ni pane nommé dans herdr, ni statut récent dans ${STATUS_DIR}.` }
  }).catch(($, e, next) => ({ deny: `camarades_etat a échoué : ${String(next.error)}` }))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, camarades)
    if (e.props.hasSurvey || list.length === 0) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexWrap="wrap" columnGap={3}>
        {list.map(c => (
          <Text key={c.name} color={TONE_COLOR[c.tone]}>
            ● <Text color="text">{bandItem(c)}</Text>
          </Text>
        ))}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const list = await read($, camarades)
    const { Box, Text, Button } = $.ui.resolve(e)
    if (list.length === 0) return <Text dimColor>Aucun camarade pour l'instant.</Text>
    return (
      <Box flexDirection="column" gap={1}>
        {list.map(c => (
          <Box key={c.name} flexDirection="column" borderStyle="round" borderColor={c.tone === 'crit' ? 'error' : 'subtle'} paddingX={1}>
            <Box justifyContent="space-between" columnGap={1}>
              <Text bold>
                <Text color={TONE_COLOR[c.tone]}>● </Text>
                {c.name}
                {c.ticket ? ` ${c.ticket}` : ''}
              </Text>
              <Text color={TONE_COLOR[c.tone]}>{c.attention ? ATTENTION_LABELS[c.attention] : c.stateLabel}</Text>
            </Box>
            <Text dimColor>
              {[c.stateLabel, c.ageMin !== undefined ? `maj ${ageLabel(c.ageMin)}` : undefined, c.pane, c.herdrStatus].filter(Boolean).join(' · ')}
            </Text>
            {c.summary ? (
              <Text dimColor wrap="truncate-end">
                {c.summary}
              </Text>
            ) : null}
            <Box columnGap={1}>
              {c.pane ? (
                <Button
                  key={`lire:${c.name}`}
                  label="Lire le pane"
                  onPress={() =>
                    prefill(
                      $,
                      c.attention === 'touche'
                        ? `${c.name} attend une touche dans ${c.pane} : lis l'écran et dis-moi ce qu'il demande.`
                        : `Lis le pane de ${c.name} (${c.pane}) et dis-moi où il en est.`,
                    )
                  }
                />
              ) : null}
              <Button
                key={`recolter:${c.name}`}
                label="Récolter"
                onPress={() => prefill($, `Récolte ${c.name} : lis anneau-status/${c.name}.json et son pane, vérifie ce qu'il rend avant de me le relayer.`)}
              />
            </Box>
          </Box>
        ))}
        <Text dimColor>anneau-status/*.json + herdr agent list · toutes les 20 s</Text>
      </Box>
    )
  })
}
