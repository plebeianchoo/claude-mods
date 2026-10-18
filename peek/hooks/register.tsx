// peek: a show_image tool for Claude and /img <path> for the person, both drawn
// inline with the terminal's Image element (kitty graphics protocol). Pictures
// go as PNG bytes, so they draw over ssh too; nothing goes to the network and
// nothing is added to the prompt.
import type { EngineInterface, Register, RenderInput } from 'claude-code'

import { boxFor, expand, keyOf, markOf, pathOfMark, pngSize, SHOWABLE } from './fit'

const TOOL = 'mcp__peek__show_image'
// Claude Code refuses PNG bytes over 2 MiB; a 1600 px side is sharp enough
// for a chat-sized box and keeps redraws over ssh quick.
const MAX_BYTES = 2 * 1024 * 1024
const MAX_PX = 1600
const MAX_COLS = 100
const MAX_ROWS = 30

type Picture = { png: string; width: number; height: number; name: string }
// Prepared pictures by file version, so a redraw doesn't convert again.
const prepared = new Map<string, Picture>()
let cacheDir = ''

async function dirOf($: EngineInterface): Promise<string> {
  if (cacheDir) return cacheDir
  const base = (await $.env.get('XDG_RUNTIME_DIR')) || (await $.env.get('TMPDIR')) || '/tmp'
  const r = await $.process.run(['sh', '-c', 'd="$0/peek-$(id -u)"; mkdir -m 700 -p "$d" && [ ! -L "$d" ] && [ -O "$d" ] && printf "%s" "$d"', base.replace(/\/+$/, '')])
  if (r.exitCode !== 0 || !r.stdout.startsWith('/')) throw new Error('could not make its cache folder')
  return (cacheDir = r.stdout)
}

// Reads the file as a PNG that fits: converted by Pillow when it can be, the
// file itself when it is already a small enough PNG.
async function prepare($: EngineInterface, given: string): Promise<{ path: string; picture: Picture }> {
  const path = expand(given, await $.session.cwd(), (await $.env.get('HOME')) ?? '')
  if (!SHOWABLE.test(path)) throw new Error(`not an image (png, jpg, webp, gif, bmp, tiff): ${path}`)
  const st = await $.fs.stat(path).catch(() => null)
  if (!st || st.kind !== 'file') throw new Error(`no such file: ${path}`)
  const key = keyOf(`${path}|${st.size}|${st.mtimeMs}`)
  const name = path.split('/').pop() ?? path
  const hit = prepared.get(key)
  if (hit) return { path, picture: hit }

  const out = `${await dirOf($)}/${key}.png`
  const converted = await $.process
    .run(['python3', '-I', `${$.plugin.root}/scripts/topng.py`, path, out, String(MAX_PX), String(MAX_BYTES)], { timeoutMs: 20_000 })
    .catch(() => null)
  const source = converted?.exitCode === 0 ? out : /\.png$/i.test(path) && st.size <= MAX_BYTES ? path : null
  if (!source) throw new Error(`could not convert ${name} (python3 with Pillow is needed for anything but a small PNG)`)

  const { base64 } = await $.fs.read(source, { as: 'bytes' })
  const size = pngSize(Uint8Array.fromBase64(base64.slice(0, 44)))
  if (!size) throw new Error(`${name} is not a readable PNG`)
  const picture = { png: base64, ...size, name }
  prepared.set(key, picture)
  // A handful is plenty for a scrollback; the oldest goes first.
  if (prepared.size > 12) prepared.delete(prepared.keys().next().value!)
  return { path, picture }
}

// The picture and its name under it, sized to the room the row has.
// Only the terminal has an Image element; other surfaces draw the row as usual.
async function draw($: EngineInterface, e: RenderInput<'ToolResult' | 'CommandOutput', 'terminal'>, path: string) {
  const { Box, Text, Image } = $.ui.resolve(e)
  try {
    const { picture } = await prepare($, path)
    const maxCols = Math.min(MAX_COLS, (e.viewport?.columns ?? 80) - 4)
    const { columns, rows } = boxFor(picture.width, picture.height, maxCols, MAX_ROWS)
    return (
      <Box flexDirection="column">
        <Image source={{ png: picture.png }} columns={columns} rows={rows} alt={`[image: ${picture.name}]`} />
        <Text dimColor>{`${picture.name} · ${picture.width}×${picture.height}`}</Text>
      </Box>
    )
  } catch (err) {
    return <Text dimColor>{`peek: ${(err as Error).message}`}</Text>
  }
}

const textOf = (output: unknown) => (typeof output === 'string' ? output : JSON.stringify(output ?? ''))

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'img', description: 'Show an image inline: /img <path>', argumentHint: '<path>' })
    await $.tool.register({
      name: 'show_image',
      description:
        'Shows an image file (PNG, JPEG, WebP, GIF, BMP, TIFF) to the user inline in their terminal. Use it when the user asks to see an image, or when a picture is the answer (a screenshot, chart or design you made). The image goes to the user\'s screen, not to you: Read the file yourself if you need to look at it.',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Path to the image, absolute or relative to the working folder' } },
        required: ['path'],
      },
      isDeferred: false,
    })
    return started
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const given = (e as unknown as { path?: unknown }).path
    if (typeof given !== 'string' || !given) return { deny: 'peek: a path is needed.' }
    try {
      const { path, picture } = await prepare($, given)
      return { result: `Shown to the user: ${picture.name} (${picture.width}×${picture.height}). You did not see it.\n${markOf(path)}` }
    } catch (err) {
      return { deny: `peek: ${(err as Error).message}` }
    }
  }).catch(() => ({ deny: 'peek: the image could not be shown.' }))

  on('command.run', { command: 'img' }, async ($, invoked) => {
    const arg = invoked.args.trim()
    if (!arg) return { text: 'Usage: /img <path>' }
    try {
      const { path, picture } = await prepare($, arg)
      return { text: `${picture.name}\n${markOf(path)}` }
    } catch (err) {
      return { text: `peek: ${(err as Error).message}` }
    }
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    const props = e.props as { tool: string; output: unknown; isErrored: boolean }
    if (e.surface !== 'terminal' || props.tool !== TOOL || props.isErrored) return next(e)
    const path = pathOfMark(textOf(props.output))
    return path ? draw($, e, path) : next(e)
  })

  on('ui.render', { component: 'CommandOutput' }, async ($, e, next) => {
    const row = e.props as { command: string; text: string; isErrored: boolean }
    if (e.surface !== 'terminal' || row.command !== 'img' || row.isErrored) return next(e)
    const path = pathOfMark(row.text ?? '')
    return path ? draw($, e, path) : next(e)
  })
}
