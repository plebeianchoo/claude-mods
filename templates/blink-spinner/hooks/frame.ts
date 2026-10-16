export const ROWS = 2
export const DEFAULT = 0x01000000

/** One frame: a block bouncing across `columns` cells, `t` ms into the turn. Pure, so tests can call it. */
export function frame(t: number, columns: number): Uint32Array {
  const out = new Uint32Array(columns * ROWS * 3)
  const span = Math.max(1, columns - 1)
  const step = Math.floor(t / 50) % (2 * span)
  const x = step < span ? step : 2 * span - step
  for (let i = 0; i < columns * ROWS; i++) out.set([0x20, DEFAULT, DEFAULT], i * 3)
  for (let r = 0; r < ROWS; r++) out.set([0x2588, 0xd97757, DEFAULT], (r * columns + x) * 3)
  return out
}

/** Cells as RasterProps.cells wants them: base64 of the little-endian u32 triplets. */
export function encode(cells: Uint32Array): string {
  let binary = ''
  for (const byte of new Uint8Array(cells.buffer)) binary += String.fromCharCode(byte)
  return btoa(binary)
}
