import type { EngineInterface, Register } from 'claude-code'
import { isOrder, nudge, pushes, PUSH_DENIED, RECEIVED } from './guard'
import { statusLine, type CamaradeStatus } from './statusLine'

const STATUS_DIR = '/private/tmp/claude-501/anneau-status'
const REFRESH_MS = 20_000

const readStatus = async ($: EngineInterface, name: string): Promise<CamaradeStatus | undefined> => {
  try {
    return JSON.parse(await $.fs.read(`${STATUS_DIR}/${name}.json`))
  } catch {
    return undefined
  }
}

const refresh = async ($: EngineInterface, name: string) =>
  $.ui.status(statusLine(name, await readStatus($, name), await $.clock.now()))

export const register: Register = on => {
  // One reminder per status version: a camarade that ignores it is not reminded again until it writes.
  let remindedFor: string | undefined

  on('session.start', async ($, e, next) => {
    const name = await $.env.get('ANNEAU_CAMARADE')
    if (name) {
      await refresh($, name)
      $.clock.every(REFRESH_MS, () => void refresh($, name))
    }
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const name = await $.env.get('ANNEAU_CAMARADE')
    if (name && !e.command && isOrder(e.origin)) {
      const status = await readStatus($, name)
      const updated_at = new Date(await $.clock.now()).toISOString()
      await $.fs.write(`${STATUS_DIR}/${name}.json`, JSON.stringify({ ...status, state: RECEIVED, updated_at }))
      await refresh($, name)
    }
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (e.tool !== 'Bash' || !(await $.env.get('ANNEAU_CAMARADE'))) return next(e)
    if ((await $.env.get('ANNEAU_PEUT_POUSSER')) !== '1' && pushes(e.command)) return { deny: PUSH_DENIED }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    const name = await $.env.get('ANNEAU_CAMARADE')
    if (!name || e.agentId !== undefined || e.isAborted) return done
    const status = await readStatus($, name)
    const version = status?.updated_at ?? 'absent'
    const text = nudge(name, status, await $.clock.now())
    if (text && remindedFor !== version) {
      remindedFor = version
      await $.prompt.submit({ text })
    }
    return done
  })
}
