# Juzu Rendering Techniques — WebGPU & WebGL2
**Bible Reference:** `docs/visual-bible.md`  
**Architecture Reference:** `docs/protocols/webgpu-action-adventure.md`  
**Performance Reference:** `docs/standing-performance-directives.md`  

---

## 1. Dual-Path Pipeline
- **Primary:** `WebGPURenderer` with TSL (Three Shading Language) node-based materials (`three/webgpu`, `three/tsl`).
- **Fallback:** `WebGLRenderer` (WebGL2) with `MeshStandardMaterial` / `MeshPhysicalMaterial`. Load-bearing on mobile browsers without stable WebGPU adapters.
- **Tone Mapping:** `THREE.ACESFilmicToneMapping` with exposure tuned between $1.05$ and $1.15$ to ensure highlight rolloff without white clipping.

## 2. Dynamic Lighting & Shadows
- **Directional Sun:** 2048x2048 shadow map with `THREE.PCFSoftShadowMap`. Shadow camera cascades bound tightly to player view frustum.
- **Contact Shadowing:** Screen-space ambient occlusion (GTAO) or contact shadow passes under character boots, rock crevices, and foliage roots.
- **Volumetric Light Shafts (God Rays):** Raymarched atmospheric scattering tuned for dawn, noon, dusk, and subterranean ruins.

## 3. Surface Materials
- **Triplanar Rock & Terrain:** World-space triplanar projection on sheer cliffs with sharp axis weights ($\text{pow}(\text{weights}, 8.0)$) to prevent stretching.
- **Dynamic Wetness:** Specular roughness reduction ($0.04$) and albedo darkening ($0.45\times$) on rain-soaked and submerged surfaces.
- **Translucency / SSS:** Foliage and skin subsurface scattering simulation when backlit by low-altitude sun.
