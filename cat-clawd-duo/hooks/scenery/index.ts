// The scenes the left half can show instead of the cat, in the order they
// take turns (no two alike in colour side by side), and how fast their layers
// scroll for what Claude is doing. Clawd is out in every one of them.
import { cave } from './cave'
import { city } from './city'
import { desert } from './desert'
import { forest } from './forest'
import { garden } from './garden'
import { mountains } from './mountains'
import { ocean } from './ocean'
import { canvas, toCells, type Moment, type Scene, type State } from './pixels'
import { sky } from './sky'
import { space } from './space'

export type { Moment, State } from './pixels'

export const SCENES = ['sky', 'forest', 'city', 'desert', 'ocean', 'garden', 'space', 'mountains', 'cave'] as const
export type SceneName = (typeof SCENES)[number]
/** The scenes as prose: "sky, forest, ... and cave". */
export const SCENE_LIST = `${SCENES.slice(0, -1).join(', ')} and ${SCENES[SCENES.length - 1]}`

const DRAW: Record<SceneName, Scene> = { sky, forest, city, desert, ocean, garden, space, mountains, cave }

/** Pixels per ms the layers scroll: slow while Claude thinks, fast while a tool runs. */
export const PACE: Record<State, number> = { think: 0.004, say: 0.008, tool: 0.02 }

export const isSceneName = (name: string): name is SceneName => (SCENES as readonly string[]).includes(name)

/** The scene after `name`; a random one to start a session. */
export const nextScene = (name: SceneName | undefined, rng: () => number = Math.random): SceneName =>
  name ? SCENES[(SCENES.indexOf(name) + 1) % SCENES.length]! : SCENES[Math.floor(rng() * SCENES.length)]!

/** What Claude is doing: a running tool wins, then thinking, else it is writing. */
export const stateOf = (isToolRunning: boolean, isThinking: boolean): State =>
  isToolRunning ? 'tool' : isThinking ? 'think' : 'say'

/** One frame of a scene, `columns` wide, as Raster cells. */
export function sceneryCells(name: SceneName, columns: number, m: Moment): string {
  const c = canvas(columns)
  DRAW[name](c, m)
  return toCells(c)
}
