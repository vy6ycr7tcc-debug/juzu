import * as THREE from 'three/webgpu';
import { activeToD, sunDirection, TOD_PRESETS, type TimeOfDay } from './fog';
import { T, type N, hash3, vnoise, gpuUniforms } from '../gpu/tsl';

const {
  cameraProjectionMatrix, clamp, dot, float, floor, Fn, max, mix, modelViewMatrix,
  normalize, positionLocal, pow, smoothstep, uniform, varying, vec2, vec3, vec4,
} = T;

export class Sky {
  public mesh: THREE.Mesh;
  public stars: THREE.Points;
  private starMat: THREE.PointsMaterial;
  private uSunDir = uniform(new THREE.Vector3());
  private uZenithColor = uniform(new THREE.Color(0x1e4682));
  private uHorizonColor = uniform(new THREE.Color());
  private uSunColor = uniform(new THREE.Color());
  private uNightMix = uniform(0.0);

  constructor(scene: THREE.Scene) {
    const sDir = sunDirection();
    const cfg = TOD_PRESETS[activeToD];

    this.uSunDir.value.copy(sDir);
    this.uZenithColor.value.set(cfg.zenithColor);
    this.uHorizonColor.value.set(cfg.fogColor);
    this.uSunColor.value.set(cfg.sunColor);
    this.uNightMix.value = activeToD === 'night' ? 1.0 : 0.0;

    const mat = new THREE.MeshBasicNodeMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });

    const dir = varying(positionLocal);
    const clip = cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(positionLocal, 1));
    mat.vertexNode = vec4(clip.x, clip.y, clip.w, clip.w);

    const skyColor = Fn(([d]: N[]) => {
      const h = clamp(d.y, 0, 1);
      const sky = mix(this.uHorizonColor, this.uZenithColor, pow(h, 0.45)).toVar();

      // Physical sun/moon disk & atmospheric glare
      const sunDot = max(dot(d, this.uSunDir), 0);
      const sunGlow = pow(sunDot, 120).mul(1.5);
      const sunDisk = smoothstep(0.9992, 0.9998, sunDot).mul(4);
      sky.addAssign(this.uSunColor.mul(sunGlow.add(sunDisk)));

      // High-altitude Andean cumulus & cirrus cloud layer projected on sky dome
      const cloudProj = d.xz.div(max(h.add(0.14), 0.14)).mul(1.85).add(vec2(gpuUniforms.time.mul(0.008), gpuUniforms.time.mul(0.004)));
      const c1 = vnoise(cloudProj);
      const c2 = vnoise(cloudProj.mul(2.45).add(vec2(7.3, -4.1)));
      const cloudFbm = c1.mul(0.65).add(c2.mul(0.35));
      const cloudMask = smoothstep(0.47, 0.76, cloudFbm).mul(smoothstep(0.03, 0.22, h)).mul(float(1.0).sub(float(this.uNightMix).mul(0.75)));
      const cloudLit = mix(vec3(0.76, 0.80, 0.86), vec3(1.02, 0.98, 0.92), smoothstep(0.52, 0.78, c1).add(pow(sunDot, 6).mul(0.35)));
      sky.assign(mix(sky, cloudLit, cloudMask.mul(0.68)));

      // High-altitude Andean starfield at night
      const starCell = floor(d.mul(180));
      const starHash = hash3(starCell);
      const starBright = smoothstep(0.978, 0.995, starHash).mul(smoothstep(0.04, 0.25, h));
      sky.addAssign(vec3(0.88, 0.93, 1.0).mul(starBright).mul(float(this.uNightMix).mul(2.6)));

      return vec4(sky, 1);
    });

    mat.colorNode = skyColor(normalize(dir));

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 24), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    scene.add(this.mesh);

    // Crisp 3D Southern Hemisphere / Andean Starfield Points Dome
    const starCount = 1400;
    const starPos = new Float32Array(starCount * 3);
    const starCol = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = ((i * 0.6180339887) % 1);
      const v = ((i * 0.3819660112) % 1);
      const theta = u * Math.PI * 2;
      const phi = Math.acos(0.05 + v * 0.95);
      const r = 1350;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const tint = (i % 5) * 0.06;
      starCol[i * 3] = 0.85 + tint * 0.5;
      starCol[i * 3 + 1] = 0.90 + tint * 0.3;
      starCol[i * 3 + 2] = 1.0;
    }
    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeom.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
    this.starMat = new THREE.PointsMaterial({
      size: 4.5,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: activeToD === 'night' ? 0.95 : 0.0,
      depthWrite: false,
      fog: false,
    });
    this.stars = new THREE.Points(starGeom, this.starMat);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = 0;
    this.stars.visible = activeToD === 'night' || activeToD === 'dusk';
    scene.add(this.stars);
  }

  public update(pos: THREE.Vector3, tod: TimeOfDay = activeToD): void {
    this.mesh.position.copy(pos);
    this.stars.position.copy(pos);
    const cfg = TOD_PRESETS[tod] || TOD_PRESETS.day;
    this.uZenithColor.value.set(cfg.zenithColor);
    this.uHorizonColor.value.set(cfg.fogColor);
    this.uSunColor.value.set(cfg.sunColor);
    this.uSunDir.value.copy(sunDirection(tod));
    this.uNightMix.value = tod === 'night' ? 1.0 : tod === 'dusk' ? 0.25 : 0.0;
    this.stars.visible = tod === 'night' || tod === 'dusk';
    this.starMat.opacity = tod === 'night' ? 0.95 : tod === 'dusk' ? 0.32 : 0.0;
  }
}
