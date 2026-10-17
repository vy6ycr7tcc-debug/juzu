# JUZU — The Search for Paititi

> **A realistic third-person open-world action-adventure game set in the Inca Andes.**  
> Built with Three.js r186, dual-path **WebGPU primary** (TSL RenderPipeline, Ground-Truth Ambient Occlusion, physical bloom) and load-bearing **WebGL2 fallback** (iOS Safari & mobile compatibility).

🎮 **Play Live in Browser:** [https://vy6ycr7tcc-debug.github.io/juzu/](https://vy6ycr7tcc-debug.github.io/juzu/)

---

## Overview

In **Juzu**, players take on the role of **Naira Quispe**, a Quechua-descended field archaeologist uncovering ancient astronomical and hydraulic secrets along the lost Cusco–Paititi expedition trail. The game emphasizes atmospheric Andean photorealism (*Tomb Raider* and *Assassin's Creed* visual bar), tactile historical mechanics, and ancient engineering wonder without ancient-aliens tropes.

### Key Features

- **Dual-Path Graphics Engine:** WebGPU primary with TSL (Three Shading Language) `RenderPipeline`, `GTAONode` ground-truth ambient occlusion, restrained ACES bloom, and trochoidal river surface wave dynamics. Automatic, zero-error fallback to WebGL2 on older mobile devices and Safari.
- **Protagonist Rigging & Tailored Field Kit:** Fully rigged 3D GLB character with natural idle/walk/run/aim locomotion cycles, ground-adaptive foot placement, physical hair braid physics, Quechua woven sash, and field quiver.
- **4 Playable Andean Biomes & Chapters:**
  1. *Chapter I: Cloud Forest Valleys* · Vilcabamba Ridge (hanging wooden suspension bridges, roaring river gorge, craggy climbing faces, Sol Negro outposts).
  2. *Chapter IV: High Sierra* · Intihuatana Outpost (4,200m altitude puna grasses, snow-capped peaks, apacheta stone cairns, bronze solar reflection mirror puzzle).
  3. *Chapter VII: Antisuyu Rainforest* · Sunken Cenote (rainforest canopy, cascading waterfalls, mechanical hydraulic sluice puzzle).
  4. *Chapter X: Paititi* · Plaza of the Sun (monumental Coricancha terraces, golden sun disc, Grand Quipu Archive).
- **Tactile Archaeological Puzzles:** Interactive 3D Quipu Deciphering modal allowing players to orbit and inspect alpaca/vicuña fibers and decode Inca base-10 numerical knot values.
- **Stealth & Archery Combat:** Recurve bow mechanics with trajectory drop, dynamic stealth takedowns from behind cover, Sol Negro patrol AI with line-of-sight awareness.
- **AAA Mobile Touch Controls:** Responsive dual-zone analog thumbstick with auto-sprint threshold, ergonomic action button cluster, swipe-to-orbit camera surface, and top navigation header.
- **Procedural Andean Audio Engine:** Adaptive musical score blending quena flute, charango strings, cajón percussion, and panpipes with acoustic surface-specific footstep audio (`stone`, `dirt`, `wood`, `water`).

---

## Controls

### Desktop Keyboard & Mouse
| Input | Action |
|---|---|
| **W, A, S, D** | Move / Strafe / Swim / Climb |
| **Mouse Drag** | Orbit Camera Look |
| **Shift (Hold)** | Sprint |
| **Space** | Jump / Mantle / Climb Leap |
| **C** | Crouch / Stealth Sneak |
| **Q** | Dodge Roll |
| **Right-Click (Hold)** | Draw Bow & Aim |
| **Left-Click** | Release Arrow / Confirm |
| **E** | Contextual Interact (Sluice Wheel, Stele, Quipu, Rest) |
| **F** | Stealth Takedown (when undetected behind enemy) |
| **H** | Apply Medicinal Poultice (Heal) |
| **R** | Craft Selected Arrow Type / Cycle Arrow |
| **J** | Open Field Journal & Expedition Map |
| **P** | Andean Photo Studio (Free Cam, Filters, Presets) |
| **Esc** | Pause Menu / Chapter Select / Settings |

### Mobile Touch Controls
- **Virtual Thumbstick (Bottom-Left):** 360-degree analog locomotion with auto-sprint when pushed past outer threshold.
- **Touch Look (Right Half):** Swipe to orbit camera look angle.
- **Context Cluster (Bottom-Right):** Adaptive `[INTERACT]`, `[JUMP]`, `[DODGE]`, `[CROUCH]`, and `[AIM/FIRE]`.
- **Top Bar:** Quick access toggles for `[MAP/JOURNAL]`, `[PHOTO]`, and `[MENU]`.

---

## Architecture & Technology

```
src/
├── character/        # Naira Quispe controller, Mixamo retargeting, camera rig, Sol Negro AI
├── core/             # Adaptive quality tiers, Web Audio soundscape, Rapier physics, save state
├── gameplay/         # Traversal climbing, bow archery, stonework puzzles, crafting, quests
├── gpu/              # Dual-path WebGPU/WebGL2 bootstrap, TSL RenderPipeline, GTAO, ACES post-processing
├── ui/               # Minimalist HUD, 3D Quipu modal, Field Journal, Touch controls, Title menus
└── world/            # PBR material library, procedural terrain, river wave dynamics, sky & god-rays
```

---

## Development

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Run TypeScript typecheck
npm run typecheck

# Build optimized production bundle
npm run build
```

---

## License

ISC License.
