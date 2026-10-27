// The band's scene: the theme's scene while a turn runs, its finale once the
// turn has ended. Runs on the drawing thread. The pet beside it is drawn
// apart (kit/pet-player.tsx), so it can stand beside the HUD as well.
import type { ClientModule } from 'claude-code'

import { STAGE_MS, finaleScene, segments, themeOf } from './themes'
import type { Act, Finale, Signals, ToolKind } from './themes'

export type StageProps = {
  theme: string
  /** Cells the scene takes across. */
  columns: number
  /** What the scene reacts to; the stage adds the ages and the epoch. */
  signals: Omit<Signals, 'newsAge' | 'actAge' | 'doneAge' | 'agentsAge' | 'toolAge' | 'epoch'> & { newsId?: string }
  finale?: Finale
  label?: string
  /** One frame, never redrawn (reduced motion). */
  still?: boolean
}

/** Each instance's last-seen signals and the tick they changed at, and the epoch it drew when it mounted. */
const stages = new WeakMap<object, { act: Act; actAt: number; tool?: ToolKind; toolAt: number; done: number; doneAt: number; agents: number; agentsAt: number; newsId?: string; newsAt: number; epoch: number }>()
/** How many epochs the stage draws from. */
const EPOCHS = 4096

const Stage: ClientModule<StageProps, number> = (props, surface) => {
  const { Box, Text } = surface.elements
  if (surface.state === undefined && !props.still) {
    let tick = 0
    surface.every(STAGE_MS, () => surface.setState(++tick))
    surface.setState(0)
  }
  const t = surface.state ?? 0
  const theme = themeOf(props.theme)
  const w = Math.max(16, Math.min(surface.columns || props.columns, props.columns))
  let mem = stages.get(surface)
  if (mem === undefined) {
    mem = { act: props.signals.act, actAt: t, tool: props.signals.tool, toolAt: t, done: props.signals.done, doneAt: t, agents: props.signals.agents, agentsAt: t, newsId: props.signals.newsId, newsAt: t, epoch: Math.floor(Math.random() * EPOCHS) }
    stages.set(surface, mem)
  }
  if (props.signals.act !== mem.act) { mem.act = props.signals.act; mem.actAt = t }
  if (props.signals.tool !== mem.tool) { mem.tool = props.signals.tool; mem.toolAt = t }
  if (props.signals.done !== mem.done) { mem.done = props.signals.done; mem.doneAt = t }
  if (props.signals.agents !== mem.agents) { mem.agents = props.signals.agents; mem.agentsAt = t }
  if (props.signals.newsId !== mem.newsId) { mem.newsId = props.signals.newsId; mem.newsAt = t }
  const s: Signals = {
    ...props.signals,
    actAge: t - mem.actAt,
    doneAge: t - mem.doneAt,
    agentsAge: t - mem.agentsAt,
    newsAge: props.signals.news ? t - mem.newsAt : 999,
    toolAge: props.signals.tool ? t - mem.toolAt : 999,
    epoch: mem.epoch,
  }
  const rows = props.finale ? finaleScene(theme, props.finale, props.label ?? '', t, w) : theme.scene(t, w, s)

  return (
    <Box flexDirection="column">
      {rows.map(row => (
        <Text wrap="truncate">
          {segments(row).map(seg => (
            <Text color={seg.c} backgroundColor={seg.bg} bold={seg.b} dimColor={seg.d}>
              {seg.text}
            </Text>
          ))}
        </Text>
      ))}
    </Box>
  )
}

export default Stage
