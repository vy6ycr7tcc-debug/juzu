import * as THREE from 'three/webgpu';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { activeToD, sunDirection, TOD_PRESETS, type TimeOfDay } from '../world/fog';
import { fogUniforms } from './tsl';
import { MOBILE } from '../core/quality';

export const rig = {
  shadowSize: 2048,
};

export class LightRig {
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  camFill: THREE.DirectionalLight;
  private sceneRef: THREE.Scene;
  private targetObj = new THREE.Object3D();
  private camFillTarget = new THREE.Object3D();
  private envTexture?: THREE.DataTexture;

  constructor(scene: THREE.Scene) {
    this.sceneRef = scene;
    scene.add(this.targetObj);
    scene.add(this.camFillTarget);

    // 1. Sun Directional Light
    const cfg = TOD_PRESETS[activeToD];
    this.sun = new THREE.DirectionalLight(new THREE.Color(cfg.sunColor), cfg.sunIntensity);
    this.sun.castShadow = true;
    this.sun.target = this.targetObj;

    const cam = this.sun.shadow.camera as THREE.OrthographicCamera;
    const radius = 36;
    cam.left = -radius;
    cam.right = radius;
    cam.top = radius;
    cam.bottom = -radius;
    cam.near = 1;
    cam.far = 180;

    this.sun.shadow.mapSize.set(rig.shadowSize, rig.shadowSize);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.028;
    this.sun.shadow.radius = 2.5;

    scene.add(this.sun);

    // 2. Hemisphere Ambient Light (High-altitude Andean sky + warm earth bounce)
    this.hemi = new THREE.HemisphereLight(
      new THREE.Color(cfg.hemiSky),
      new THREE.Color(cfg.hemiGround),
      cfg.hemiIntensity * 0.9
    );
    scene.add(this.hemi);

    // 3. Subtle Andean Camera Eye-Catch Fill (low intensity so normal maps and shadows stay crisp)
    this.camFill = new THREE.DirectionalLight(0xffecd8, 0.12);
    this.camFill.target = this.camFillTarget;
    scene.add(this.camFill);

    // 4. Photorealistic Andean Image-Based Lighting (IBL) & Environment Map (Poly Haven CC0)
    // Use optimized 512 HDR (466KB) so environment radiance loads in <50ms without 30s CPU stalls
    const hdrLoader = new HDRLoader();
    const hdrPath = '/juzu/textures/hdr/forest_slope_512.hdr';
    hdrLoader.load(
      hdrPath,
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.envTexture = texture;
        this.sceneRef.environment = texture;
        this.applyEnvironmentIntensity(activeToD);
      },
      undefined,
      (err) => {
        console.warn('[LightRig] Could not load HDR environment map:', err);
      }
    );

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
    this.hemi.intensity = cfg.hemiIntensity * 0.9;

    if (tod === 'night') {
      this.camFill.color.setHex(0x6886b4);
      this.camFill.intensity = 0.08;
    } else if (tod === 'dawn' || tod === 'dusk') {
      this.camFill.color.setHex(0xffcca0);
      this.camFill.intensity = 0.10;
    } else {
      this.camFill.color.setHex(0xffecd8);
      this.camFill.intensity = 0.12;
    }

    const sDir = sunDirection(tod);
    fogUniforms.color.value.set(cfg.fogColor);
    fogUniforms.sun.value.set(cfg.sunColor);
    fogUniforms.sunDir.value.set(sDir.x, sDir.y, sDir.z);
    fogUniforms.density.value = cfg.fogDensity;
    fogUniforms.falloff.value = cfg.fogFalloff;

    this.applyEnvironmentIntensity(tod);
  }

  private applyEnvironmentIntensity(tod: TimeOfDay): void {
    if (!this.sceneRef.environment) return;
    if (tod === 'night') {
      this.sceneRef.environmentIntensity = 0.10;
    } else if (tod === 'dawn' || tod === 'dusk') {
      this.sceneRef.environmentIntensity = 0.30;
    } else {
      this.sceneRef.environmentIntensity = 0.45;
    }
  }

  public setShadowSize(size: number): void {
    rig.shadowSize = size;
    this.sun.shadow.mapSize.set(size, size);
  }
}
