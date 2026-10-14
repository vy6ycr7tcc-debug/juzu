# Standing Performance Directives (The 11 Rules)
**Context:** Three.js / WebGPU Action-Adventure Engine (Juzu)  
**Standard:** 60fps baseline on modern desktops, stable 30fps+ on mobile WebGL2 fallback.

---

1. **Dispose on Scene Leave:** Nothing remains resident forever. Call `.dispose()` on geometries, materials, textures, render targets, and WebGPU compute pipelines upon scene/region exit.
2. **Zero Allocations in Hot Loops:** Pre-allocate vectors (`THREE.Vector3`), matrices (`THREE.Matrix4`), quaternions, and raycasters outside per-frame ticker loops (`requestAnimationFrame`). Never instantiate objects inside `update()` or `render()`.
3. **Dirty-Flag GPU Buffer Uploads:** Only set `needsUpdate = true` on buffer attributes when vertex, normal, or index arrays actually mutate. Never push unchanged arrays to GPU memory.
4. **Distance-Gate Every Ticking System:** Apply Level of Detail (LOD) and frustum/distance culling to particle systems, foliage sway, physics broadphase updates, and AI state machines.
5. **Cache Expensive Analytic Queries:** Spatial queries, terrain height lookups, and pathfinding traversals must be cached and invalidated only on geometry modification.
6. **Compressed Textures (KTX2 / UASTC / Basis):** Use GPU-compressed textures for mobile memory footprint, instant GPU upload, and reduced VRAM pressure.
7. **Warm Shader Pipelines During Loading:** Warm WebGPU render pipelines and compile shaders during loading screens (`renderer.compileAsync()` / `renderer.init()`). Never permit first-frame hitching during gameplay.
8. **Loud & Explicit Asset-Load Failures:** Missing textures, broken GLB hierarchies, or failed shaders must log loud, explicit errors. Never fail silently to unlit black surfaces.
9. **Bound Every Cache with Strict Eviction Policies:** Dynamic asset caches (chunks, audio buffers, terrain tiles) must enforce maximum LRU capacities and explicit eviction policies.
10. **Measure on the Weakest Target Device:** Verify framerates and memory on baseline devices (e.g. baseline mobile/iPhone WebGL2 path) and report measured numbers, not theoretical estimates.
11. **No Visual-Compromise "Optimizations" Without Signoff:** Do not degrade visual fidelity, disable shadows, or drop post-processing without explicit approval. Optimize the mechanism, not the aesthetic bar.
