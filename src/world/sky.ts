import * as THREE from 'three/webgpu';
import { activeToD, sunDirection, TOD_PRESETS, type TimeOfDay } from './fog';
import { T, type N } from '../gpu/tsl';

const {
  cameraProjectionMatrix, clamp, dot, Fn, max, mix, modelViewMatrix,
  normalize, positionLocal, pow, smoothstep, uniform, varying, vec3, vec4,
} = T;

export class Sky {
  public mesh: THREE.Mesh;
  private uSunDir = uniform(new THREE.Vector3());
  private uZenithColor = uniform(new THREE.Color(0x285694));
  private uHorizonColor = uniform(new THREE.Color());
  private uSunColor = uniform(new THREE.Color());

  constructor(scene: THREE.Scene) {
    const sDir = sunDirection();
    const cfg = TOD_PRESETS[activeToD];

    this.uSunDir.value.copy(sDir);
    this.uZenithColor.value.set(0x285694);
    this.uHorizonColor.value.set(cfg.fogColor);
    this.uSunColor.value.set(cfg.sunColor);

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

      // Physical sun disk & glare
      const sunDot = max(dot(d, this.uSunDir), 0);
      const sunGlow = pow(sunDot, 120).mul(1.5);
      const sunDisk = smoothstep(0.9992, 0.9998, sunDot).mul(4);
      sky.addAssign(this.uSunColor.mul(sunGlow.add(sunDisk)));

      return vec4(sky, 1);
    });

    mat.colorNode = skyColor(normalize(dir));

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 24), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    scene.add(this.mesh);
  }

  public update(pos: THREE.Vector3, tod: TimeOfDay = activeToD): void {
    this.mesh.position.copy(pos);
    const cfg = TOD_PRESETS[tod];
    this.uHorizonColor.value.set(cfg.fogColor);
    this.uSunColor.value.set(cfg.sunColor);
    this.uSunDir.value.copy(sunDirection());
  }
}
