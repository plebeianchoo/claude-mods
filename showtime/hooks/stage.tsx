// The band's scene: the theme's scene while a turn runs, its finale once the
// turn has ended. Runs on the drawing thread. The pet beside it is drawn
// apart (kit/pet-player.tsx), so it can stand beside the HUD as well.
import type { ClientModule } from 'claude-code'

import { STAGE_MS, finaleScene, segments, themeOf } from './themes'
import type { Act, Finale, Signals } from './themes'

export type StageProps = {
  theme: string
  /** Cells the scene takes across. */
  columns: number
  /** What the scene reacts to; the stage adds the ages. */
  signals: Omit<Signals, 'newsAge' | 'actAge' | 'doneAge' | 'agentsAge'> & { newsId?: string }
  finale?: Finale
  label?: string
  /** One frame, never redrawn (reduced motion). */
  still?: boolean
}

/** Each instance's last-seen signals and the tick they changed at. */
const stages = new WeakMap<object, { act: Act; actAt: number; done: number; doneAt: number; agents: number; agentsAt: number; newsId?: string; newsAt: number }>()

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
  let m = stages.get(surface)
  if (m === undefined) {
    m = { act: props.signals.act, actAt: t, done: props.signals.done, doneAt: t, agents: props.signals.agents, agentsAt: t, newsId: props.signals.newsId, newsAt: t }
    stages.set(surface, m)
  }
  if (props.signals.act !== m.act) { m.act = props.signals.act; m.actAt = t }
  if (props.signals.done !== m.done) { m.done = props.signals.done; m.doneAt = t }
  if (props.signals.agents !== m.agents) { m.agents = props.signals.agents; m.agentsAt = t }
  if (props.signals.newsId !== m.newsId) { m.newsId = props.signals.newsId; m.newsAt = t }
  const s: Signals = {
    ...props.signals,
    actAge: t - m.actAt,
    doneAge: t - m.doneAt,
    agentsAge: t - m.agentsAt,
    newsAge: props.signals.news ? t - m.newsAt : 999,
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
