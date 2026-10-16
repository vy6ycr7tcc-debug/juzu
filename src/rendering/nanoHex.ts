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
import { sharedUniforms } from '../gpu/tsl';

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
  /** Optional cliff rock albedo texture blended automatically on steep terrain slopes */
  slopeRockMap?: THREE.Texture;
  /** Optional cliff rock normal map blended automatically on steep terrain slopes */
  slopeRockNormalMap?: THREE.Texture;
  /** Normal.y threshold below which cliff rock blends in (default: 0.82) */
  slopeThreshold?: number;
}

const NANO_HEX_COMMON_GLSL = /* glsl */ `
uniform float uNanoHexScale;
uniform float uNanoHexStrength;
uniform float uNanoHexGroove;
uniform float uNanoHexRoughness;
uniform float uHexTileEnabled;
uniform float uSlopeRockEnabled;
uniform float uSlopeThreshold;
uniform sampler2D uSlopeRockMap;
uniform sampler2D uSlopeRockNormalMap;
varying vec3 vNanoWorldPos;
varying vec3 vNanoWorldNormal;

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
 * Applies procedural nano-hexagonal micro-relief normal perturbation,
 * stochastic hex-tiling, and optional triplanar slope cliff-rock blending
 * to a Three.js MeshStandardMaterial.
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
  const hasSlopeRock = Boolean(options.slopeRockMap && options.slopeRockNormalMap);
  const slopeThreshold = options.slopeThreshold ?? 0.82;

  material.userData.nanoHex = {
    uNanoHexScale: { value: scale },
    uNanoHexStrength: { value: reliefStrength },
    uNanoHexGroove: { value: grooveDepth },
    uNanoHexRoughness: { value: roughnessVariation },
    uHexTileEnabled: { value: hexTiling ? 1.0 : 0.0 },
    uSlopeRockEnabled: { value: hasSlopeRock ? 1.0 : 0.0 },
    uSlopeThreshold: { value: slopeThreshold },
    uSlopeRockMap: { value: options.slopeRockMap || material.map },
    uSlopeRockNormalMap: { value: options.slopeRockNormalMap || material.normalMap },
  };

  material.customProgramCacheKey = (): string => {
    return `nanohex_${material.name || 'mat'}_tiling${hexTiling ? '1' : '0'}_slope${hasSlopeRock ? '1' : '0'}`;
  };

  material.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms): void => {
    shader.uniforms.uNanoHexScale = material.userData.nanoHex.uNanoHexScale;
    shader.uniforms.uNanoHexStrength = material.userData.nanoHex.uNanoHexStrength;
    shader.uniforms.uNanoHexGroove = material.userData.nanoHex.uNanoHexGroove;
    shader.uniforms.uNanoHexRoughness = material.userData.nanoHex.uNanoHexRoughness;
    shader.uniforms.uHexTileEnabled = material.userData.nanoHex.uHexTileEnabled;
    shader.uniforms.uSlopeRockEnabled = material.userData.nanoHex.uSlopeRockEnabled;
    shader.uniforms.uSlopeThreshold = material.userData.nanoHex.uSlopeThreshold;
    shader.uniforms.uSlopeRockMap = material.userData.nanoHex.uSlopeRockMap;
    shader.uniforms.uSlopeRockNormalMap = material.userData.nanoHex.uSlopeRockNormalMap;

    // Pass world position & normal from vertex shader for triplanar cliff rock & geological strata
    shader.vertexShader =
      'varying vec3 vNanoWorldPos;\nvarying vec3 vNanoWorldNormal;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      /* glsl */ `
      #include <worldpos_vertex>
      vNanoWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vNanoWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
      `
    );

    // Inject GLSL utilities at top of fragment shader
    shader.fragmentShader = NANO_HEX_COMMON_GLSL + '\n' + shader.fragmentShader;

    // 1. Stochastic Hex-Tiling on diffuse texture + Triplanar Slope Cliff Rock Blending
    if (hexTiling) {
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec4 sampledDiffuseColor = texture2D( map, vMapUv );',
        /* glsl */ `
        vec4 sampledDiffuseColor = (uHexTileEnabled > 0.5)
          ? sampleHexTiled( map, vMapUv )
          : texture2D( map, vMapUv );
        if (uSlopeRockEnabled > 0.5) {
          float ny = clamp(vNanoWorldNormal.y, 0.0, 1.0);
          float strataNoise = 0.06 * sin(vNanoWorldPos.y * 2.4 + vNanoWorldPos.x * 0.25 - vNanoWorldPos.z * 0.25);
          float slopeFactor = smoothstep(uSlopeThreshold + 0.12, uSlopeThreshold - 0.16, ny + strataNoise);
          if (slopeFactor > 0.01) {
            vec2 rockUv = (vNanoWorldPos.xz * 0.45 + vec2(vNanoWorldPos.x + vNanoWorldPos.z, vNanoWorldPos.y * 1.35)) * 0.26;
            vec4 rockCol = sampleHexTiled(uSlopeRockMap, rockUv);
            // Geological horizontal rock strata & crevice shading on mountain walls
            float strataBand = 0.82 + 0.18 * sin(vNanoWorldPos.y * 3.8 + sin(vNanoWorldPos.x * 0.5) * 1.2);
            rockCol.rgb *= strataBand * 0.92;
            sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, rockCol.rgb, slopeFactor * 0.88);
          }
          // Subtle topographic crevice & slope ambient occlusion
          float slopeAO = mix(0.78, 1.0, smoothstep(0.35, 0.95, ny));
          sampledDiffuseColor.rgb *= slopeAO;
        }
        `
      );
    }

    // 2. Stochastic Hex-Tiling on normal map + Slope Cliff Rock Normal Blending
    if (hexTiling) {
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
        /* glsl */ `
        vec3 mapN = (uHexTileEnabled > 0.5)
          ? sampleHexTiledNormal( normalMap, vNormalMapUv )
          : (texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0);
        if (uSlopeRockEnabled > 0.5) {
          float ny = clamp(vNanoWorldNormal.y, 0.0, 1.0);
          float slopeFactor = smoothstep(uSlopeThreshold + 0.12, uSlopeThreshold - 0.16, ny);
          if (slopeFactor > 0.01) {
            vec2 rockUv = (vNanoWorldPos.xz * 0.45 + vec2(vNanoWorldPos.x + vNanoWorldPos.z, vNanoWorldPos.y * 1.35)) * 0.26;
            vec3 rockN = sampleHexTiledNormal(uSlopeRockNormalMap, rockUv);
            rockN.xy *= 1.35;
            mapN = normalize(mix(mapN, rockN, slopeFactor * 0.9));
          }
        }
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

