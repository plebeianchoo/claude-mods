// `/showtime`'s arguments to what they ask for; register.tsx carries it out.
import { isThemeName } from './themes'
import type { ThemeName } from './themes'

export type SpinnerCommand =
  | { kind: 'status' }
  | { kind: 'visible'; isOn: boolean }
  | { kind: 'stage'; isOn: boolean }
  | { kind: 'companion'; isOn: boolean }
  | { kind: 'feed'; isOn: boolean }
  | { kind: 'pat' }
  | { kind: 'preview'; theme: ThemeName | null }
  | { kind: 'theme'; theme: ThemeName | 'random' | 'rotate' }
  | { kind: 'pick' }
  | { kind: 'unknown'; name: string }

export const USAGE = '[theme|random|rotate|pet|preview|off|on|stage off|companion off|feed off]'

export function parseCommand(args: string): SpinnerCommand {
  const [verb = '', arg = ''] = args.trim().toLowerCase().split(/\s+/)
  const isSwitch = arg === 'off' || arg === 'on'
  if (verb === '') return { kind: 'status' }
  if (verb === 'off' || verb === 'on') return { kind: 'visible', isOn: verb === 'on' }
  if (verb === 'stage' && isSwitch) return { kind: 'stage', isOn: arg === 'on' }
  if (verb === 'companion' && isSwitch) return { kind: 'companion', isOn: arg === 'on' }
  if (verb === 'feed' && isSwitch) return { kind: 'feed', isOn: arg === 'on' }
  if (verb === 'pet') return { kind: 'pat' }
  if (verb === 'preview') {
    if (!arg) return { kind: 'preview', theme: null }
    return isThemeName(arg) ? { kind: 'preview', theme: arg } : { kind: 'unknown', name: arg }
  }
  // `theme` alone asks which; `theme <name>` is the same as `<name>`.
  if (verb === 'theme') {
    if (!arg) return { kind: 'pick' }
    return arg === 'random' || arg === 'rotate' || isThemeName(arg) ? { kind: 'theme', theme: arg } : { kind: 'unknown', name: arg }
  }
  if (verb === 'random' || verb === 'rotate' || isThemeName(verb)) return { kind: 'theme', theme: verb }
  return { kind: 'unknown', name: verb }
}
