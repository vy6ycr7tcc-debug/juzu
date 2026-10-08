import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { getActiveLightRig } from '../environment.js';

/**
 * Volumetric Light Scattering (God Rays / Crepuscular Light Shafts).
 * Based on Kenny Mitchell's GPU Gems 3 real-time volumetric scattering algorithm.
 * Uses dedicated offscreen render target to eliminate WebGL2 depth texture feedback loops.
 */
export const GodraysShader = {
  name: 'GodraysShader',
  uniforms: {
    tDepth: { value: null },
    sunPositionScreen: { value: new THREE.Vector2(0.5, 0.5) },
    sunVisible: { value: 1.0 },
    lightColor: { value: new THREE.Color(0xffd595) },
    density: { value: 0.88 },
    weight: { value: 0.18 },
    decay: { value: 0.96 },
    exposure: { value: 0.65 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDepth;
    uniform vec2 sunPositionScreen;
    uniform float sunVisible;
    uniform vec3 lightColor;
    uniform float density;
    uniform float weight;
    uniform float decay;
    uniform float exposure;
    varying vec2 vUv;

    const int NUM_SAMPLES = 48;

    void main() {
      if (sunVisible < 0.01) {
        gl_FragColor = vec4(0.0);
        return;
      }

      vec2 deltaTextCoord = (vUv - sunPositionScreen);
      deltaTextCoord *= 1.0 / float(NUM_SAMPLES) * density;
      vec2 coord = vUv;
      float illuminationDecay = 1.0;
      float rays = 0.0;

      for (int i = 0; i < NUM_SAMPLES; i++) {
        coord -= deltaTextCoord;
        if (coord.x < 0.0 || coord.x > 1.0 || coord.y < 0.0 || coord.y > 1.0) {
          break;
        }
        float d = texture2D(tDepth, coord).r;
        // Depth test: sky doesn't write depth (d == 1.0). Geometry writes d <= 0.99993.
        float sampleOcclusion = step(0.99993, d);
        float sampleDistToSun = length(coord - sunPositionScreen);
        float sunDisc = exp(-sampleDistToSun * 8.0) * 1.8 + 0.15;
        rays += sampleOcclusion * sunDisc * illuminationDecay * weight;
        illuminationDecay *= decay;
      }

      vec3 rayColor = lightColor * rays * exposure * sunVisible;
      gl_FragColor = vec4(rayColor, 1.0);
    }
  `
};

const GodraysCompositeShader = {
  name: 'GodraysCompositeShader',
  uniforms: {
    tBase: { value: null },
    tRays: { value: null }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tBase;
    uniform sampler2D tRays;
    varying vec2 vUv;
    void main() {
      vec4 baseColor = texture2D(tBase, vUv);
      vec4 raysColor = texture2D(tRays, vUv);
      gl_FragColor = vec4(baseColor.rgb + raysColor.rgb, baseColor.a);
    }
  `
};

export class GodraysPass extends Pass {
  public camera: THREE.Camera;
  public depthTexture: THREE.DepthTexture;
  public sunLight: THREE.DirectionalLight | null = null;
  public raysRenderTarget: THREE.WebGLRenderTarget;
  public raysMaterial: THREE.ShaderMaterial;
  public compositeMaterial: THREE.ShaderMaterial;
  private _fsQuad: FullScreenQuad;
  private _sunProj = new THREE.Vector3();

  constructor(
    camera: THREE.Camera,
    depthTexture: THREE.DepthTexture,
    width: number,
    height: number,
    options: { density?: number; exposure?: number } = {}
  ) {
    super();
    this.camera = camera;
    this.depthTexture = depthTexture;

    // Dedicated half-resolution render target for crepuscular light shafts
    // Eliminates WebGL2 feedback loops with composer buffer depthTexture while boosting performance
    this.raysRenderTarget = new THREE.WebGLRenderTarget(
      Math.floor(width / 2),
      Math.floor(height / 2),
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        type: THREE.HalfFloatType
      }
    );

    this.raysMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(GodraysShader.uniforms),
      vertexShader: GodraysShader.vertexShader,
      fragmentShader: GodraysShader.fragmentShader
    });
    if (options.density !== undefined) this.raysMaterial.uniforms.density.value = options.density;
    if (options.exposure !== undefined) this.raysMaterial.uniforms.exposure.value = options.exposure;

    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(GodraysCompositeShader.uniforms),
      vertexShader: GodraysCompositeShader.vertexShader,
      fragmentShader: GodraysCompositeShader.fragmentShader
    });

    this._fsQuad = new FullScreenQuad(this.raysMaterial);
  }

  public setSun(sun: THREE.DirectionalLight | null) {
    this.sunLight = sun;
  }

  public setSize(width: number, height: number) {
    this.raysRenderTarget.setSize(Math.floor(width / 2), Math.floor(height / 2));
  }

  public override render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    _deltaTime?: number,
    _maskActive?: boolean
  ) {
    const sun = this.sunLight || getActiveLightRig()?.sun || null;
    let sunVisible = 0.0;
    if (sun) {
      this._sunProj.copy(sun.position).project(this.camera);
      const isFacing = this._sunProj.z < 1.0;
      if (isFacing) {
        sunVisible = 1.0;
        this.raysMaterial.uniforms.sunPositionScreen.value.set(
          this._sunProj.x * 0.5 + 0.5,
          this._sunProj.y * 0.5 + 0.5
        );
        this.raysMaterial.uniforms.lightColor.value.copy(sun.color);
      }
    }
    this.raysMaterial.uniforms.sunVisible.value = sunVisible;
    this.raysMaterial.uniforms.tDepth.value = this.depthTexture;

    // Step 1: Render volumetric rays into isolated offscreen target
    renderer.setRenderTarget(this.raysRenderTarget);
    renderer.clear();
    this._fsQuad.material = this.raysMaterial;
    this._fsQuad.render(renderer);

    // Step 2: Composite base color + volumetric rays into writeBuffer
    this.compositeMaterial.uniforms.tBase.value = readBuffer.texture;
    this.compositeMaterial.uniforms.tRays.value = this.raysRenderTarget.texture;
    this._fsQuad.material = this.compositeMaterial;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this._fsQuad.render(renderer);
  }

  public override dispose() {
    this.raysRenderTarget.dispose();
    this.raysMaterial.dispose();
    this.compositeMaterial.dispose();
    this._fsQuad.dispose();
  }
}
