# Creative engineering library

Shared guidance for the creative skills (`revamp-ui`, `build-ui`, `add-interactions`,
`build-animation` (build motion), `build-3d`, `create-visuals`, `replicate-design`,
`audit-design`). It is style-agnostic: nothing here prescribes a color, aesthetic, brand or
component. The project's own design system and the owner's UI taste section in
`~/agent-skills/working-agreements/AGENTS.md` set the bar.

**Load lazily.** Read only the file the current step needs. Never read the whole technique
folder; pick techniques from the table below and open those files only.

**Voice matches the visual direction.** When choosing a direction, choose its vocabulary and
sentence rhythm too, then apply them to every headline, label, action, tooltip, empty state
and footer. An instrument desk speaks precisely; an editorial page has room for full
sentences. For example: “Unlock your workflow” → “Review 3 held requests” on a dispatch desk;
“Explore more” → “Return to the opening” in an essay; “Get started” → “Find a room for the
night” on an evening retreat page. Keep fictional examples explicitly fictional. Write from
the page's purpose, rather than adding a themed headline above generic component copy.

| File | Read it when |
|---|---|
| `adaptation.md` | Choosing a design direction (before any visual work) |
| `selector.md` | Choosing an animation or rendering technology, or before installing one |
| `visual-loop.md` | Any substantial visual change: the mandatory browser loop and quality gates |
| `reference-workflow.md` | The user gives a reference site, image or video |
| `codex-orchestration.md` | Splitting creative work between Claude (direction) and Codex (implementation) |
| `learning.md` | Recording findings for skill evolution, or running the creative held-out evals |
| `arsenal.md` | Before building any component, interaction or effect: search Arsenal, reuse, or build and register it |
| `design-variants.md` | Adding a selectable design (design N) to a product that already has one |
| `recipes/README.md` | Before writing an effect by hand: six tested, tiered recipes (spring-states, cursor-light, magnetic-target, scroll-reveal, route-transition, flow-hero), the quality runtime they share, and framework adapters. Seen together in `demos/experience/` |

## Techniques

Each file in `techniques/` has the same eight sections: Use when, Options, Dependencies,
Accessibility, Performance, Compatibility, Reduced motion, Verify. Costs: **low** (CSS or a few
listeners), **medium** (per-frame JS or a library), **high** (WebGL, video, continuous render).

| Technique | File | Cost | Typical skill |
|---|---|---|---|
| Magnetic hover | `techniques/magnetic-hover.md` | low | add-interactions |
| Cursor-following light | `techniques/cursor-light.md` | low | add-interactions |
| Interactive tilt | `techniques/interactive-tilt.md` | low | add-interactions |
| Depth-aware parallax | `techniques/depth-parallax.md` | medium | build-animation, build-3d |
| Organic masks | `techniques/organic-masks.md` | low–medium | create-visuals, build-animation |
| Shared-element transitions | `techniques/shared-element-transitions.md` | low–medium | build-animation |
| Spring-based physical feedback | `techniques/spring-feedback.md` | low–medium | add-interactions |
| Drag interactions | `techniques/drag-interactions.md` | medium | add-interactions |
| Scroll-driven choreography | `techniques/scroll-choreography.md` | low–medium | build-animation |
| Kinetic typography | `techniques/kinetic-typography.md` | medium | build-animation |
| Image and video reveals | `techniques/media-reveals.md` | low–medium | build-animation |
| Interactive diagrams | `techniques/interactive-diagrams.md` | medium | build-ui, create-visuals |
| Shader distortions | `techniques/shader-distortion.md` | high | build-3d |
| Fluid and particle effects | `techniques/fluid-particles.md` | high | build-3d, create-visuals |
| Animated illustrations | `techniques/animated-illustrations.md` | low–medium | create-visuals |
| Environmental lighting | `techniques/environmental-lighting.md` | medium–high | build-3d |
| Responsive scene transitions | `techniques/scene-transitions.md` | medium | build-animation, build-3d |

Techniques marked with a **Ready-made recipe** line have a working implementation in
`recipes/`; use it before writing the effect from the description.

Rules that hold for every technique:

- A technique needs a reason (it explains, guides, confirms or brands). If removing it loses
  nothing, remove it.
- Interaction never moves layout: transform, opacity and filters only, unless the change is the
  content itself.
- Essential information and actions never depend on hover, a pointer or motion.
- Reduced motion **reduces, it does not remove**: keep the state change, drop the travel.
- Continuous work pauses offscreen and when the tab is hidden, and caps devicePixelRatio at 2.
- Verify in the running app with `audit-design` (`skills/audit-design/scripts/visual-audit.mjs`).
