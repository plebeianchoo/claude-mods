#!/usr/bin/env bash
# Lays this build's engine types beside the mod so `tsc -p showtime` runs. The
# engine writes them itself only when it hot-reloads the mod from its folder,
# which a marketplace install never does; the plugin-authoring skill's bundle
# carries the same file, so this copies the newest one. Gitignored.
set -euo pipefail
mod="$(cd "$(dirname "$0")/.." && pwd)"
src="$(ls -t /tmp/claude-"$(id -u)"/bundled-skills/*/*/plugin-authoring/types/claude-code.d.ts 2>/dev/null | head -1 || true)"
if [ -z "$src" ]; then
  echo "no engine types found: load the plugin-authoring skill once in an interactive Claude session, then run this again" >&2
  exit 1
fi
mkdir -p "$mod/.claude-plugin/types/claude-code"
cp "$src" "$mod/.claude-plugin/types/claude-code/index.d.ts"
cat > "$mod/.claude-plugin/types/tsconfig.json" <<'EOF'
{
  "compilerOptions": {
    "target": "es2023", "lib": ["es2023"], "types": [],
    "module": "esnext", "moduleResolution": "bundler",
    "strict": true, "noUncheckedIndexedAccess": true,
    "noEmit": true, "skipLibCheck": true,
    "jsx": "react", "jsxFactory": "h", "jsxFragmentFactory": "Fragment"
  },
  "include": ["claude-code", "../../hooks", "../../types", "../../tests"]
}
EOF
head -1 "$src"
