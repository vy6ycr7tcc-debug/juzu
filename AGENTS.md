# AGENTS.md — Juzu

This file is read automatically by OpenCode (and Jules) at the start of every
session in this repo. It is the constitution. Follow it over any conflicting
impulse, including the urge to declare something "done."

## What this is

Juzu — a realistic third-person open-world action-adventure game set in the
Inca Andes. Browser-native: **three.js, WebGPU primary + WebGL2 fallback.**
The WebGL2 fallback is load-bearing (older iPhones/Safari stay on WebGL) —
never ship WebGPURenderer-only, never break the fallback path.

## The visual bar

Assassin's Creed + Tomb Raider realism. Wonder via ancient devices, never
ancient-aliens. The full art direction lives in the game bible
(`docs/juzu-visual-bible.md`); the rendering rules in
`docs/juzu-rendering-techniques.md`. If a change makes the game look less
real, it is wrong no matter what the code says.

## The loop (every change, no exceptions)

```
plan → implement (ONE focused change) → screenshot → judge → fix → human merge gate
```

1. **Plan.** Write the plan first: exact files touched, what "done" looks
   like, what you will screenshot. Get human approval before coding.
2. **Implement.** One focused change per pass. No drive-by refactors, no
   "while I'm here" fixes, no new features smuggled in.
3. **Screenshot.** Capture real rendered frames with `shot.py`
   (`.opencode/scripts/shot.py`) — never call a visual done on typecheck or
   build alone. A 200 on index.html says nothing about 404s on textures or a
   T-posing character.
4. **Judge.** Hand the screenshots to `@juzu-judge` with the checklist below.
   A FAIL means fix and re-shoot. Do not argue with the judge; fix the pixels.
5. **Human merge gate.** Nothing merges without the human's explicit
   authorization for that merge. Ever.

## Screenshot checklist (the judge scores these)

**Character** (the thing we got wrong before — be strict):
- Pose: T-pose / bind pose with arms rigid out = FAIL. Needs idle/walk/run
  animation retargeted onto the rig, not a static pose.
- Grounding: feet must rest ON the terrain. Sunk under the soil or floating
  above it = FAIL. Fix = per-frame raycast, set character Y so feet touch.
- Locomotion: turning in place / sliding without a walk cycle = FAIL. Facing
  must be driven by movement direction with turn smoothing.
- Look: code-sculpted placeholder proportions = FAIL. The protagonist is a
  rigged GLB, never primitives assembled in code.

**Scene:**
- Exposure: no white-out frames. Fog, bloom, and tone mapping must leave
  trunks, ground texture, and sky color clearly visible.
- Lighting: directional sun + shadows, not flat ambient-only. Highlights must
  roll off (ACES-style), never hard-clip to pure white.
- No translucent-plane hacks. No missing ground geometry (fog hides nothing).

## Hard rules

- **Stack vocabulary is three.js.** Fixes are `AnimationMixer`, retargeted GLB
  clips, `raycaster` grounding — never Unity-isms (no "Animator Controller,"
  no prefabs). If a suggested fix names Unity concepts, translate or reject it.
- **Never sculpt the protagonist in code.** Rigged CDN/drive GLB model only.
- **WebGL2 fallback stays alive.** Every WebGPU/TSL addition needs its
  standard-materials fallback path.
- **Performance directives apply** (`docs/standing-performance-directives.md`)
  — read them on every visual change.
- **One focused change per pass.** If the judge fails you, fix only what
  failed.
- **Verify, don't claim.** Build passes, screenshots judged, diff reviewed —
  builder claims are not evidence.

## Sacred boundary

**Inward Journey is sacred.** This repo, its agents, its tokens, and its
workflows never read or write the Inward Journey Animation repo, its AI
Studio project, or any inward-journey files. Juzu is the playground; the
line is absolute.

## Model routing (why you're the model you are)

- Builder passes run on MiMo v2.6 Pro (best implementer in our benchmark).
- Volume passes run on DeepSeek v4.1 Flash (best value, best visual judge).
- Art direction, architecture, and anything requiring taste go to Claude
  (human-driven, outside this loop).
- GLM is benched until its quota stabilizes; MiniMax is benched (no vision
  route). Re-test before promoting either.
