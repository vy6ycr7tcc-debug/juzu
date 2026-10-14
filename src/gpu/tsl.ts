/**
 * Module: src/gpu/tsl.ts
 * Responsibility: Dual-path renderer bootstrap (`WebGPURenderer` primary with
 * load-bearing `WebGLRenderer` WebGL2 fallback) and shared dirty-flagged shader
 * uniforms per Bible §5.1 and §5.2.
 * Depends on: three.
 * Exports: ActiveBackend, SharedGpuUniforms, GpuContext, createRendererWithFallback.
 */

import * as THREE from 'three';

export type ActiveBackend = 'webgpu' | 'webgl2';

export interface SharedGpuUniforms {
  uTime: { value: number };
  uWindDir: { value: THREE.Vector2 };
  uWindStrength: { value: number };
  uWetness: { value: number };
  uSunDir: { value: THREE.Vector3 };
  uSunColor: { value: THREE.Color };
  uFogColor: { value: THREE.Color };
  uFogDensity: { value: number };
  uFogHeightFalloff: { value: number };
}

export interface GpuContext {
  renderer: THREE.WebGLRenderer;
  backend: ActiveBackend;
  uniforms: SharedGpuUniforms;
  dispose: () => void;
}

export const sharedUniforms: SharedGpuUniforms = {
  uTime: { value: 0 },
  uWindDir: { value: new THREE.Vector2(0.85, 0.52) },
  uWindStrength: { value: 0.45 },
  uWetness: { value: 0.25 },
  uSunDir: { value: new THREE.Vector3(0.58, 0.64, 0.5) },
  uSunColor: { value: new THREE.Color(0xfff1d6) },
  uFogColor: { value: new THREE.Color(0x9fb8c4) },
  uFogDensity: { value: 0.0020 },
  uFogHeightFalloff: { value: 0.085 },
};

/**
 * Initializes WebGPURenderer on capable desktop browsers and automatically falls
 * back to WebGLRenderer (WebGL2) on iOS Safari, mobile, or environments without
 * a valid WebGPU adapter/device.
 */
export async function createRendererWithFallback(
  container: HTMLElement,
  dpr: number = 1.5
): Promise<GpuContext> {
  const forceWebGL =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('backend') === 'webgl2';

  if (!forceWebGL && typeof navigator !== 'undefined' && 'gpu' in navigator) {
    try {
      const gpu = (navigator as unknown as { gpu?: { requestAdapter: () => Promise<{ requestDevice: () => Promise<unknown> } | null> } }).gpu;
      const adapter = gpu ? await gpu.requestAdapter() : null;
      const device = adapter ? await adapter.requestDevice() : null;
      if (device) {
        const webgpuMod = await import('three/webgpu').catch(() => null);
        if (webgpuMod && 'WebGPURenderer' in webgpuMod) {
          const WebGPURendererCtor = (webgpuMod as unknown as {
            WebGPURenderer: new (params: { antialias: boolean }) => THREE.WebGLRenderer & { init?: () => Promise<void> };
          }).WebGPURenderer;
          const gpuRenderer = new WebGPURendererCtor({ antialias: true });
          if (typeof gpuRenderer.init === 'function') {
            await gpuRenderer.init();
          }
          gpuRenderer.setPixelRatio(dpr);
          gpuRenderer.setSize(window.innerWidth, window.innerHeight);
          gpuRenderer.toneMapping = THREE.ACESFilmicToneMapping;
          gpuRenderer.toneMappingExposure = 1.12;
          gpuRenderer.shadowMap.enabled = true;
          gpuRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
          container.appendChild(gpuRenderer.domElement);
          return {
            renderer: gpuRenderer,
            backend: 'webgpu',
            uniforms: sharedUniforms,
            dispose: () => {
              gpuRenderer.dispose();
            },
          };
        }
      }
    } catch {
      // Fall through cleanly to load-bearing WebGL2 path
    }
  }

  const glRenderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  glRenderer.setPixelRatio(dpr);
  glRenderer.setSize(window.innerWidth, window.innerHeight);
  glRenderer.outputColorSpace = THREE.SRGBColorSpace;
  glRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  glRenderer.toneMappingExposure = 1.12;
  glRenderer.shadowMap.enabled = true;
  glRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(glRenderer.domElement);

  return {
    renderer: glRenderer,
    backend: 'webgl2',
    uniforms: sharedUniforms,
    dispose: () => {
      glRenderer.dispose();
    },
  };
}
