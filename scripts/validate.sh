#!/usr/bin/env bash
# Validate skills, engine, tests, installed links and registered repository policies.
#   scripts/validate.sh          full validation (runs the test suite)
#   scripts/validate.sh --quick  skip the test suite
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v node >/dev/null 2>&1; then
  echo "validate.sh: Node.js 18+ is required" >&2
  exit 1
fi
exec node "$DIR/validate.mjs" "$@"
