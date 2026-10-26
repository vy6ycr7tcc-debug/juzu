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
plan → implement (ONE focused change) → screenshot → judge → fix → phase-authorized merge gate
```

1. **Plan.** Write the plan first: exact files touched, what "done" looks
   like, what you will screenshot. Get human approval before coding.
2. **Implement.** One focused change per pass. No drive-by refactors, no
   "while I'm here" fixes, no new features smuggled in.
3. **Screenshot.** Capture real rendered frames with `shot.py`
   (`.opencode/scripts/shot.py` or `scripts/shot.py`) — never call a visual done on typecheck or
   build alone. A 200 on index.html says nothing about 404s on textures or a
   T-posing character.
4. **Judge.** Hand the screenshots to `@juzu-judge` with the checklist below.
   A FAIL means fix and re-shoot. Do not argue with the judge; fix the pixels.
5. **Phase-authorized merge gate.** Phase approval constitutes merge authorization
   for in-scope work once all verification gates pass — no second approval is needed
   for the merge itself.

## Checkpoint commits on phase branches

Work on a phase branch named `juzu/<phase-slug>`, created from main. During any task expected to exceed 30 minutes, commit the working tree to the phase branch automatically at each of these moments: (1) after every verification gate passes (build + typecheck + judge PASS), (2) every 30 minutes of continuous work, (3) immediately before any human approval wait. Push the phase branch to origin after each checkpoint so progress survives machine loss. Checkpoint commit messages follow the format `checkpoint: <one-line description of verified state>`. Never merge a phase branch into main except per the phase-approval rule below.

## Phase approval authorizes the merge

When Samuel approves a phase plan, that approval authorizes merging that phase's work once all verification gates pass — no second approval is needed for the merge itself. On approval plus green gates (build, typecheck, diff reviewed, judge PASS, CI checks green), the agent shall: push the phase branch, open a PR against main via `gh pr create`, wait for required checks, then merge the PR. Three hard conditions: (a) only in-scope work merges — anything outside the approved phase needs fresh approval; (b) if any gate fails, no merge — fix, re-verify, re-checkpoint; (c) report the merge with the PR link and a short changelog (files changed, verification, next step).

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
- **Phase approval authorizes the merge.** When Samuel approves a phase plan,
  that approval authorizes merging that phase's work once all verification gates pass;
  never merge except per the phase-approval rule.

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

## Workstation 3D & Cross-Engine Context

This workstation is provisioned with high-end 3D and cross-engine toolchains:
- **Blender 5.2.2 LTS** (`/opt/homebrew/bin/blender`):
  - Application Templates installed in `~/Library/Application Support/Blender/5.2/scripts/startup/bl_app_templates_user/`:
    - `Game_Asset_glTF`: 1:1 Metric meter units, AgX/sRGB, EEVEE PBR lighting, glTF 2.0 WebGL/WebGPU export presets. Launch with `blender --app-template Game_Asset_glTF`.
    - `Third_Person_Character_Rig`: 1.75m reference humanoid guide, 19-bone biped armature, locomotion action/NLA cycles. Launch with `blender --app-template Third_Person_Character_Rig`.
    - `Modular_Inca_Environment`: 0.25m/0.5m/1.0m modular stone masonry snapping, PBR Andean materials. Launch with `blender --app-template Modular_Inca_Environment`.
  - Automation Toolkit: `~/Documents/animated vids/blender_tools/` (`bridge/`, `sweep/`, `mesh/`, `rig/`, `assets/`).
  - On-Demand Streamer: `fetch-3d-asset` (stream CC0 models, HDRIs, PBR textures on demand without git bloat).
- **Epic Games & Unreal Engine 5.8** (`/Users/Shared/Epic Games/UE_5.8`):
  - Standard UE 5.8 templates (`TP_ThirdPerson`, `TP_FirstPerson`, etc.) and Fab plugins (`~/Library/Application Support/Epic/FabPlugins`) available for reference mechanics and asset ingestion.

## Phase 8 Mechanics Architecture
- **Assassin's Creed Parkour Speed Vaulting** (`src/player/controller.ts`, `src/player/naira.ts`):
  - Detection: `tryVault(inputX, inputZ)` fires during forward sprint when encountering waist-high (0.65–1.15m) obstacles.
  - Parabolic trajectory: smooth arc over obstacle lip with preserved sprint exit momentum (4.5–5.5 m/s).
  - Kinematics: right hand plants firmly on obstacle surface, lead outside leg kicks horizontally forward across the parapet, inside leg tucks tight (90° knee bend) under the hip.
  - Grounding: dynamic stance-contact snap ensures instant, zero-latency foot grounding upon touchdown.
- **Dynamic Interactive Understory Foliage Parting** (`src/world/foliage.ts`):
  - Interactive damped harmonic spring simulation on Cyathea ferns ($\omega = 22.0, \zeta = 0.72$).
  - Blended deflection: 65% radial outward push + 35% forward velocity wake deflection within 2.4m radius.

