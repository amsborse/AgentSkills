# codex-bridge: how Claude calls Codex

Shared by the `review-code` and `coordinate-agents` skills and the `revamp-ui` codex-visual workflow.

The no-push, no-commit rules below bind the **delegated agent** (Codex or OpenCode). They don't
change what the orchestrating agent may do: it still follows the working agreements, which allow a
push only when the user asked for it in this task.

## What it is

- `codex-bridge` (on PATH via `~/.local/bin`, source `~/.local/lib/codex-bridge/codex-bridge.mjs`) wraps
  the Codex CLI that ships inside the Codex desktop app (`OpenAI.Codex` Store package,
  `app\resources\codex.exe`). It resolves that path through `Get-AppxPackage`, so app updates don't break it.
- `codex` on PATH is a pass-through shim to the same binary.
- Auth is the user's ChatGPT subscription. The bridge **refuses to run** if Codex is logged in with an API
  key (paid) unless `--allow-api-key` is passed, which needs the owner's explicit approval. It also strips
  `OPENAI_API_KEY` / `CODEX_API_KEY` from the child environment.
- No MCP: this Codex build has no `mcp-server`, and long Codex runs fit Bash's timeout, background
  and stop controls better than a blocking MCP call.

## Commands

```bash
codex-bridge doctor                      # exe path, version, auth mode, image_generation flag
codex-bridge run --cd DIR --prompt "..." [--sandbox read-only|workspace-write] [--timeout SEC]
                 [--image F]... [--assets-dir DIR --asset-prefix NAME] [--add-dir DIR]...
                 [--model M] [--effort low|medium|high|xhigh] [--kind LABEL] [--prompt-file F]
codex-bridge review --cd REPO [--base BRANCH | --commit SHA] [--prompt "focus"]   # default: uncommitted
codex-bridge list                        # recent runs
codex-bridge cancel RUN_ID | --last      # kills the Codex process tree
```

Every run prints one JSON summary to stdout: `runId, status (ok|failed|timeout|cancelled), exitCode,
threadId, durationSec, usage, errors, assets[], lastMessagePath, runDir, lastMessage`, plus `stderrTail`
on failure. Exit code is 0 only for `ok`. Full logs (`prompt.md`, `events.jsonl`, `stderr.log`,
`last-message.md`, `status.json`) are in `%LOCALAPPDATA%\codex-bridge\runs\<runId>\`.

## Rules

- **Sandbox:** default `read-only`. Use `workspace-write` only when Codex must create files, and only with
  `--cd` pointing at the folder it may change. `danger-full-access` is not exposed.
- **Role contract:** the bridge prepends one to every prompt (stay in scope, no delegation, no
  commit/push/deploy, no destructive commands, no secrets, report changed files). Don't repeat it.
- **No recursion:** the bridge sets `CODEX_BRIDGE_ACTIVE` for the child and refuses nested calls.
- **Isolation:** for substantial changes in a git repo, create a worktree yourself
  (`git worktree add ../<repo>-codex-<slug> -b codex/<slug>`), point `--cd` at it, and bring changes back
  after review. Never let Codex and Claude edit the same files at the same time.
- **Timeouts and cancel:** default 900 s. For runs that may take more than ~8 minutes, use Bash
  `run_in_background: true` and wait for the completion notice. To stop one: TaskStop on the Bash task,
  then `codex-bridge cancel --last` to make sure the Codex process tree is gone.
- **Prompt size:** keep prompts under 30k chars; put long context in a file in the workspace and
  reference its path.
- **Quota:** each call uses the ChatGPT plan's Codex allowance. Make one well-briefed call rather than
  many small ones. If a run fails with a usage-limit error, report it and stop; don't retry in a loop.
- **Verification is yours:** Codex output is a proposal. Read the diff or files, run the checks, and
  confirm in the running app before calling anything done.

## OpenCode backend (`--agent opencode`)

- `run`, `review`, `doctor` and `list` take `--agent codex|opencode` (default `codex`). OpenCode is a
  second worker for when Codex is out of quota or a different model fits the task better.
- Billing: **OpenCode Go subscription only.** `--model` must start with `opencode-go/` (default
  `opencode-go/kimi-k3`); anything else is refused. Every `*_API_KEY` variable is stripped from the child,
  and the run is refused unless the stored "OpenCode Go" credential exists (`opencode auth login` to add one).
  `codex-bridge doctor --agent opencode` shows the allowed models and auth state.
- `--effort` becomes the model variant (`opencode-go/glm-5.3-flash#high`).
- Codex-only flags are rejected: `--worktree`, `--assets-dir`, `--ephemeral`, `--allow-api-key`; no image
  generation. Make the worktree yourself and point `--cd` at it.
- Sandbox is enforced with OpenCode permission rules (`--standalone` + `OPENCODE_CONFIG_CONTENT`): no
  folders outside `--cd`/`--add-dir`, no subagents, no git push/commit/merge/rebase/reset/clean/stash/
  checkout/switch, no recursive deletes, no `gh`, `npm publish`, `codex`, `claude` or `opencode`. Read-only
  (the default, and always for `review`) also denies edits and every shell command except git
  status/diff/log/show/blame, `rg`, `ls` and `cat`.
- The summary JSON adds `agent`; `threadId` is the OpenCode session id and `usage` has
  `input, output, reasoning, cacheRead, cacheWrite, steps, cost`.
