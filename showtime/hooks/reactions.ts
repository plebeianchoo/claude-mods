// Reactions any grid can carry, for the two-row scenes: a figure per subagent
// at the right edge, a shake on a failed test, a spark burst on a commit.
import { frame, mod, put } from './cells'
import type { Grid } from './cells'
import type { Signals } from './themes'

const FIGURE = ['ᗣ', 'ᗤ']

export function withReactions(g: Grid, t: number, s: Signals, color: string): Grid {
  const w = g[0]?.length ?? 0
  const rows = g.length
  let out = g
  // Agents: one small figure each, bobbing, at the right edge, at most four.
  for (let i = 0; i < Math.min(s.agents, 4); i++) {
    const x = w - 2 - i * 2
    const row = mod(t + i * 3, 8) < 4 ? rows - 1 : Math.max(0, rows - 2)
    if (x >= 0) put(out, x, row, frame(FIGURE, t >> 2), { c: color, d: true })
  }
  // A failed test: the whole grid shakes a column left and right for eight frames.
  if (s.news === 'testFail' && s.newsAge < 8) {
    const dx = mod(s.newsAge, 2) === 0 ? 1 : -1
    out = out.map(row => (dx > 0 ? [{ ch: ' ' }, ...row.slice(0, w - 1)] : [...row.slice(1), { ch: ' ' }]))
  }
  // A commit: sparks fly out from the middle for sixteen frames and fade.
  if (s.news === 'commit' && s.newsAge < 16) {
    const cx = Math.floor(w / 2)
    for (let i = 0; i < 8; i++) {
      const dir = i % 2 ? 1 : -1
      const x = cx + dir * Math.round(1 + s.newsAge * (0.4 + (i % 4) * 0.3))
      const row = (i >> 1) % rows
      put(out, x, row, frame(['✦', '✧', '·'], i + (s.newsAge >> 2)), { c: color, d: s.newsAge > 10 })
    }
  }
  return out
}
