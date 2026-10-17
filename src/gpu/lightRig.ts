import * as THREE from 'three/webgpu';
import { activeToD, sunDirection, TOD_PRESETS, type TimeOfDay } from '../world/fog';
import { fogUniforms } from './tsl';

export const rig = {
  shadowSize: 2048,
};

export class LightRig {
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  camFill: THREE.DirectionalLight;
  private targetObj = new THREE.Object3D();
  private camFillTarget = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    scene.add(this.targetObj);
    scene.add(this.camFillTarget);

    // 1. Sun Directional Light
    const cfg = TOD_PRESETS[activeToD];
    this.sun = new THREE.DirectionalLight(new THREE.Color(cfg.sunColor), cfg.sunIntensity);
    this.sun.castShadow = true;
    this.sun.target = this.targetObj;

    const cam = this.sun.shadow.camera as THREE.OrthographicCamera;
    const radius = 54;
    cam.left = -radius;
    cam.right = radius;
    cam.top = radius;
    cam.bottom = -radius;
    cam.near = 1;
    cam.far = 200;

    this.sun.shadow.mapSize.set(rig.shadowSize, rig.shadowSize);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = 3;

    scene.add(this.sun);

    // 2. Hemisphere Ambient Light (High-altitude Andean sky + warm earth bounce)
    this.hemi = new THREE.HemisphereLight(
      new THREE.Color(cfg.hemiSky),
      new THREE.Color(cfg.hemiGround),
      cfg.hemiIntensity * 1.5
    );
    scene.add(this.hemi);

    // 3. Andean Camera Fill / Bounce Light (scaled dynamically by Time of Day)
    this.camFill = new THREE.DirectionalLight(0xffecd8, 0.62);
    this.camFill.target = this.camFillTarget;
    scene.add(this.camFill);

    this.applyToD(activeToD);
  }

  public update(playerPos: THREE.Vector3, cameraPos: THREE.Vector3): void {
    this.targetObj.position.copy(playerPos);

    const sDir = sunDirection(activeToD);
    this.sun.position.copy(playerPos).addScaledVector(sDir, 85);

    // Position fill light from camera toward player
    this.camFill.position.copy(cameraPos);
    this.camFillTarget.position.copy(playerPos);
  }

  public applyToD(tod: TimeOfDay): void {
    const cfg = TOD_PRESETS[tod] || TOD_PRESETS.day;
    this.sun.color.set(cfg.sunColor);
    this.sun.intensity = cfg.sunIntensity;

    this.hemi.color.set(cfg.hemiSky);
    this.hemi.groundColor.set(cfg.hemiGround);
    this.hemi.intensity = cfg.hemiIntensity * 1.5;

    if (tod === 'night') {
      this.camFill.color.setHex(0x6886b4);
      this.camFill.intensity = 0.24;
    } else if (tod === 'dawn' || tod === 'dusk') {
      this.camFill.color.setHex(0xffcca0);
      this.camFill.intensity = 0.48;
    } else {
      this.camFill.color.setHex(0xffecd8);
      this.camFill.intensity = 0.62;
    }

    const sDir = sunDirection(tod);
    fogUniforms.color.value.set(cfg.fogColor);
    fogUniforms.sun.value.set(cfg.sunColor);
    fogUniforms.sunDir.value.set(sDir.x, sDir.y, sDir.z);
    fogUniforms.density.value = cfg.fogDensity;
    fogUniforms.falloff.value = cfg.fogFalloff;
  }

  public setShadowSize(size: number): void {
    rig.shadowSize = size;
    this.sun.shadow.mapSize.set(size, size);
  }
}
