#!/usr/bin/env bash
# vm-session: hand a task to a headless Claude Code session on the Oracle VM.
#
#   vm-session.sh start  <id> <branch>      bundle <branch> from this repo, clone it on the VM
#   vm-session.sh task   <id> <task-file>   copy the task text to the VM (becomes the prompt)
#   vm-session.sh run    <id> --confirm     start claude -p in the background (uses subscription)
#   vm-session.sh status <id>               running? last lines of the log
#   vm-session.sh result <id> [dest-dir]    copy back a patch of the work and the log
#   vm-session.sh stop   <id>               stop a running session
#
# Each <id> is its own clone under ~/offload/<id>/work on the VM. The clone has no origin
# remote, and git push / ssh / scp / gh are disallowed for the session. The production
# checkout (~/Sutra) and the dev checkout (~/Sutra-dev) are never touched.
# Env overrides: VM_HOST, VM_KEY, VM_CLAUDE_BIN (use a fake claude for tests).
set -euo pipefail

VM_HOST="${VM_HOST:-ubuntu@129.146.167.177}"
VM_KEY="${VM_KEY:-$HOME/.ssh/sutra-oracle.key}"
VM_CLAUDE_BIN="${VM_CLAUDE_BIN:-\$HOME/.local/bin/claude}"
TIMEOUT_SECS="${VM_SESSION_TIMEOUT:-5400}"
SSH=(ssh -i "$VM_KEY" -o BatchMode=yes -o ConnectTimeout=20 "$VM_HOST")
SCP=(scp -i "$VM_KEY" -o BatchMode=yes -o ConnectTimeout=20)

die() { echo "[vm-session] ERROR: $*" >&2; exit 1; }
check_id() { [[ "${1:-}" =~ ^[a-z0-9][a-z0-9-]{0,39}$ ]] || die "id must be lowercase letters, digits and dashes (got '${1:-}')"; }
remote() { "${SSH[@]}" "$@"; }

cmd="${1:-}"; id="${2:-}"
[ -n "$cmd" ] || die "usage: vm-session.sh start|task|run|status|result|stop <id> [...]"
[ "$cmd" = "help" ] && { sed -n '2,15p' "$0"; exit 0; }
check_id "$id"
dir="\$HOME/offload/$id"

case "$cmd" in
start)
  branch="${3:?branch required}"
  git rev-parse --verify -q "refs/heads/$branch" >/dev/null || die "no local branch '$branch'"
  base="$(git rev-parse "refs/heads/$branch")"
  tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
  git bundle create "$tmp/work.bundle" "refs/heads/$branch" >/dev/null
  remote "set -e; test ! -e $dir || { echo 'exists'; exit 3; }; mkdir -p $dir"
  "${SCP[@]}" "$tmp/work.bundle" "$VM_HOST:/tmp/vm-session-$id.bundle"
  remote "set -e; git clone -q --branch '$branch' /tmp/vm-session-$id.bundle $dir/work; rm -f /tmp/vm-session-$id.bundle; cd $dir/work; git remote remove origin 2>/dev/null || true; echo '$base' > $dir/BASE; echo '$branch' > $dir/BRANCH"
  echo "[vm-session] $id ready at $dir/work (branch $branch, base ${base:0:8}, no origin remote)"
  ;;
task)
  file="${3:?task file required}"
  [ -f "$file" ] || die "no such file: $file"
  "${SCP[@]}" "$file" "$VM_HOST:offload/$id/TASK.md"
  echo "[vm-session] task copied to $dir/TASK.md"
  ;;
run)
  [ "${3:-}" = "--confirm" ] || die "run starts a paid-usage Claude session on the VM. Re-run with --confirm after the owner approves."
  remote "set -e; test -f $dir/TASK.md || { echo 'no TASK.md'; exit 4; }; test -d $dir/work || { echo 'no work clone'; exit 4; }; test ! -f $dir/pid || ! kill -0 \$(cat $dir/pid) 2>/dev/null || { echo 'already running'; exit 5; }"
  remote "cat > $dir/run.sh" <<EOF
#!/usr/bin/env bash
# Runs inside ~/offload/$id. API key is removed so the session uses the subscription login.
export PATH="\$HOME/.local/bin:\$PATH"
unset ANTHROPIC_API_KEY ANTHROPIC_BASE_URL
cd "\$(dirname "\$0")/work" || exit 1
echo "started \$(date -u +%FT%TZ)"
timeout $TIMEOUT_SECS $VM_CLAUDE_BIN -p "\$(cat ../TASK.md)" --permission-mode acceptEdits --disallowedTools "Bash(git push:*)" "Bash(ssh:*)" "Bash(scp:*)" "Bash(gh:*)" "Bash(rm -rf:*)"
code=\$?
echo "exit \$code \$(date -u +%FT%TZ)"
echo \$code > ../done
EOF
  remote "chmod +x $dir/run.sh; rm -f $dir/done; nohup bash $dir/run.sh > $dir/run.log 2>&1 < /dev/null & echo \$! > $dir/pid; echo started pid \$(cat $dir/pid)"
  ;;
status)
  remote "d=$dir; if [ -f \$d/done ]; then echo \"state: finished (exit \$(cat \$d/done))\"; elif [ -f \$d/pid ] && kill -0 \$(cat \$d/pid) 2>/dev/null; then echo 'state: running'; elif [ -f \$d/pid ]; then echo 'state: stopped without finishing'; else echo 'state: not started'; fi; tail -n 20 \$d/run.log 2>/dev/null || true"
  ;;
result)
  dest="${3:-$(pwd)/offload-$id}"
  mkdir -p "$dest"
  remote "set -e; cd $dir/work; git add -A; git diff --cached \$(cat $dir/BASE) > $dir/result.patch; git diff --cached --stat \$(cat $dir/BASE) | tail -n 1"
  "${SCP[@]}" "$VM_HOST:offload/$id/result.patch" "$dest/result.patch"
  "${SCP[@]}" "$VM_HOST:offload/$id/run.log" "$dest/run.log" || true
  echo "[vm-session] saved $dest/result.patch and $dest/run.log (review the patch before applying)"
  ;;
stop)
  remote "d=$dir; if [ -f \$d/pid ] && kill -0 \$(cat \$d/pid) 2>/dev/null; then pkill -P \$(cat \$d/pid) 2>/dev/null || true; kill \$(cat \$d/pid) && echo stopped; else echo 'not running'; fi"
  ;;
*) die "unknown command '$cmd'" ;;
esac
