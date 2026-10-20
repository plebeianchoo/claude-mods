// Animates a scene in this terminal (truecolor), as the duo's left half draws
// it, cycling what Claude is doing: think, tool, say, a few seconds each.
//   bun scripts/preview-scenery.ts [sky|city|ocean|space] [seconds] [columns] [seed]
import { isSceneName, PACE, SCENES, sceneryCells, type State } from '../hooks/scenery'
import { ROWS } from '../hooks/scenery/pixels'

const DEF = 0x01000000
const FRAME_MS = 90
const STATES: State[] = ['think', 'tool', 'say']

const arg = process.argv[2] ?? 'sky'
const name = isSceneName(arg) ? arg : SCENES[0]
const seconds = Number(process.argv[3] ?? 12)
const columns = Number(process.argv[4] ?? 70)
const seed = process.argv[5] ? Number(process.argv[5]) : Math.floor(Math.random() * 2 ** 31)

const fg = (c: number) => (c === DEF ? '\x1b[39m' : `\x1b[38;2;${(c >> 16) & 255};${(c >> 8) & 255};${c & 255}m`)
const bg = (c: number) => (c === DEF ? '\x1b[49m' : `\x1b[48;2;${(c >> 16) & 255};${(c >> 8) & 255};${c & 255}m`)

const render = (cells: string) => {
  const w = new Uint32Array(Uint8Array.from(atob(cells), ch => ch.charCodeAt(0)).buffer)
  const lines: string[] = []
  for (let row = 0; row < ROWS; row++) {
    let line = ''
    for (let x = 0; x < columns; x++) {
      const i = (row * columns + x) * 3
      line += fg(w[i + 1]!) + bg(w[i + 2]!) + String.fromCodePoint(w[i]!)
    }
    lines.push(line + '\x1b[0m')
  }
  return lines.join('\n')
}

let t = 0
let dist = 0
let pace = PACE.think
const frames = Math.floor((seconds * 1000) / FRAME_MS)
process.stdout.write('\x1b[?25l')
for (let f = 0; f < frames; f++) {
  const state = STATES[Math.floor((f / frames) * STATES.length)]!
  pace += (PACE[state] - pace) * 0.2
  t += FRAME_MS
  dist += pace * FRAME_MS
  if (f > 0) process.stdout.write(`\x1b[${ROWS + 1}A`)
  process.stdout.write(`${render(sceneryCells(name, columns, { t, dist, state, seed }))}\n\x1b[2K${name}  ${state}  seed ${seed}\n`)
  await Bun.sleep(FRAME_MS)
}
process.stdout.write('\x1b[?25h')
