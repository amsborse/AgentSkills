#!/usr/bin/env bash
# Link every skill in this repository into each detected agent's user skill directory.
# Idempotent; never overwrites existing directories or foreign links.
#   scripts/install.sh              install / repair
#   scripts/install.sh --dry-run    show what would change
#   scripts/install.sh --uninstall  remove only the links this installer created
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v node >/dev/null 2>&1; then
  echo "install.sh: Node.js 18+ is required" >&2
  exit 1
fi
exec node "$DIR/install.mjs" "$@"
