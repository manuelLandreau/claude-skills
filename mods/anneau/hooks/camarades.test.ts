import { expect, test } from 'claude-code/testing'

import { bandItem, ctxOf, merge, transitions, type HerdrAgent } from './camarades'

const NOW = Date.parse('2026-10-08T12:00:00Z')
const minutesAgo = (n: number) => new Date(NOW - n * 60_000).toISOString()
const agent = (name: string | undefined, agent_status: string, pane_id = `w1:p-${name}`): HerdrAgent => ({
  name,
  pane_id,
  agent_status,
  agent_session: { value: `uuid-${name}` },
})

test('a pane waiting for a key outranks everything and reads as critical', () => {
  const list = merge(
    {
      nains: { tache: 'CA22-20 export', state: 'in_progress', updated_at: minutesAgo(4) },
      elfes: { tache: 'HOR-812 bandeau', state: 'in_progress', updated_at: minutesAgo(1) },
    },
    [agent('nains', 'working'), agent('elfes', 'blocked')],
    NOW,
  )
  expect(list.map(c => [c.name, c.attention, c.tone])).toEqual([
    ['elfes', 'touche', 'crit'],
    ['nains', undefined, 'ok'],
  ])
  expect(list[0]?.session).toBe('uuid-elfes')
})

test('French states are understood, and a finished status is never stale', () => {
  const [c] = merge({ aragorn: { tache: '#615 signet', state: 'terminé', updated_at: minutesAgo(90) } }, [agent('aragorn', 'done')], NOW)
  expect(c?.stateLabel).toBe('✓ fini')
  expect(c?.attention).toBe('fini')
  expect(c?.ticket).toBe('#615')
})

test('an unfinished status untouched for 30 minutes is stale', () => {
  const [c] = merge({ humains: { state: 'en cours', updated_at: minutesAgo(45) } }, [agent('humains', 'idle')], NOW)
  expect([c?.attention, c?.tone, c?.ageMin]).toEqual(['perime', 'warn', 45])
  const [fresh] = merge({ humains: { state: 'en cours', updated_at: minutesAgo(29) } }, [agent('humains', 'idle')], NOW)
  expect(fresh?.attention).toBe(undefined)
})

test('old statuses with no pane are forgotten, the ring and unnamed sessions are left out', () => {
  const list = merge(
    { gandalf: { state: 'terminé', updated_at: minutesAgo(3 * 24 * 60) }, nains: { state: 'in_progress', updated_at: minutesAgo(3 * 24 * 60) } },
    [agent('anneau-unique', 'working'), agent(undefined, 'idle', 'w1:p9'), agent('nains', 'working')],
    NOW,
  )
  expect(list.map(c => c.name)).toEqual(['nains'])
})

test('a named pane without a status file still shows', () => {
  const [c] = merge({}, [agent('elfes', 'working')], NOW)
  expect(c?.stateLabel).toBe('pas de statut')
})

test('without herdr, recent statuses still show', () => {
  expect(merge({ nains: { state: 'in_progress', updated_at: minutesAgo(5) } }, undefined, NOW).map(c => c.name)).toEqual(['nains'])
})

test('only a change of attention is announced, and the first poll is a baseline', () => {
  const quiet = merge({ elfes: { tache: 'HOR-812', state: 'in_progress', updated_at: minutesAgo(1) } }, [agent('elfes', 'working')], NOW)
  const plan = merge({ elfes: { tache: 'HOR-812', state: 'plan_ready', updated_at: minutesAgo(1) } }, [agent('elfes', 'working')], NOW)
  expect(transitions(undefined, plan)).toEqual([])
  expect(transitions(quiet, plan)).toEqual(['elfes (HOR-812) : plan prêt'])
  expect(transitions(plan, plan)).toEqual([])
  expect(transitions(plan, quiet)).toEqual([])
})

test('the band item names the camarade, its ticket, what needs attention and the age', () => {
  const [c] = merge({ elfes: { tache: 'HOR-812', state: 'plan_ready', updated_at: minutesAgo(2) } }, [agent('elfes', 'working')], NOW)
  expect(bandItem(c!)).toBe('elfes · HOR-812 · plan prêt · 2 min')
})

test('ctx reads the last percentage on the screen', () => {
  expect(ctxOf('ctx:12%\n…\nctx:42.5%  ◐ high')).toBe('42.5')
  expect(ctxOf('after a /clear')).toBe(undefined)
})
