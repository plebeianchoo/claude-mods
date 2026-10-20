// How the spinner row is split between the cat (left) and Clawd (right).
//
// The scene (or the cat's track) needs at least CAT_MIN columns, and Clawd's act
// CLAWD_MIN; below that the row falls back to stacking them, as the two original
// mods did. Clawd takes CLAWD_SHARE of what is left, capped at CLAWD_MAX, so the
// scenery gets the larger half. EDGE is clawd-spinner's clear margin at the right edge.

export const GAP = 2
export const EDGE = 4
export const CAT_MIN = 44
export const CLAWD_MIN = 48
const CLAWD_MAX = 80
const CLAWD_SHARE = 0.48

export type Split = { cat: number; clawd: number }

// The two widths for a terminal `columns` wide, or null when side by side won't fit.
export const splitColumns = (columns: number): Split | null => {
  const room = columns - EDGE - GAP
  const clawd = Math.min(CLAWD_MAX, Math.max(CLAWD_MIN, Math.floor(room * CLAWD_SHARE)))
  const cat = room - clawd
  return cat >= CAT_MIN && clawd >= CLAWD_MIN ? { cat, clawd } : null
}
