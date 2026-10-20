// Clawd out in the scenery: he stands and looks about while Claude thinks,
// works the scene's job while a tool runs, and strolls across while Claude
// writes. A scene dresses him through its outfit once he is drawn, so hats and
// props sit over the right pixels whatever he is doing.
import { clawd, PH as CLAWD_PH, type Pose } from '../clawd/acts'
import { mod, PH, pick, type Canvas, type Moment } from './pixels'

export type { Pose }

/** How wide he is, arms out. */
export const CLAWD_W = 14
/** His ground is below his own canvas's: lift him by the difference, downward. */
const LIFT = CLAWD_PH - PH
const STROLL = 0.012 // px per ms
const MARGIN = 4

export type Visit = {
  x: number // his left edge, whichever way he faces
  facing: 1 | -1
  pose: Pose
  head: { x: number; y: number } // his top-left pixel
  hand: [number, number] // where his working hand is
}

export type Outfit = {
  /** The pose he works in while a tool runs. */
  job: Pose
  /** Hats and props, drawn over him. */
  dress?: (c: Canvas, v: Visit, m: Moment) => void
}

export function visitor(c: Canvas, m: Moment, outfit: Outfit): Visit {
  const spot = MARGIN + pick(m.seed, 900, Math.max(1, c.W - CLAWD_W - 2 * MARGIN))
  let x = spot
  let pose: Pose = 'idle'
  let facing: 1 | -1 = 1
  if (m.state === 'tool') pose = outfit.job
  else if (m.state === 'say') {
    pose = 'walk'
    x = mod(spot + Math.floor(m.t * STROLL), c.W + CLAWD_W) - CLAWD_W
  } else if (Math.floor(m.t / 3000) % 4 === 3) facing = -1 // the odd glance back
  const { hand } = clawd(c, m.t, pose, x, facing, LIFT)
  const head = (c as { clawdAt?: { x: number; y: number } }).clawdAt ?? { x, y: PH - 7 }
  const v: Visit = { x, facing, pose, head, hand }
  outfit.dress?.(c, v, m)
  return v
}
