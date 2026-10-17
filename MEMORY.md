# Memory

## Durable facts

- **Asset Pipeline & Scans (`~/game-assets/` -> `/juzu/`):**
  - Toolchain: Blender 5.2.2 LTS (`/opt/homebrew/bin/blender`), Pillow WebP compressor, and `~/game-assets/scripts/decimate_lod.py`.
  - All 12 scanned models are web-ready (<=75k tris) in `/juzu/models/scans/<id>.glb`:
    - Rocks: `boulder_01`, `namaqualand_cliff_01`, `namaqualand_cliff_02`, `coast_land_rocks_02`, `coast_land_rocks_04` (NEW).
    - Vegetation: `tree_small_02` (NEW, subalpine tree canopy, 75k tris), `shrub_01`, `calathea_orbifolia_01`, `anthurium_botany_01`, `celandine_01`, `root_cluster_01`.
    - Stone: `modular_fort_01` (cut-stone ashlar bastion).
  - PBR Textures (2K WebP) in `/juzu/textures/scans/<id>_<channel>_2k.webp`:
    - Ground: `aerial_grass_rock`, `aerial_ground_rock`, `forest_leaves_02`, `mud_forest`, `rocky_trail` (NEW), `dry_riverbed_rock` (NEW).
    - Rock: `cliff_side`, `mossy_rock`.
    - Stone: `castle_wall_slates`, `cobblestone_01`, `cobblestone_02` (NEW), `large_sandstone_blocks` (NEW, Inca megalithic blocks).
  - Physical HDRIs in `/juzu/textures/hdr/<id>_2k.hdr`:
    - `forest_slope_2k.hdr`, `alps_field_2k.hdr` (NEW), `autumn_hill_view_2k.hdr` (NEW), `kloppenheim_02_2k.hdr` (NEW).
- **Project path:** `/Users/samuelpires/Documents/juzu`
- **Model:** Gemini 3.8 Flash (High thinking)
- **Phase-authorized merge rule:** Approval of a phase plan authorizes merging that phase's work once all verification gates pass (build, typecheck, diff reviewed, judge PASS, CI green). Work occurs on `juzu/<phase-slug>` branches with checkpoint commits pushed to origin. Merges proceed via PR (`gh pr create`), never direct push to main.
- **Protocols:** Complete WebGPU action-adventure & agentic engineering protocol stored in `docs/protocols/webgpu-action-adventure.md` (TSL node materials, MRT post-processing, Rapier kinematic controller, visual judge loop).
- **Sacred boundaries:**
  - Inward Journey (Animation repo, AI Studio project, files) is sacred: never read or write.
  - Ambient TV (`inward-journey-ambient`) is isolated: never read or write.
  - No local models in the pipeline (tinkering only).
  - Soul portrait is a tuning fork, never source material; personal doc hygiene: scan, answer, delete within 30 minutes.

## Session log
- **2026-10-14:** Created `MEMORY.md` to close audit gap; installed checkpoint commits & phase-authorized merging in `AGENTS.md`. Authored WebGPU Lara Croft action-adventure engineering & Antigravity/Gemini visual loop protocols in `docs/protocols/webgpu-action-adventure.md`.
- **2026-10-17:** Mobile-first overhaul & 2K asset pipeline integration. Fixed boot unfreeze; added stochastic dual-frequency UV perturbation and 2K `rocky_trail` ground texture; applied 2K `large_sandstone_blocks` with per-block seed-based UV/hue randomization; added `coast_land_rocks_04` and `tree_small_02` scanned models; created expedition sidearm weapon system with aiming stance, reticle, audio, muzzle flash, recoil, and hitscan sparks; built circular radar minimap and full-screen Expedition Menu (World Map with GPS/fast-travel, Backpack Inventory with item inspection); added ergonomic mobile touch controls (virtual analog stick, auto-sprint, action cluster) and adaptive portrait/landscape optics. Verified WebGL2 fallback path, build, typecheck, and visual screenshots PASS.
