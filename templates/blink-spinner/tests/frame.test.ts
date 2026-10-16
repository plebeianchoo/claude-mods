import { expect, test } from 'claude-code/testing'

import { encode, frame, ROWS } from '../hooks/frame'

test('a frame fills columns x rows cells with exactly one block per row', () => {
  for (const t of [0, 500, 12_345]) {
    const cells = frame(t, 40)
    expect(cells.length).toBe(40 * ROWS * 3)
    expect(cells.filter((v, i) => i % 3 === 0 && v === 0x2588).length).toBe(ROWS)
  }
})

test('encode packs one cell as 12 little-endian bytes', () => {
  expect(encode(Uint32Array.of(0x2588, 0xff8800, 0x01000000))).toBe(btoa(String.fromCharCode(0x88, 0x25, 0, 0, 0, 0x88, 0xff, 0, 0, 0, 0, 1)))
})
