/**
 * Module: src/rendering/nanoHex.ts
 * Responsibility: Nano-hexagonal stochastic texture tiling and procedural
 * micro-relief normal perturbation for Three.js PBR materials.
 * 
 * Solves two fundamental open-world rendering challenges:
 * 1. "Small textures repetition": Breaks visible square tiling patterns across large
 *    surfaces (puna grass, forest floor, stonework) using dual-cell stochastic hex-tiling.
 * 2. "Randomised relief": Adds procedural nano-hexagonal crystalline grain relief,
 *    micro-facet tilts, and boundary crevice grooves to normal and roughness maps,
 *    giving tactile archaeological realism without geometric polygon bloat.
 * 
 * Works seamlessly across both WebGL2 (load-bearing fallback) and WebGPU.
 * Depends on: three.
 * Exports: NanoHexOptions, applyNanoHexagonRelief.
 */

import * as THREE from 'three';

export interface NanoHexOptions {
  /** Frequency / density of the nano-hexagonal micro-relief cells (default: 72.0) */
  scale?: number;
  /** Strength of the tangent-space normal perturbation (0.0 to 1.0, default: 0.38) */
  reliefStrength?: number;
  /** Depth of the micro-grooves at hexagonal cell edges (default: 0.28) */
  grooveDepth?: number;
  /** Amount of micro-roughness variation across facets (default: 0.08) */
  roughnessVariation?: number;
  /** Enable dual-cell stochastic hex-tiling to break texture repetition (default: true) */
  hexTiling?: boolean;
}

const NANO_HEX_COMMON_GLSL = /* glsl */ `
uniform float uNanoHexScale;
uniform float uNanoHexStrength;
uniform float uNanoHexGroove;
uniform float uNanoHexRoughness;
uniform float uHexTileEnabled;

// 2D Hash functions (Dave_Hoskins / Jarzynski)
float nanoHexHash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 nanoHexHash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// Decomposes 2D UV into regular hexagonal lattice
// Returns vec4(localOffsetFromCenter.xy, cellCenterID.xy)
vec4 nanoHexGridCoords(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508075688772);
  const vec2 h = vec2(0.5, 0.8660254037844386);

  vec2 a = mod(p, s) - h;
  vec2 b = mod(p - h, s) - h;

  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec2 id = p - g;

  return vec4(g, id);
}

// Distance to nearest hexagonal cell edge (0.0 at edge, 0.5 at center)
float nanoHexEdgeDistance(vec2 g) {
  float d = max(abs(g.x) * 0.8660254037844386 + abs(g.y) * 0.5, abs(g.y));
  return clamp(0.5 - d, 0.0, 0.5);
}

// Computes tangent-space normal offset and micro-roughness perturbation from nano-hexagons
vec3 computeNanoHexRelief(vec2 uv, float scale, float strength, float groove, out float deltaRough) {
  vec4 hx = nanoHexGridCoords(uv * scale);
  vec2 g = hx.xy;
  vec2 id = hx.zw;

  float edgeDist = nanoHexEdgeDistance(g);

  // Pseudo-random facet tilt and slope per hexagonal cell
  vec2 randSlope = (nanoHexHash22(id) * 2.0 - 1.0);
  float randElev = (nanoHexHash12(id) * 2.0 - 1.0);

  // Micro-crevice groove along hexagonal boundaries
  float edgeGroove = smoothstep(0.0, 0.08, edgeDist);
  float edgeSlope = (1.0 - edgeGroove) * groove;

  float lenG = length(g);
  vec2 dirG = lenG > 0.0001 ? (g / lenG) : vec2(0.0);

  // Tangent-space normal perturbation: subtle facet tilt + boundary micro-groove + pillowed curvature
  vec2 normalOffset = (randSlope * 0.35 + dirG * edgeSlope + g * 0.25) * strength;

  // Modulate micro-roughness: grooves are rougher, crystalline facets have micro-specular variance
  deltaRough = (randElev * 0.04) + ((1.0 - edgeGroove) * 0.08);

  return vec3(normalOffset, 1.0);
}

// Stochastic Hexagonal Tiling for small repeating textures (breaks square grid repetition)
vec4 sampleHexTiled(sampler2D tex, vec2 uv) {
  const vec2 s = vec2(1.0, 1.7320508075688772);
  const vec2 h = vec2(0.5, 0.8660254037844386);

  vec2 a = mod(uv, s) - h;
  vec2 b = mod(uv - h, s) - h;

  float dA = dot(a, a);
  float dB = dot(b, b);

  float wA = smoothstep(0.70, 0.30, dA / max(0.0001, dA + dB));
  float wB = 1.0 - wA;

  vec2 idA = uv - a;
  vec2 idB = uv - b;

  vec2 offA = nanoHexHash22(idA);
  vec2 offB = nanoHexHash22(idB);

  float angA = nanoHexHash12(idA) * 6.2831853;
  float angB = nanoHexHash12(idB) * 6.2831853;
  mat2 rotA = mat2(cos(angA), sin(angA), -sin(angA), cos(angA));
  mat2 rotB = mat2(cos(angB), sin(angB), -sin(angB), cos(angB));

  vec2 uvA = rotA * a + offA;
  vec2 uvB = rotB * b + offB;

  vec4 colA = texture2D(tex, uvA);
  vec4 colB = texture2D(tex, uvB);

  return colA * wA + colB * wB;
}

vec3 sampleHexTiledNormal(sampler2D nMap, vec2 uv) {
  const vec2 s = vec2(1.0, 1.7320508075688772);
  const vec2 h = vec2(0.5, 0.8660254037844386);

  vec2 a = mod(uv, s) - h;
  vec2 b = mod(uv - h, s) - h;

  float dA = dot(a, a);
  float dB = dot(b, b);

  float wA = smoothstep(0.70, 0.30, dA / max(0.0001, dA + dB));
  float wB = 1.0 - wA;

  vec2 idA = uv - a;
  vec2 idB = uv - b;

  vec2 offA = nanoHexHash22(idA);
  vec2 offB = nanoHexHash22(idB);

  float angA = nanoHexHash12(idA) * 6.2831853;
  float angB = nanoHexHash12(idB) * 6.2831853;
  mat2 rotA = mat2(cos(angA), sin(angA), -sin(angA), cos(angA));
  mat2 rotB = mat2(cos(angB), sin(angB), -sin(angB), cos(angB));

  vec2 uvA = rotA * a + offA;
  vec2 uvB = rotB * b + offB;

  vec3 nA = texture2D(nMap, uvA).xyz * 2.0 - 1.0;
  vec3 nB = texture2D(nMap, uvB).xyz * 2.0 - 1.0;

  nA.xy = rotA * nA.xy;
  nB.xy = rotB * nB.xy;

  return normalize(nA * wA + nB * wB);
}
`;

