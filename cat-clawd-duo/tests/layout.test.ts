import { expect, test } from 'claude-code/testing'

import { CAT_MIN, CLAWD_MIN, EDGE, GAP, splitColumns } from '../hooks/layout'

test('a 135-column terminal fits the cat and Clawd side by side', () => {
  const split = splitColumns(135)
  expect(split).not.toBe(null)
  expect(split!.cat).toBeGreaterThanOrEqual(CAT_MIN)
  expect(split!.clawd).toBeGreaterThanOrEqual(CLAWD_MIN)
  expect(split!.cat + split!.clawd + GAP + EDGE).toBe(135)
})

test('the split never overflows the terminal, from the narrowest that fits to the widest', () => {
  for (let columns = 102; columns <= 400; columns++) {
    const split = splitColumns(columns)
    expect(split).not.toBe(null)
    expect(split!.cat + split!.clawd + GAP + EDGE).toBeLessThanOrEqual(columns)
  }
})

test('a terminal too narrow for both falls back to stacking', () => {
  expect(splitColumns(80)).toBe(null)
  expect(splitColumns(99)).toBe(null)
})
