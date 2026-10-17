# WebGPU Action-Adventure Engineering & Agentic Workflow Protocol
**Target Aesthetic:** Tomb Raider / Lara Croft & Assassin's Creed Realism  
**Target Platform:** Three.js (r183+), WebGPU Primary with WebGL2 Fallback  
**Harness Environment:** Google Antigravity & Gemini 3.8 Flash  

---

## 1. Architectural Philosophy: The Realism Bar

To achieve the visual fidelity and physical presence of modern action-adventure titles (*Shadow of the Tomb Raider*, *Assassin's Creed Valhalla*) in a browser environment, graphics cannot rely on flat lighting, standard Phong materials, or ungrounded character movement.

### Core Visual Hallmarks
1. **Physical Materiality:** Surfaces (rock, mud, weathered Inca stonework, wet skin, linen) must react dynamically to environment conditions (weather, water immersion, directional sun angle).
2. **Atmospheric Depth:** Directional sun with high-resolution contact shadows (PCFSoft/CSM), volumetric light shafts (god rays) penetrating jungle canopies and cavern openings, and non-linear height-based fog.
3. **Weight & Grounding:** A protagonist with physical mass, grounded feet (never floating or sinking), momentum-conserving turns, and fluid context-sensitive traversal (ledge mantling, wall scrambling, surface/underwater swimming).
4. **Cinematic Tone Mapping:** ACES Filmic tone mapping with gentle highlight rolloff—never hard-clipping highlights to pure `#ffffff`.

---

## 2. Three.js WebGPU & TSL (Three Shading Language) Architecture

Three.js has shifted from monolithic GLSL shaders and `EffectComposer` passes to **node-based shaders (TSL)** and unified **`RenderPipeline`** in WebGPU.

### 2.1 The Dual-Path Bootstrap (Load-Bearing Fallback)
WebGPU provides compute shaders, multiple render targets (MRT), and storage textures, but Safari on older iOS and certain mobile browsers require WebGL2. **Never break the WebGL2 fallback path.**

```typescript
// src/gpu/renderer.ts
import * as THREE from 'three';

export interface GpuContext {
  renderer: THREE.WebGLRenderer;
  backend: 'webgpu' | 'webgl2';
  isWebGPU: boolean;
}

export async function initDualPathRenderer(container: HTMLElement, dpr = Math.min(window.devicePixelRatio, 1.5)): Promise<GpuContext> {
  const forceWebGL2 = new URLSearchParams(window.location.search).get('backend') === 'webgl2';

  if (!forceWebGL2 && typeof navigator !== 'undefined' && 'gpu' in navigator) {
    try {
      const gpu = (navigator as unknown as { gpu: { requestAdapter: () => Promise<GPUAdapter | null> } }).gpu;
      const adapter = await gpu.requestAdapter();
      if (adapter) {
        const webgpuMod = await import('three/webgpu');
        if ('WebGPURenderer' in webgpuMod) {
          const renderer = new webgpuMod.WebGPURenderer({ antialias: true, powerPreference: 'high-performance' });
          await renderer.init(); // MANDATORY: WebGPURenderer requires async init
          renderer.setPixelRatio(dpr);
          renderer.setSize(window.innerWidth, window.innerHeight);
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.1;
          renderer.shadowMap.enabled = true;
          renderer.shadowMap.type = THREE.PCFSoftShadowMap;
          container.appendChild(renderer.domElement);
          return { renderer: renderer as unknown as THREE.WebGLRenderer, backend: 'webgpu', isWebGPU: true };
        }
      }
    } catch (e) {
      console.warn('WebGPU init failed, falling back to WebGL2', e);
    }
  }

  // Robust WebGL2 Fallback
  const glRenderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  glRenderer.setPixelRatio(dpr);
  glRenderer.setSize(window.innerWidth, window.innerHeight);
  glRenderer.outputColorSpace = THREE.SRGBColorSpace;
  glRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  glRenderer.toneMappingExposure = 1.1;
  glRenderer.shadowMap.enabled = true;
  glRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(glRenderer.domElement);
  return { renderer: glRenderer, backend: 'webgl2', isWebGPU: false };
}
```

### 2.2 Post-Processing with Multiple Render Targets (MRT) & TSL
Traditional `EffectComposer` performs redundant full-screen geometry passes to extract normals and depth. In WebGPU TSL, a single scene pass outputs color, depth, and view normals simultaneously via MRT.

```typescript
// src/gpu/postprocessing.ts
import * as THREE from 'three/webgpu';
import { pass, mrt, depth, normalView, mix, mul, pow, smoothstep, positionWorld } from 'three/tsl';

export function setupWebGpuPostProcessing(renderer: any, scene: THREE.Scene, camera: THREE.Camera) {
  const post = new THREE.RenderPipeline(renderer);

  // 1. Single Scene Pass with MRT (Color + Depth + Normal)
  const scenePass = pass(scene, camera);
  const sceneColor = scenePass.getTexture('output');
  const sceneDepth = scenePass.getTexture('depth');
  const sceneNormal = scenePass.getTexture('normal');

  // 2. TSL GTAO (Ground Truth Ambient Occlusion) Approximation
  // Evaluates micro-shadowing in crevices using normal/depth differentials
  // Screen-space AO node multiplies against base color
  const aoNode = calculateScreenSpaceAoNode(sceneDepth, sceneNormal);
  const colorWithAo = mul(sceneColor, aoNode);

  // 3. Volumetric Fog & Atmospheric Light Shafts
  // Raymarching linear depth with sun scattering phase function
  const volumetricNode = calculateVolumetricAtmosphereNode(colorWithAo, sceneDepth);

  post.outputNode = volumetricNode;
  return post;
}
```

### 2.3 PBR Triplanar Terrain & Dynamic Wetness in TSL
Cliff faces in Andean ravines stretch traditional UV coordinates. Triplanar mapping in world space solves stretching, while a dynamic wetness layer simulates rain and river emergence.

```typescript
// src/world/terrainShader.ts
import * as THREE from 'three/webgpu';
import {
  texture, positionWorld, normalWorld, mix, mul, pow, clamp, smoothstep, uniform
} from 'three/tsl';

export function createIncaTerrainMaterial(textures: {
  diffuseRock: THREE.Texture;
  diffuseGrass: THREE.Texture;
  roughness: THREE.Texture;
  normal: THREE.Texture;
}) {
  const mat = new THREE.MeshStandardNodeMaterial();

  // World-space Triplanar Blending Weights
  const worldNorm = normalWorld;
  const blendWeights = pow(clamp(worldNorm.abs(), 0.0, 1.0), 8.0); // Sharp exponent prevents muddy blending
  const normSum = blendWeights.x.add(blendWeights.y).add(blendWeights.z);
  const weights = blendWeights.div(normSum);

  // Slope-based Blending (Cliff Rock vs Flat Meadow)
  const slope = normalWorld.y; // 1 = flat floor, 0 = vertical wall
  const rockFactor = smoothstep(0.4, 0.7, slope.oneMinus());

  // Dynamic Wetness Uniform (0.0 = bone dry, 1.0 = drenched)
  const uWetness = uniform(0.3);

  // Wetness lowers roughness and darkens albedo (water layer refractive index)
  const baseAlbedo = mix(texture(textures.diffuseGrass), texture(textures.diffuseRock), rockFactor);
  const wetAlbedo = mul(baseAlbedo, mix(1.0, 0.45, uWetness)); // 55% darker when soaked
  const baseRoughness = texture(textures.roughness);
  const wetRoughness = mix(baseRoughness, 0.04, uWetness); // Mirror-like puddles

  mat.colorNode = wetAlbedo;
  mat.roughnessNode = wetRoughness;
  mat.metalnessNode = 0.05;

  return { material: mat, uWetness };
}
```

---

## 3. Character Traversal & Physics (Rapier 3D + Three.js)

Lara Croft's signature gameplay relies on agile traversal: running across uneven ground without jitter, mantling ledges, wall scrambling, and swimming with buoyancy.

### 3.1 Kinematic Character Controller Architecture
Dynamic rigid bodies create bouncy, uncontrollable player movement. Use Rapier’s **`KinematicCharacterController`** configured for smooth step traversal and slope snapping.

```typescript
// src/character/physicsController.ts
import RAPIER from '@dimforge/rapier3d-compat';

export function setupKinematicCharacter(world: RAPIER.World, startPos: { x: number; y: number; z: number }) {
  // Capsule sized for realistic female adventurer (1.68m height, 0.35m radius)
  const radius = 0.35;
  const halfHeight = 0.49; // Total height = 2*halfHeight + 2*radius = 1.68m

  const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(startPos.x, startPos.y, startPos.z);
  const body = world.createRigidBody(bodyDesc);
  const colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius);
  const collider = world.createCollider(colliderDesc, body);

  // Character Controller Parameters
  const characterController = world.createCharacterController(0.02); // Small skin offset
  characterController.enableAutostep(0.45, 0.2, true); // Automatically step up Inca stone stairs
  characterController.enableSnapToGround(0.35); // Stay glued to descending ramps
  characterController.setMaxSlopeClimbAngle((45 * Math.PI) / 180); // 45 degree max climb angle
  characterController.setMinSlopeSlideAngle((50 * Math.PI) / 180); // Slide down sheer cliffs

  return { body, collider, characterController };
}
```

### 3.2 Finite State Machine (FSM) Traversal States
```
               +--------------+
               |     IDLE     |<---------------+
               +--------------+                |
                  |        ^                   |
           Input  |        | No Input          |
                  v        |                   |
               +--------------+                |
               |  WALK / RUN  |                |
               +--------------+                |
                  |        |                   |
             Jump |        | Fall/Off ledge    |
                  v        v                   |
               +--------------+                |
               | AIR / JUMP   |                |
               +--------------+                |
                  |        |                   |
    Wall collision|        | Water trigger     |
    + ledge clearance      v                   |
                  |    +--------------+        |
                  |    | SURFACE SWIM |        |
                  |    +--------------+        |
                  |       |       ^            |
                  |   Dive|       | Surface    |
                  |       v       |            |
                  |    +--------------+        |
                  |    | UNDERWATER   |        |
                  |    +--------------+        |
                  v                            |
               +--------------+                |
               | LEDGE MANTLE |----------------+
               +--------------+  Mantle complete
```

### 3.3 Traversal Detection Mechanics (Ledge & Wall)
1. **Ledge Mantle Sensor:** Cast a forward horizontal ray at chest height ($y + 0.9$). If a hit occurs within $0.8\text{m}$, cast a downward vertical ray from $1.4\text{m}$ forward height to locate the top edge platform. If the top edge is clear, transition to `LEDGE_MANTLE`.
2. **Ground Contact Raycast (Zero-Sinking Discipline):**
   ```typescript
   // Per-frame grounding correction
   const ray = new THREE.Raycaster(characterPosition, new THREE.Vector3(0, -1, 0), 0, 1.2);
   const hits = ray.intersectObjects(terrainColliders, false);
   if (hits.length > 0) {
     const groundY = hits[0].point.y;
     mesh.position.y = groundY; // Snap mesh feet exactly to terrain vertex
   }
   ```
3. **Fluid Swimming Dynamics:** When player enters water bounding volume ($Y < \text{waterPlaneY}$):
   - Reduce gravity by $85\%$ (buoyancy counter-force).
   - Apply quadratic drag: $\vec{F}_{\text{drag}} = -0.5 \cdot \rho \cdot C_d \cdot \|\vec{v}\| \cdot \vec{v}$.
   - Shift camera offset from trailing ground pivot to shoulder-level surface pivot.

---

## 4. The Antigravity + Gemini Agentic Engineering Protocol

Large multimodal models like Gemini 3.8 Flash excel at 3D graphics when given rigorous constraints, visual feedback, and clear domain separation. They fail when left to guess visual output from terminal logs alone.

### 4.1 The 5-Step Visual Feedback Loop
```
[Plan 1 Focused Change] 
        ↓
[Implement in Modular Code] 
        ↓
[Automated Playwright Capture (`shot.py`)] 
        ↓
[Multimodal Vision Judge Evaluation] 
        ↓
   PASS? ──No──→ [Fix Pixels, Re-shoot]
        │
       Yes
        ↓
[Phase-Authorized Merge Gate]
```

### 4.2 Automated Headless WebGPU Capture Protocol
To ensure Playwright captures fully initialized WebGPU frames without black flashes or half-loaded mipmaps:
1. **Launch Flags:**
   ```typescript
   const browser = await chromium.launch({
     args: [
       '--enable-features=WebGPU',
       '--enable-unsafe-webgpu',
       '--use-gl=angle',
       '--use-angle=metal' // on macOS; or 'vulkan' on Linux
     ]
   });
   ```
2. **Deterministic Readiness Gate:**
   ```typescript
   // In main.ts
   let stableFrames = 0;
   function renderLoop() {
     requestAnimationFrame(renderLoop);
     renderer.render(scene, camera);
     if (++stableFrames > 45) {
       (window as any).__shotReady = true;
     }
   }

   // In shot.py / capture script
   await page.goto(targetUrl);
   await page.waitForFunction(() => window.__shotReady === true, { timeout: 15000 });
   await page.screenshot({ path: outputPath });
   ```

### 4.3 Multimodal Vision Evaluation Checklist (The Judge)
The agent submits the captured PNG to Gemini with strict binary PASS/FAIL scoring:
- **[ ] Character Grounding:** Feet rest ON the terrain surface. Zero floating, zero submersion.
- **[ ] Character Pose:** Active retargeted animation (idle breathing, athletic walk/run stance). Bind pose or T-pose = immediate FAIL.
- **[ ] Locomotion Realism:** Facing aligns with velocity vector via turn smoothing ($k_{\text{smooth}} \approx 0.1$). No sliding or in-place rotation.
- **[ ] Lighting & Shadow:** Directional sun casts crisp contact shadows under feet and rocks. No flat ambient-only shading.
- **[ ] Exposure & Tone Mapping:** ACES Filmic curve active. Background sky, deep foliage shadows, and sunlit rocks all retain distinct histogram detail (no blown-out white pixels).
- **[ ] Geometry Integrity:** No visible seams, no missing ground polygons, no unshaded billboard planes.

### 4.4 Hallucination Guardrails for Three.js & WebGPU
When prompting or generating code with Gemini in Antigravity:
1. **Vocabulary Isolation:** Three.js only (`AnimationMixer`, `Bone`, `Raycaster`, `MeshStandardNodeMaterial`). Reject all Unity concepts (`AnimatorController`, `Prefabs`, `GameObject.Find`).
2. **Exact Import Paths:**
   - TSL nodes come from `'three/tsl'` or `'three/webgpu'`.
   - Never import from `'three/tsl'` in legacy builds without verification.
   - Core Three types (`Vector3`, `Matrix4`, `Color`) come from `'three'`.
3. **Dirty-Flag State Management:**
   - Pre-allocate vectors and matrices outside render loops. Zero allocations inside `requestAnimationFrame`.
   - Update buffer arrays only when dirty: `geometry.attributes.position.needsUpdate = true`.

---

## 5. Phase-Authorized Merge Protocol

To enable autonomous progression while keeping the `main` branch protected:

1. **Branch Naming:** All work occurs on `juzu/<phase-slug>` created from `main`.
2. **Checkpoint Commits:**
   - Format: `checkpoint: <one-line verified state>`
   - Trigger 1: After every green verification gate (build + typecheck + visual judge PASS).
   - Trigger 2: Every 30 minutes of continuous autonomous work.
   - Trigger 3: Immediately before awaiting any human input.
   - Always push checkpoints to origin to prevent work loss.
3. **Phase-Authorized PR Merge:**
   - Human approval of a phase plan authorizes the eventual merge of in-scope work once all gates are green.
   - Execution: Agent pushes phase branch, opens PR via `gh pr create --title "..." --body "..."`, monitors CI status, and executes `gh pr merge --squash --delete-branch`.
   - Report: Provide the user with the PR link, modified files, verification screenshot paths, and next roadmap increment.
