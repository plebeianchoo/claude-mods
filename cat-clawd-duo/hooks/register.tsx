import type { Register } from 'claude-code'

import { register as registerCat } from './cat'
import { register as registerClawd } from './clawd/clawd'

// The cat registers first, so its Spinner hook is the outer one: it draws the cat
// and lays Clawd's drawing (from next) beside it in one row.
export const register: Register = (on, options) => {
  registerCat(on, options)
  registerClawd(on, options)
}
