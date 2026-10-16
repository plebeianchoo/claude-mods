import type { EngineInterface, Register } from 'claude-code'

import { encode, frame, ROWS } from './frame'

const FRAME_MS = 50
const KEY = 'bounce'

// Module state: a hot reload resets it, which is fine for an animation.
const spin = { turnAt: 0, working: false, last: '', mount: null as { requestId: string; columns: number } | null }

async function paint($: EngineInterface) {
  const m = spin.mount
  if (!m || !spin.working) return
  const cells = encode(frame((await $.clock.now()) - spin.turnAt, m.columns))
  if (cells === spin.last) return
  spin.last = cells
  const r = await $.ui.blit({ requestId: m.requestId, key: KEY, cells })
  if (r.deny) $.ui.invalidate('ui.render')  // unmounted or resized: redraw instead
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    if (e.isInteractive) $.clock.every(FRAME_MS, () => void paint($))
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (!spin.working) [spin.working, spin.turnAt] = [true, await $.clock.now()]
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (!e.agentId) [spin.working, spin.mount] = [false, null]  // ignore subagent turns ending
    return done
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const columns = (e.viewport?.columns ?? 0) - 4
    if (e.surface !== 'terminal' || columns < 20) {
      spin.mount = null
      return next(e)  // Raster is terminal-only: leave other surfaces alone
    }
    const { Box, Raster } = $.ui.resolve(e)
    const now = await $.clock.now()
    if (!spin.working) [spin.working, spin.turnAt] = [true, now]  // reloaded mid-turn
    spin.mount = { requestId: e.requestId, columns }
    spin.last = encode(frame(now - spin.turnAt, columns))
    return (
      <Box flexDirection="column">
        <Raster key={KEY} columns={columns} rows={ROWS} cells={spin.last} />
        {await next(e)}
      </Box>
    )
  })
}
