---
name: codex-visual
description: Delegate visual design work to OpenAI Codex through the local codex-bridge — alternative UI concepts, layout/type/color exploration, image generation (illustrations, textures, hero art), and screenshot-vs-reference visual review. Use when the user runs /codex-visual, asks to "have Codex design/generate/mock up" something, wants generated image assets, or wants a second visual opinion on a screenshot. Claude stays the architect and integrates the result.
---

# /codex-visual

Codex is a specialist here, not the owner of the repo. You (Claude) frame the brief, run Codex once,
check what came back, and integrate it yourself. Shared rules: `~/.claude/skills/codex-visual/BRIDGE.md`
(read it once per session before the first call).

## Pick a mode from the request

| Mode | When | Sandbox | Output |
|---|---|---|---|
| `concepts` | "give me options", explore layout/type/color | `workspace-write` in a scratch or design folder | 2–3 standalone HTML concept files + rationale |
| `image` | an illustration, texture, background, icon art | `read-only` (image tool needs no file writes) | PNGs copied to the assets dir by the bridge |
| `review` | compare a screenshot with a reference or the bar | `read-only` | ranked findings with concrete CSS/markup fixes |

Frontend implementation in real code goes to `/codex-frontend` instead.

## Steps

1. **Brief.** Write the task as a self-contained brief: goal, audience, the product's design tokens or
   existing styles (paste the relevant variables or point at the file), constraints (light and dark mode,
   reduced motion, responsive widths), and what "done" looks like. Include the owner's UI bar from
   AGENTS.md when the work is for one of their products. Attach references with `--image`.
2. **Assets dir.** Use the project's existing asset folder if there is one for this surface; otherwise
   `<project>/design/codex/<YYYY-MM-DD>-<slug>/`. Concepts go there too. Never inside `src/` until you
   integrate them.
3. **Run** (Bash; use `run_in_background: true` if it may exceed ~8 minutes):

   ```bash
   # image
   codex-bridge run --kind visual-image --cd "<project>" --timeout 600 \
     --assets-dir "<assets dir>" --asset-prefix "<slug>" [--image ref.png] \
     --prompt "Use your image generation tool to create <N> image(s): <brief>. Do not write code or files."

   # concepts
   codex-bridge run --kind visual-concepts --cd "<assets dir>" --sandbox workspace-write --timeout 900 \
     [--image ref.png] --prompt-file brief.md

   # review
   codex-bridge run --kind visual-review --cd "<project>" --timeout 600 \
     --image current.png --image reference.png --prompt-file review-brief.md
   ```

   For `review`, capture the screenshot yourself first (Playwright, the project's e2e setup, or the
   browser tools) at the widths that matter, in both color schemes if relevant. Ask for findings ranked
   by visual impact covering spacing, alignment, contrast, hierarchy, typography and motion, each with
   the exact selector/property change.
4. **Check the result.** Parse the JSON summary. `status` must be `ok`. For images, every entry in
   `assets` has a real `path`, `format`, `width` and `height` — open one with Read to look at it before
   using it. If `assets` is empty, image generation did not happen: say so, do not substitute a
   placeholder.
5. **Integrate yourself.** Reference assets by their exact paths, wire concepts into real components,
   apply review fixes you agree with. Then verify in the running app with a screenshot as usual.
6. **Report** the run id, asset paths (absolute), and what you used or rejected and why.

## Don'ts

- One Codex call per brief; iterate only when the result is close but wrong, and say why.
- Do not ask Codex to edit product source in this skill.
- Do not commit generated assets unless the user asked for them to be committed.
