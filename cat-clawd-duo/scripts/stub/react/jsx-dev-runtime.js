// Only for scripts/: hooks/cat.tsx's JSX compiles to this import under bun, and
// nothing renders while fingerprinting, so it never runs.
export const jsxDEV = () => null
export const Fragment = null
