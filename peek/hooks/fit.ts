// Pure helpers: which files can be shown, the marker a result carries, the
// PNG header, and the box of cells a picture is drawn in.

// What can be shown at all: anything else is refused before it is read.
export const SHOWABLE = /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i

// The line a tool result or /img row carries, so the render hook knows what
// to draw. The path is URI-encoded so it stays on one line. Not 'peek:': the
// engine heads a command's row with the plugin's name, which would match.
export const MARK = 'peek-image:'
export const markOf = (path: string) => `${MARK}${encodeURIComponent(path)}`
export function pathOfMark(text: string): string | null {
  const line = text.split('\n').findLast(l => l.startsWith(MARK))
  if (!line) return null
  try {
    return decodeURIComponent(line.slice(MARK.length))
  } catch {
    return null
  }
}

// ~ and relative paths, against home and the session's folder.
export function expand(path: string, cwd: string, home: string): string {
  const p = path.trim()
  if (p === '~') return home
  if (p.startsWith('~/')) return `${home}/${p.slice(2)}`
  if (p.startsWith('/')) return p
  return `${cwd.replace(/\/+$/, '')}/${p}`
}

// A PNG's size from its IHDR chunk (bytes 16..24), or null if it isn't one.
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length < 24 || SIG.some((b, i) => bytes[i] !== b)) return null
  const at = (i: number) => ((bytes[i]! << 24) | (bytes[i + 1]! << 16) | (bytes[i + 2]! << 8) | bytes[i + 3]!) >>> 0
  return { width: at(16), height: at(20) }
}

// Cells are taken to be twice as tall as wide (tmux reports no pixel size), and
// about 8 pixels wide, so a small picture is not blown up past its pixels.
const CELL_PX = 8
export function boxFor(width: number, height: number, maxCols: number, maxRows: number): { columns: number; rows: number } {
  const clamp = (n: number, hi: number) => Math.max(1, Math.min(hi, Math.round(n)))
  let columns = Math.min(maxCols, Math.ceil(width / CELL_PX))
  let rows = (columns * height) / width / 2
  if (rows > maxRows) {
    rows = maxRows
    columns = (rows * 2 * width) / height
  }
  return { columns: clamp(columns, 255), rows: clamp(rows, 255) }
}

// A short stable key for a file's version: FNV-1a over path, size and mtime.
export function keyOf(text: string): string {
  let x = 0x811c9dc5
  for (let i = 0; i < text.length; i++) x = Math.imul(x ^ text.charCodeAt(i), 0x01000193) >>> 0
  return x.toString(16).padStart(8, '0')
}
