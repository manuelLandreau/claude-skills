import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const NOW = Date.parse('2026-10-08T12:00:00Z')
const DIR = '/private/tmp/claude-501/anneau-status'

type World = { statuses: Record<string, object>; agents: object[]; screens?: Record<string, string> }

const world = (on: On, w: World, env: Record<string, string> = {}) => {
  const toasts: string[] = []
  const prompts: string[] = []
  const submitted: string[] = []
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, { HERDR_ENV: '1', ...env })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('tool.register', (_$, e) => ({ value: { tool: `mcp__anneau__${e.name}` } }))
  on('fs.list', (_$, e) => {
    expect(e.path).toBe(DIR)
    return { value: Object.keys(w.statuses).map(name => ({ name: `${name}.json`, kind: 'file' as const, size: 1, mtimeMs: NOW, isLink: false })) }
  })
  on('fs.read', (_$, e) => ({ value: JSON.stringify(w.statuses[e.path.slice(DIR.length + 1, -'.json'.length)]) }))
  on('process.run', (_$, e) => ({
    value: {
      exitCode: 0,
      stdout: e.argv[2] === 'list' ? JSON.stringify({ result: { agents: w.agents } }) : (w.screens?.[e.argv[3]!] ?? ''),
      stderr: '',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    },
  }))
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('prompt.fill', (_$, e) => {
    prompts.push(e.text)
    return { isFilled: true }
  })
  on('prompt.submit', (_$, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  return { clock, toasts, prompts, submitted }
}

const START = { cwd: '/tmp', surface: 'terminal' as const, isInteractive: true }
const BAND = { plugin: 'anneau', surface: 'terminal' as const, component: 'AbovePrompt' as const }

test('the band shows each camarade and a change of state raises a toast', async ($, on) => {
  const w: World = {
    statuses: { elfes: { tache: 'HOR-812 bandeau', state: 'in_progress', updated_at: '2026-10-08T11:59:00Z' } },
    agents: [{ name: 'elfes', pane_id: 'w1:p3', agent_status: 'working' }],
  }
  const { clock, toasts } = world(on, w)
  await $.session.start(START)

  const band = await $.ui.mount({ ...BAND, props: { hasSurvey: false, isWorking: false, maxRows: 5, bodyColumns: 100, scroll: { offset: 0, bodyRows: 5 }, view: {} } })
  expect(await band.find({ type: 'Text', text: /elfes · HOR-812 · en cours · 1 min/ })).toBeDefined()
  expect(toasts).toEqual([])

  w.agents = [{ name: 'elfes', pane_id: 'w1:p3', agent_status: 'blocked' }]
  await clock.advance(20_000)
  expect(toasts).toEqual(['elfes (HOR-812) : attend une touche'])
  expect(await band.find({ type: 'Text', text: /attend une touche/ })).toBeDefined()
})

test('waking the ring is opt-in', async ($, on) => {
  const w: World = { statuses: { nains: { state: 'in_progress', updated_at: '2026-10-08T11:59:00Z' } }, agents: [{ name: 'nains', pane_id: 'w1:p2', agent_status: 'working' }] }
  const { clock, submitted } = world(on, w)
  await $.session.start(START)
  w.statuses = { nains: { state: 'done', updated_at: '2026-10-08T12:00:00Z' } }
  await clock.advance(20_000)
  expect(submitted).toEqual([])
})

test('with ANNEAU_REVEIL=1 a change wakes the ring with one prompt', async ($, on) => {
  const w: World = { statuses: { nains: { state: 'in_progress', updated_at: '2026-10-08T11:59:00Z' } }, agents: [{ name: 'nains', pane_id: 'w1:p2', agent_status: 'working' }] }
  const { clock, submitted } = world(on, w, { ANNEAU_REVEIL: '1' })
  await $.session.start(START)
  w.statuses = { nains: { state: 'done', updated_at: '2026-10-08T12:00:00Z' } }
  await clock.advance(20_000)
  await clock.advance(20_000)
  expect(submitted).toEqual(['[anneau] nains : fini'])
})

test('camarades_etat answers every camarade in one call, ctx on request', async ($, on) => {
  world(on, {
    statuses: { nains: { tache: 'CA22-20', state: 'in_progress', updated_at: '2026-10-08T11:56:00Z' } },
    agents: [{ name: 'nains', pane_id: 'w1:p2', agent_status: 'working', agent_session: { value: 'uuid-n' } }],
    screens: { 'w1:p2': 'ctx:42%' },
  })
  await $.session.start(START)
  const answer = await $.tool.call({ tool: 'mcp__anneau__camarades_etat', ctx: true })
  const [row] = JSON.parse(String(answer.result))
  expect(row).toEqual(expect.objectContaining({ name: 'nains', ticket: 'CA22-20', pane: 'w1:p2', session: 'uuid-n', ageMin: 4, ctx: '42' }))
})

test('the pane buttons prefill the prompt, never send it', async ($, on) => {
  const { prompts, submitted } = world(on, {
    statuses: { elfes: { state: 'in_progress', updated_at: '2026-10-08T11:59:00Z' } },
    agents: [{ name: 'elfes', pane_id: 'w1:p3', agent_status: 'blocked' }],
  })
  await $.session.start(START)
  const pane = await $.ui.mount({
    plugin: 'anneau',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'camarades',
    props: { title: 'Camarades', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
  })
  await pane.press({ key: 'lire:elfes' })
  expect(prompts).toEqual(["elfes attend une touche dans w1:p3 : lis l'écran et dis-moi ce qu'il demande."])
  expect(submitted).toEqual([])
})
