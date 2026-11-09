# Notice

This workflow is vendored from [heydamir/unslop](https://github.com/heydamir/unslop)
(commit `a6f121e`), by Damir Sokolovsky ([@heydamir](https://x.com/heydamir),
https://heydamir.design/unslop), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The full text is in `LICENSE`.

Changes from upstream (2026-11-09, agent-skills restructure):

- `SKILL.md` was renamed to `unslop.md`, and its frontmatter was replaced with an attribution comment. It is now a workflow of the
  `revamp-ui` skill, not a standalone skill.
- `<skill folder>/scripts/...` became `~/agent-skills/skills/revamp-ui/workflows/unslop/scripts/...`.

All other files are unchanged. To update, copy `skills/unslop/` from a newer upstream checkout
over this folder, then reapply the two changes above and bump the commit.
