import * as THREE from 'three/webgpu';
import * as TSLtyped from 'three/tsl';
import { FOG, sunDirection } from '../world/fog';

export type N = any;
const TT: any = TSLtyped;

const safeSmoothstep = (a: any, b: any, x: any) => {
  const t = TT.clamp(TT.float(x).sub(a).div(TT.float(b).sub(a)), 0, 1);
  return t.mul(t).mul(TT.float(3).sub(t.mul(2)));
};

export const T: any = { ...TT, smoothstep: safeSmoothstep, pointUV: TT.uv() };
const {
  abs, cameraPosition, clamp, cos, dot, exp, float, floor, Fn, fract, length, max, mix,
  positionWorld, pow, sin, smoothstep, uniform, vec2, vec3, vec4, fog,
} = T;

export const hash2 = (p: N): N => fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453));
export const hash2b = (p: N): N => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
export const hash3 = (p: N): N => fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))).mul(43758.5453));

export const vnoise = Fn(([p]: N[]) => {
  const i = floor(p), f = fract(p);
  const u = f.mul(f).mul(float(3).sub(f.mul(2)));
  const a = hash2b(i), b = hash2b(i.add(vec2(1, 0))), c = hash2b(i.add(vec2(0, 1))), d = hash2b(i.add(vec2(1, 1)));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
});

const SUN = sunDirection();
export const gpuUniforms = {
  player: uniform(new THREE.Vector3()),
  time: uniform(0),
  px: uniform(600),
  dpr: uniform(1),
};

export const fogUniforms = {
  color: uniform(new THREE.Color().copy(FOG.color)),
  sun: uniform(new THREE.Color().copy(FOG.sun)),
  sunDir: uniform(new THREE.Vector3(SUN.x, SUN.y, SUN.z)),
  density: uniform(FOG.density),
  falloff: uniform(FOG.falloff),
};

export const gradeUniforms = {
  shadow: uniform(new THREE.Color(0.01, 0.01, 0.015)),
  high: uniform(new THREE.Color(1.0, 0.98, 0.95)),
  sat: uniform(1.0),
  contrast: uniform(1.0),
};

/** Atmospheric height fog with physical sun in-scattering */
export const andeanFog = Fn(([p]: N[]) => {
  const rd0 = p.sub(cameraPosition);
  const d = length(rd0).toVar();
  const rd = rd0.div(max(d, 1e-4));
  const a = float(fogUniforms.falloff);
  const k = a.mul(rd.y).mul(d);
  const integ = abs(k).greaterThan(1e-3).select(
    float(1).sub(exp(k.negate())).div(k),
    float(1).sub(k.mul(0.5))
  );

  // Thins with high Andean altitude so mountain massifs remain crisp, while river canyons hold mist
  const highClear = mix(float(1), float(0.4), smoothstep(30, 240, p.y));
  const canyonMist = smoothstep(3.2, -1.8, p.y).mul(float(1.85)).add(float(1.0));
  const dens = fogUniforms.density.mul(integ).mul(highClear).mul(canyonMist);
  const fogAmt = float(1).sub(exp(d.mul(dens).negate()));

  // Mie forward in-scattering toward sun (Anvil / Foundation Engine atmospheric depth)
  const sunScatter = max(dot(rd, fogUniforms.sunDir), 0);
  const sunGlow = pow(sunScatter, 6).mul(0.38).add(pow(sunScatter, 24).mul(0.28));
  const col = mix(fogUniforms.color, fogUniforms.sun, clamp(sunGlow, 0, 0.75));
  return vec4(col, clamp(fogAmt, 0, 0.92));
});

export function juzuFogNode(): N {
  const f = andeanFog(positionWorld);
  return fog(f.xyz, f.w);
}

export const withFog = (color: N, worldPos: N = positionWorld): N => {
  const f = andeanFog(worldPos);
  return mix(color, f.xyz, f.w);
};
