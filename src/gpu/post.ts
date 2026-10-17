import * as THREE from 'three/webgpu';
import { ao } from 'three/examples/jsm/tsl/display/GTAONode.js';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import { smaa } from 'three/examples/jsm/tsl/display/SMAANode.js';
import { gradeUniforms, T, type N } from './tsl';

const {
  clamp, dot, float, Fn, fract, length, max, min, mix, pass, pow,
  renderOutput, screenCoordinate, screenSize, sin, smoothstep, step,
  uniform, uv, vec2, vec3, vec4,
} = T;

const VIBRANCE = 0.25;
const CLARITY = 0.28;
const SHARPEN = 0.45;

export interface PostOptions {
  ao: boolean;
  bloom: boolean;
  aa: 'smaa' | 'none';
}

export class Post {
  readonly pipeline: THREE.RenderPipeline;
  readonly aoOn = uniform(1);
  readonly aspect = uniform(1);
  private scene: N = null;
  private opts: PostOptions | null = null;

  constructor(
    renderer: THREE.WebGPURenderer,
    private sceneObj: THREE.Scene,
    private camera: THREE.PerspectiveCamera
  ) {
    this.pipeline = new THREE.RenderPipeline(renderer);
    this.pipeline.outputColorTransform = false;
  }

  private scenePass(): N {
    if (this.scene) return this.scene;
    this.scene = pass(this.sceneObj, this.camera);
    return this.scene;
  }

  public rebuild(opts: PostOptions): void {
    this.opts = opts;
    this.aoOn.value = opts.ao ? 1 : 0;

    const basePass = this.scenePass();
    const sc = basePass.getTextureNode('output');
    const depth = basePass.getTextureNode('depth');

    // 1. Ambient Occlusion (GTAO) - soft physical crevice shading
    let composed: N = sc;
    if (opts.ao) {
      const g = ao(depth, null as unknown as N, this.camera);
      g.resolutionScale = 0.5;
      g.radius.value = 1.0;
      g.thickness.value = 1.2;
      g.samples.value = 8;
      // AO should only softly shade crevices (0.72 - 1.0), never crush geometry
      const occ = clamp(g.getTextureNode().r, 0.72, 1.0);
      composed = vec4(composed.rgb.mul(mix(float(1), occ, this.aoOn)), composed.a);
    }

    // 2. Physical Restrained Bloom
    if (opts.bloom) {
      const bl = bloom(composed, 0.4, 0.1, 0.9);
      bl.smoothWidth.value = 0.3;
      composed = vec4(composed.rgb.add(bl.rgb.mul(0.35)), composed.a);
    }

    // 3. Andean Color Grading (ACES tone mapping + natural clarity/vibrance)
    let out: N = renderOutput(composed);
    {
      const G = gradeUniforms;
      const luma = (v: N): N => dot(v, vec3(0.2126, 0.7152, 0.0722));
      const l0 = luma(out.rgb);
      let g: N = mix(vec3(l0), out.rgb, G.sat);
      const hi = max(g.r, max(g.g, g.b)), lo = min(g.r, min(g.g, g.b));
      const chroma = hi.sub(lo).div(hi.add(1e-4));
      const vib = float(VIBRANCE).mul(float(1).sub(chroma)).mul(smoothstep(0.03, 0.22, l0));
      g = mix(vec3(luma(g)), g, vib.add(1));

      // S-curve contrast
      const P = 0.42;
      const x = clamp(g, 0, 1);
      const below = pow(x.div(P), G.contrast).mul(P);
      const above = float(1).sub(pow(float(1).sub(x).div(1 - P), G.contrast).mul(1 - P));
      g = mix(below, above, step(P, x));

      // Natural Andean shadows & sunlit highlights
      const l = luma(g);
      g = g.add(G.shadow.mul(pow(float(1).sub(l).max(0), 2)));
      g = g.mul(mix(vec3(1), G.high, smoothstep(0.35, 1, l)));
      out = vec4(clamp(g, 0, 1), 1);
    }

    // 4. Anti-Aliasing (SMAA with sharpening)
    if (opts.aa === 'smaa') {
      const tex = smaa(out).getTextureNode();
      const px = vec2(1).div(screenSize);
      const q = uv();
      const m = tex.sample(q).rgb;
      const a = tex.sample(q.add(vec2(px.x, 0))).rgb, b = tex.sample(q.sub(vec2(px.x, 0))).rgb;
      const cc = tex.sample(q.add(vec2(0, px.y))).rgb, d = tex.sample(q.sub(vec2(0, px.y))).rgb;
      const mn = min(m, min(min(a, b), min(cc, d))), mx = max(m, max(max(a, b), max(cc, d)));
      const avg = a.add(b).add(cc).add(d).mul(0.25);
      out = vec4(clamp(m.add(m.sub(avg).mul(SHARPEN)), mn, mx), 1);
    }

    // 5. Subtle Vignette & Dither (no banding)
    const r = length(uv().sub(0.5));
    out = vec4(out.rgb.mul(float(1).sub(smoothstep(0.32, 0.82, r).mul(0.12))), 1);

    const f = screenCoordinate.xy;
    const n1 = fract(sin(dot(f, vec2(12.9898, 78.233))).mul(43758.5453));
    const n2 = fract(sin(dot(f, vec2(39.3468, 11.135))).mul(24634.6345));
    out = vec4(out.rgb.add(n1.add(n2).sub(1).div(255)), 1);

    this.pipeline.outputNode = out;
    this.pipeline.needsUpdate = true;
  }

  public render(): void {
    this.pipeline.render();
  }

  public setSize(w: number, h: number): void {
    this.aspect.value = w / Math.max(h, 1);
  }
}