/**
 * Injects warm Subsurface Scattering (SSS) solar backlight transmission and
 * hemisphere canopy bounce into foliage materials (`foliageLeaf` & `foliageFern`)
 * so backlit tree crowns and ferns glow with golden-emerald transmitted sunlight
 * and shadowed undersides never clip to flat black.
 */
export function applyFoliageSubsurfaceShader(material: THREE.MeshStandardMaterial): void {
  material.customProgramCacheKey = (): string => {
    return `foliage_sss_${material.name || 'leaf'}`;
  };

  material.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms): void => {
    shader.uniforms.uSunDir = sharedUniforms.uSunDir;
    shader.uniforms.uSunColor = sharedUniforms.uSunColor;

    shader.fragmentShader =
      'uniform vec3 uSunDir;\nuniform vec3 uSunColor;\n' + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      /* glsl */ `
      // Subsurface backlight transmission through thin chlorophyll leaf blades
      vec3 viewDir = normalize(vViewPosition);
      vec3 sunDirNorm = normalize(uSunDir);
      float backLight = pow( clamp( dot( viewDir, -sunDirNorm ), 0.0, 1.0 ), 2.4 );
      float leafWrap = clamp( dot( normal, sunDirNorm ) * 0.5 + 0.5, 0.0, 1.0 );
      vec3 sssTint = diffuseColor.rgb * vec3( 0.95, 1.18, 0.45 ) * uSunColor;
      outgoingLight += sssTint * ( backLight * 0.34 + leafWrap * 0.14 );
      #include <opaque_fragment>
      `
    );
  };

  material.needsUpdate = true;
}

