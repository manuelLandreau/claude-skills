import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { isOrder, nudge, pushes, PUSH_DENIED, RECEIVED } from './guard'

test('pushes catches git push and PR writes in any segment of a command', () => {
  for (const command of [
    'git push -u origin feat/HOR-812',
    'git -C ../wt push',
    'pnpm lint && git push --force-with-lease',
    'GIT_TRACE=1 git push',
    'gh pr create --draft --title x',
    'gh pr ready 615',
  ]) {
    expect(pushes(command), command).toBe(true)
  }
})

test('pushes leaves reads and the stash alone', () => {
  for (const command of ['git stash push -u -m "tag"', 'git log --grep push', 'gh pr view 615', 'echo "git push later"', 'git status']) {
    expect(pushes(command), command).toBe(false)
  }
})

const NOW = Date.parse('2026-10-08T12:00:00Z')

test('nudge asks for a missing or stale status, never for a finished one', () => {
  expect(nudge('elfes', undefined, NOW)).toMatch(/n'existe pas/)
  expect(nudge('elfes', { state: 'in_progress', updated_at: '2026-10-08T11:28:00Z' }, NOW)).toMatch(/depuis 32 min/)
  expect(nudge('elfes', { state: 'in_progress', updated_at: '2026-10-08T11:45:00Z' }, NOW)).toBe(undefined)
  expect(nudge('elfes', { state: 'terminé', updated_at: '2026-10-08T09:00:00Z' }, NOW)).toBe(undefined)
})

test('nudge asks again as soon as a turn ends on a status still marked received', () => {
  expect(nudge('elfes', { state: RECEIVED, updated_at: '2026-10-08T11:59:00Z' }, NOW)).toMatch(/resté sur « reçu »/)
})

const world = (on: On, env: Record<string, string>, status: object | undefined) => {
  const submitted: string[] = []
  const written: object[] = []
  mock.clock(on, { now: NOW })
  mock.env(on, env)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('fs.read', () => {
    if (!status) throw new Error('ENOENT')
    return { value: JSON.stringify(status) }
  })
  on('fs.write', (_$, e) => {
    written.push(JSON.parse(e.text))
    return { value: undefined }
  })
  on('ui.status', () => ({ value: undefined }))
  on('tool.call', () => ({ result: 'ran' }))
  on('turn.complete', () => ({ text: '' }))
  on('prompt.submit', (_$, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  return { submitted, written }
}

const START = { cwd: '/tmp', surface: 'terminal' as const, isInteractive: true }
const TURN = { answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' as const }

test('a camarade cannot push unless launched with ANNEAU_PEUT_POUSSER=1', async ($, on) => {
  world(on, { ANNEAU_CAMARADE: 'elfes' }, undefined)
  await $.session.start(START)
  expect(await $.tool.call({ tool: 'Bash', command: 'git push' })).toEqual({ deny: PUSH_DENIED })
  expect((await $.tool.call({ tool: 'Bash', command: 'git status' })).result).toBe('ran')
})

test('the push guard steps aside when allowed, and outside camarade sessions', async ($, on) => {
  world(on, { ANNEAU_CAMARADE: 'elfes', ANNEAU_PEUT_POUSSER: '1' }, undefined)
  await $.session.start(START)
  expect((await $.tool.call({ tool: 'Bash', command: 'git push' })).result).toBe('ran')
})

test('a plain session is never guarded', async ($, on) => {
  world(on, {}, undefined)
  await $.session.start(START)
  expect((await $.tool.call({ tool: 'Bash', command: 'git push' })).result).toBe('ran')
})

test('a stale status is reminded once per version, at the end of a main-loop turn', async ($, on) => {
  const { submitted } = world(on, { ANNEAU_CAMARADE: 'elfes' }, { state: 'in_progress', updated_at: '2026-10-08T11:00:00Z' })
  await $.session.start(START)
  await $.turn.complete({ ...TURN, agentId: 'sub-1' })
  expect(submitted).toEqual([])
  await $.turn.complete(TURN)
  await $.turn.complete(TURN)
  expect(submitted.length).toBe(1)
  expect(submitted[0]).toMatch(/depuis 60 min/)
})

test('only a prompt typed at the composer is an order', () => {
  expect(isOrder({ kind: 'composer' })).toBe(true)
  for (const kind of ['task-notification', 'peer', 'peer-send-message', 'unclassified', 'plugin']) {
    expect(isOrder({ kind }), kind).toBe(false)
  }
})

test('a prompt that is not an order leaves the status as the camarade wrote it', async ($, on) => {
  const { written } = world(on, { ANNEAU_CAMARADE: 'elfes' }, { tache: 'OP-1', state: 'en cours', updated_at: '2026-10-08T11:59:00Z' })
  await $.session.start(START)
  await $.prompt.submit({ text: 'Background command completed' })
  expect(written).toEqual([])
})
