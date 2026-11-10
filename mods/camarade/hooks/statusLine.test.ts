import { expect, test } from 'claude-code/testing'
import { statusLine } from './statusLine'

const NOW = Date.parse('2026-10-06T10:00:00Z')

test('shows name, ticket, state and age', () => {
  expect(
    statusLine('nains', { tache: 'CA22-20 page de garde', state: 'plan_ready', updated_at: '2026-10-06T09:56:00Z' }, NOW),
  ).toBe('nains · CA22-20 · ⏸ plan prêt · maj 4 min')
})

test('flags a stale status that is not done', () => {
  expect(statusLine('nains', { state: 'in_progress', updated_at: '2026-10-06T09:00:00Z' }, NOW)).toBe(
    'nains · en cours · ⚠ maj 1 h',
  )
  expect(statusLine('nains', { state: 'done', updated_at: '2026-10-06T09:00:00Z' }, NOW)).toBe('nains · ✓ fini · maj 1 h')
})

test('says when the status file is missing', () => {
  expect(statusLine('nains', undefined, NOW)).toBe('nains · pas de statut')
})