/**
 * Applies procedural nano-hexagonal micro-relief normal perturbation and
 * stochastic hex-tiling to a Three.js MeshStandardMaterial.
 */
export function applyNanoHexagonRelief(
  material: THREE.MeshStandardMaterial,
  options: NanoHexOptions = {}
): void {
  const scale = options.scale ?? 72.0;
  const reliefStrength = options.reliefStrength ?? 0.38;
  const grooveDepth = options.grooveDepth ?? 0.28;
  const roughnessVariation = options.roughnessVariation ?? 0.08;
  const hexTiling = options.hexTiling ?? true;

  material.userData.nanoHex = {
    uNanoHexScale: { value: scale },
    uNanoHexStrength: { value: reliefStrength },
    uNanoHexGroove: { value: grooveDepth },
    uNanoHexRoughness: { value: roughnessVariation },
    uHexTileEnabled: { value: hexTiling ? 1.0 : 0.0 },
  };

  material.customProgramCacheKey = (): string => {
    return `nanohex_${material.name || 'mat'}_tiling${hexTiling ? '1' : '0'}`;
  };

  material.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms): void => {
    // Bind custom uniforms
    shader.uniforms.uNanoHexScale = material.userData.nanoHex.uNanoHexScale;
    shader.uniforms.uNanoHexStrength = material.userData.nanoHex.uNanoHexStrength;
    shader.uniforms.uNanoHexGroove = material.userData.nanoHex.uNanoHexGroove;
    shader.uniforms.uNanoHexRoughness = material.userData.nanoHex.uNanoHexRoughness;
    shader.uniforms.uHexTileEnabled = material.userData.nanoHex.uHexTileEnabled;

    // Inject GLSL utilities at top of fragment shader
    shader.fragmentShader = NANO_HEX_COMMON_GLSL + '\n' + shader.fragmentShader;

    // 1. Stochastic Hex-Tiling on diffuse texture (breaks square grid repetition)
    if (hexTiling) {
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec4 sampledDiffuseColor = texture2D( map, vMapUv );',
        /* glsl */ `
        vec4 sampledDiffuseColor = (uHexTileEnabled > 0.5)
          ? sampleHexTiled( map, vMapUv )
          : texture2D( map, vMapUv );
        `
      );
    }

    // 2. Stochastic Hex-Tiling on normal map
    if (hexTiling) {
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
        /* glsl */ `
        vec3 mapN = (uHexTileEnabled > 0.5)
          ? sampleHexTiledNormal( normalMap, vNormalMapUv )
          : (texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0);
        `
      );
    }

    // 3. Nano-Hexagonal micro-relief normal perturbation in tangent space
    shader.fragmentShader = shader.fragmentShader.replace(
      'normal = normalize( tbn * mapN );',
      /* glsl */ `
      float deltaRough = 0.0;
      vec3 nanoRelief = computeNanoHexRelief( vNormalMapUv, uNanoHexScale, uNanoHexStrength, uNanoHexGroove, deltaRough );
      mapN.xy += nanoRelief.xy;
      mapN = normalize( mapN );
      normal = normalize( tbn * mapN );
      `
    );

    // 4. Stochastic Hex-Tiling on roughness map and micro-roughness variation
    if (hexTiling) {
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );',
        /* glsl */ `
        vec4 texelRoughness = (uHexTileEnabled > 0.5)
          ? sampleHexTiled( roughnessMap, vRoughnessMapUv )
          : texture2D( roughnessMap, vRoughnessMapUv );
        `
      );
    }

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      /* glsl */ `
      #include <roughnessmap_fragment>
      #ifdef USE_ROUGHNESSMAP
        float nanoRoughDelta = 0.0;
        computeNanoHexRelief( vRoughnessMapUv, uNanoHexScale, uNanoHexStrength, uNanoHexGroove, nanoRoughDelta );
        roughnessFactor = clamp( roughnessFactor + nanoRoughDelta * uNanoHexRoughness, 0.04, 0.98 );
      #endif
      `
    );
  };

  material.needsUpdate = true;
}
