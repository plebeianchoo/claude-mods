// Set pieces by `t` alone. Time is cut into slots of `len` frames; each plays one of `kinds` set pieces, every one
// once per round of `kinds` slots in a fresh order, never the same twice in a row. Now and then (`eggChance`) a slot
// plays one of `eggs` easter eggs instead, never two slots running.
import { mod, noise } from './cells'

export type Slot = { index: number; age: number; len: number; kind: number; egg: number }

/** Round `round`'s order: a shuffle seeded by the round. */
function shuffled(round: number, kinds: number, seed: number): number[] {
  const a = Array.from({ length: kinds }, (_, i) => i)
  for (let i = kinds - 1; i > 0; i--) {
    const j = Math.floor(noise(seed * 977 + round * 131 + i * 17) * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/** The kind in slot `index`. Rounds of three or more swap their first two when the first would repeat the last
 * round's last (the last never moves, so the check never chains); two kinds simply alternate. */
function kindAt(index: number, kinds: number, seed: number): number {
  if (kinds <= 1) return 0
  if (kinds === 2) return mod(index + seed, 2)
  const round = Math.floor(index / kinds)
  const a = shuffled(round, kinds, seed)
  if (a[0] === shuffled(round - 1, kinds, seed)[kinds - 1]) [a[0], a[1]] = [a[1]!, a[0]!]
  return a[index - round * kinds]!
}

/** Whether slot `index` rolls an egg (before the no-two-running rule). */
const rolls = (index: number, seed: number, chance: number) => noise(seed * 31 + index * 7.31 + 0.5) < chance

export function slotAt(t: number, len: number, kinds: number, seed: number, eggs = 0, eggChance = 0): Slot {
  const index = Math.floor(t / len)
  const age = t - index * len
  const isEgg = eggs > 0 && rolls(index, seed, eggChance) && !rolls(index - 1, seed, eggChance)
  const egg = isEgg ? Math.floor(noise(seed * 17 + index * 3.17 + 0.25) * eggs) : -1
  return { index, age, len, kind: kindAt(index, kinds, seed), egg }
}

/** The start of the first slot from `t = 0` playing set piece `kind` (no egg), for sheets and tests. */
export function firstSlot(kind: number, len: number, kinds: number, seed: number, eggs = 0, eggChance = 0): number {
  for (let i = 0; i < 1000; i++) {
    const s = slotAt(i * len, len, kinds, seed, eggs, eggChance)
    if (s.kind === kind && s.egg < 0) return i * len
  }
  throw new Error(`no slot plays kind ${kind}`)
}

/** The start of the first slot from `t = 0` playing easter egg `egg`. */
export function eggSlot(egg: number, len: number, kinds: number, seed: number, eggs: number, eggChance: number): number {
  for (let i = 0; i < 200000; i++) if (slotAt(i * len, len, kinds, seed, eggs, eggChance).egg === egg) return i * len
  throw new Error(`no slot plays egg ${egg}`)
}
