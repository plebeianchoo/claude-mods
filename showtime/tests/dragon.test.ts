import { expect, test } from 'claude-code/testing'

import { IDLE_SIGNALS, THEMES } from '../hooks/themes'
import type { Signals } from '../hooks/themes'
import { dragonScene } from '../hooks/themes/dragon'
import { changed } from './motion'

const sig = (over: Partial<Signals>): Signals => ({ ...IDLE_SIGNALS, ...over })

test('dragon is a 6-row opaque scene', () => {
  expect(THEMES.dragon.rows).toBe(6)
  expect(THEMES.dragon.opaque).toBe(true)
  expect(dragonScene(40, 80, sig({}), { slot: null })).toHaveLength(6)
})

test('dragon reacts to every signal it promises', () => {
  const base = (s: Partial<Signals>) => dragonScene(200, 80, sig(s), { slot: null })
  const idle = base({ act: 'think', actAge: 30 })
  expect(changed(base({ act: 'tool', tool: 'bash', actAge: 30, toolAge: 30 }), idle)).toBeGreaterThanOrEqual(6)
  expect(changed(base({ act: 'tool', tool: 'search', actAge: 30, toolAge: 30 }), idle)).toBeGreaterThanOrEqual(3)
  expect(changed(base({ act: 'ask', actAge: 30 }), idle)).toBeGreaterThanOrEqual(3)
  expect(changed(base({ act: 'say', actAge: 31 }), idle)).toBeGreaterThanOrEqual(2)
  expect(changed(base({ agents: 2, agentsAge: 30 }), idle)).toBeGreaterThanOrEqual(6)
  expect(changed(base({ done: 3, total: 5, doneAge: 30 }), base({ done: 0, total: 5, doneAge: 30 }))).toBeGreaterThanOrEqual(3)
})
