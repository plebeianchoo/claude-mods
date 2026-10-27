// Helpers the scene tests share: how a frame's cells compare, where its shapes' edges are, how much changed.
import type { Grid } from '../hooks/cells'

/** Each cell as a signature: over the terminal's background only ink counts (a space or not); an opaque scene
 * paints every cell, so there the glyph and both colours count. */
export function sigs(g: Grid, opaque = false): string[][] {
  return g.map(row => row.map(c => (opaque ? `${c.ch}${c.c ?? ''}/${c.bg ?? ''}` : c.ch === ' ' ? ' ' : 'x')))
}

/** Where shapes start in a row: for ink, the first column of each run of ink; for an opaque row, every column
 * whose cell differs from the one on its left. */
export function edgesOf(line: string[], opaque = false): number[] {
  const out: number[] = []
  for (let x = 0; x < line.length; x++) {
    if (opaque ? x > 0 && line[x] !== line[x - 1] : line[x] === 'x' && (x === 0 || line[x - 1] !== 'x')) out.push(x)
  }
  return out
}

/** How many cells differ between two frames of the same size (glyph or either colour). */
export function changed(a: Grid, b: Grid): number {
  let n = 0
  a.forEach((row, r) => row.forEach((c, x) => {
    const d = b[r]![x]!
    if (c.ch !== d.ch || c.c !== d.c || c.bg !== d.bg) n++
  }))
  return n
}

/** The first jump between two frames, or null: an edge in `now` with no edge of `last` within a cell, in its row
 * or the rows above and below (shapes entering at the outer two columns count as arriving). */
export function jump(last: string[][], now: string[][], opaque: boolean): { row: number; x: number } | null {
  const w = now[0]?.length ?? 0
  for (let r = 0; r < now.length; r++) {
    const a = [last[r - 1], last[r], last[r + 1]].flatMap(line => (line ? edgesOf(line, opaque) : []))
    for (const x of edgesOf(now[r]!, opaque)) {
      if (!(a.some(y => Math.abs(y - x) <= 1) || x <= 1 || x >= w - 2)) return { row: r, x }
    }
  }
  return null
}
