import { expect, test } from 'claude-code/testing'

import { boxFor, expand, idAboveCaption, keyOf, markOf, pathOfMark, pngSize, SHOWABLE } from '../hooks/fit'

test('a marker round-trips a path with spaces and newlines', () => {
  const path = '/tmp/my shots/a\nb.png'
  expect(pathOfMark(`Shown it.\n${markOf(path)}`)).toBe(path)
  expect(pathOfMark('no marker here')).toBe(null)
})

test("the engine's 'peek: ' row heading is not taken for the marker", () => {
  expect(pathOfMark(`peek: big.jpg\n${markOf('/tmp/big.jpg')}`)).toBe('/tmp/big.jpg')
})

test('paths expand against home and the working folder', () => {
  expect(expand('~/a.png', '/w', '/home/u')).toBe('/home/u/a.png')
  expect(expand('b.png', '/w/', '/home/u')).toBe('/w/b.png')
  expect(expand('/abs.png', '/w', '/home/u')).toBe('/abs.png')
})

test('only image files are showable', () => {
  expect(SHOWABLE.test('/x/a.JPG')).toBe(true)
  expect(SHOWABLE.test('/x/a.webp')).toBe(true)
  expect(SHOWABLE.test('/home/u/.ssh/id_ed25519')).toBe(false)
  expect(SHOWABLE.test('/x/config.json')).toBe(false)
})

test('pngSize reads the IHDR width and height', () => {
  const header = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0x06, 0x40, 0, 0, 0x03, 0x84)
  expect(pngSize(header)).toEqual({ width: 1600, height: 900 })
  expect(pngSize(Uint8Array.of(0xff, 0xd8, 0xff))).toBe(null)
})

test('a wide picture fills the columns and keeps its shape in 2:1 cells', () => {
  expect(boxFor(1600, 900, 100, 30)).toEqual({ columns: 100, rows: 28 })
})

test('a tall picture is capped by rows and narrowed to match', () => {
  expect(boxFor(900, 1600, 100, 30)).toEqual({ columns: 34, rows: 30 })
})

test('a small picture is not blown up past its pixels', () => {
  expect(boxFor(80, 40, 100, 30)).toEqual({ columns: 10, rows: 3 })
})

test('keys differ when the file changes', () => {
  expect(keyOf('/a.png|10|1')).not.toBe(keyOf('/a.png|10|2'))
  expect(keyOf('/a.png|10|1')).toHaveLength(8)
})

test('idAboveCaption reads a 256-colour id from the rows above the newest caption', () => {
  const row = (sgr: string) => `\x1b[${sgr}m\u{10EEEE}̅̅\u{10EEEE}̅̍\x1b[39m`
  const shot = ['old.png · 10×10', row('38;5;3'), row('38;5;1'), '\x1b[2mbig.jpg · 1600×1000\x1b[22m', '❯ '].join('\n')
  expect(idAboveCaption(shot, 'big.jpg · 1600×1000')).toBe(1)
  expect(idAboveCaption(`${row('38:2:0:1:44')}\nx.png · 1×1`, 'x.png · 1×1')).toBe(300)
  expect(idAboveCaption('no picture here', 'big.jpg · 1600×1000')).toBe(null)
})
