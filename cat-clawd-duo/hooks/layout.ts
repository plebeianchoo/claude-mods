// How the spinner row is split between the cat (left) and Clawd (right).
//
// The cat needs a track at least CAT_MIN wide to walk in, and Clawd's scene needs
// CLAWD_MIN; below that the row falls back to stacking them, as the two original
// mods did. EDGE is clawd-spinner's clear margin at the right edge.

export const GAP = 2
export const EDGE = 4
export const CAT_MIN = 44
export const CLAWD_MIN = 50
const CLAWD_MAX = 90
const CLAWD_SHARE = 0.55

export type Split = { cat: number; clawd: number }

// The two widths for a terminal `columns` wide, or null when side by side won't fit.
export const splitColumns = (columns: number): Split | null => {
  const room = columns - EDGE - GAP
  const clawd = Math.min(CLAWD_MAX, Math.max(CLAWD_MIN, Math.floor(room * CLAWD_SHARE)))
  const cat = room - clawd
  return cat >= CAT_MIN && clawd >= CLAWD_MIN ? { cat, clawd } : null
}
