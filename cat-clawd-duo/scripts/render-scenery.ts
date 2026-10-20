// Renders a scene's three states (think, tool, say) stacked into a PNG, each
// pixel scaled up, for looking at a frame without a terminal: hats, props and
// silhouettes read at a glance where a character map cannot once the
// gradients are dithered. Read the PNG back with an image viewer (or Claude's
// Read tool) after each change, and regenerate tests/golden.ts only once the
// look is right.
//   bun scripts/render-scenery.ts <out.png> <scene> [seed] [columns] [t-think t-tool t-say]
import { deflateSync } from 'node:zlib'
import { isSceneName, PACE, SCENES, sceneryCells, type State } from '../hooks/scenery'
import { DEF, PH, ROWS } from '../hooks/scenery/pixels'

const [out, sceneArg, seedArg = '0', columnsArg = '70', ...times] = process.argv.slice(2)
if (!out || !sceneArg || !isSceneName(sceneArg)) {
  console.error(`usage: bun scripts/render-scenery.ts <out.png> <${SCENES.join('|')}> [seed] [columns] [t-think t-tool t-say]`)
  process.exit(2)
}
const name = sceneArg
const seed = Number(seedArg)
const W = Number(columnsArg)
const SCALE = 6
const GAP = 4
const STATES: State[] = ['think', 'tool', 'say']
const T = times.length === 3 ? times.map(Number) : [3000, 3300, 3000]
const BACK = 0x202020

// Each state's frame back as pixels, PH rows of W, from the cells the terminal would get.
const frames = STATES.map((state, i) => {
  const t = T[i]!
  const words = new Uint32Array(Uint8Array.from(atob(sceneryCells(name, W, { t, dist: t * PACE[state], state, seed })), ch => ch.charCodeAt(0)).buffer)
  const px = new Uint32Array(W * PH).fill(DEF)
  for (let row = 0; row < ROWS; row++) {
    for (let x = 0; x < W; x++) {
      const [cp, fg, bg] = [words[(row * W + x) * 3]!, words[(row * W + x) * 3 + 1]!, words[(row * W + x) * 3 + 2]!]
      if (cp === 0x2580) (px[2 * row * W + x] = fg), (px[(2 * row + 1) * W + x] = bg)
      else if (cp === 0x2584) px[(2 * row + 1) * W + x] = fg
    }
  }
  return px
})

const IW = W * SCALE
const IH = frames.length * PH * SCALE + (frames.length - 1) * GAP
const stride = IW * 3 + 1
const raw = new Uint8Array(IH * stride)
for (let y = 0; y < IH; y++) {
  const f = Math.floor(y / (PH * SCALE + GAP))
  const fy = y - f * (PH * SCALE + GAP)
  for (let x = 0; x < IW; x++) {
    let p = BACK
    if (fy < PH * SCALE) {
      const q = frames[f]![Math.floor(fy / SCALE) * W + Math.floor(x / SCALE)]!
      p = q === DEF ? 0x1a1a1a : q
    }
    const o = y * stride + 1 + x * 3
    raw[o] = (p >> 16) & 255
    raw[o + 1] = (p >> 8) & 255
    raw[o + 2] = p & 255
  }
}

// A minimal PNG: 8-bit RGB, one unfiltered scanline per row.
const crcTable = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})
const crc = (b: Uint8Array) => {
  let c = -1
  for (const x of b) c = crcTable[(c ^ x) & 255]! ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const u32 = (n: number) => {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n)
  return b
}
const chunk = (type: string, data: Uint8Array) => {
  const body = new Uint8Array(4 + data.length)
  body.set(new TextEncoder().encode(type))
  body.set(data, 4)
  return [u32(data.length), body, u32(crc(body))]
}
const ihdr = new Uint8Array(13)
ihdr.set(u32(IW), 0)
ihdr.set(u32(IH), 4)
ihdr.set([8, 2, 0, 0, 0], 8)
await Bun.write(out, new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), ...chunk('IHDR', ihdr), ...chunk('IDAT', new Uint8Array(deflateSync(raw))), ...chunk('IEND', new Uint8Array(0))]))
console.log(`${out}: ${name}, seed ${seed}, ${IW}x${IH}`)
