import * as THREE from 'three';
import { getGlobalTerrainHeight } from './terrain.js';

export type WeatherState = 'CLEAR' | 'OVERCAST' | 'RAIN' | 'STORM';

export interface WeatherConfig {
  state: WeatherState;
  rainIntensity: number; // 0 to 1
  windSpeed: number;     // m/s
  windAngle: number;     // radians
  cloudCoverage: number; // 0 to 1
}

export class WeatherSystem {
  public state: WeatherState = 'CLEAR';
  public rainIntensity: number = 0.0;
  public targetRainIntensity: number = 0.0;

  public wind = new THREE.Vector3(3.5, 0, 1.8);
  public cloudCoverage: number = 0.2;

  public group = new THREE.Group();

  // Rain Streak System (LineSegments with zero per-frame allocation)
  private rainCount: number = 2200;
  private rainLines: THREE.LineSegments | null = null;
  private rainPositions: Float32Array;
  private rainOffsets: Float32Array; // Relative initial particle positions in wrap box
  private rainSpeeds: Float32Array;
  private rainLengths: Float32Array;
  private rainMat: THREE.LineBasicMaterial;

  // Ground Splash Ripple System
  private splashCount: number = 80;
  private splashMesh: THREE.InstancedMesh | null = null;
  private splashData: { x: number; y: number; z: number; scale: number; opacity: number; life: number; maxLife: number; active: boolean }[] = [];
  private dummy = new THREE.Object3D();

  // Volumetric Mountain Cloud Blankets
  private cloudPlanes: THREE.Mesh[] = [];

  // Lightning Chiaroscuro Flash
  public lightningFlash: number = 0; // 0 to 1
  public lightningTimer: number = 0;
  public lightningLight: THREE.DirectionalLight | null = null;

  constructor(scene: THREE.Scene) {
    this.group.name = 'WeatherSystem';
    scene.add(this.group);

    // Initialize Rain Line Buffers (2 vertices per streak = 6 floats)
    this.rainPositions = new Float32Array(this.rainCount * 6);
    this.rainOffsets = new Float32Array(this.rainCount * 3);
    this.rainSpeeds = new Float32Array(this.rainCount);
    this.rainLengths = new Float32Array(this.rainCount);

    const boxW = 34, boxH = 26, boxD = 34;
    for (let i = 0; i < this.rainCount; i++) {
      const rx = (Math.random() - 0.5) * boxW;
      const ry = Math.random() * boxH - 8; // -8m to +18m relative to camera
      const rz = (Math.random() - 0.5) * boxD;

      this.rainOffsets[i * 3 + 0] = rx;
      this.rainOffsets[i * 3 + 1] = ry;
      this.rainOffsets[i * 3 + 2] = rz;

      this.rainSpeeds[i] = 20.0 + Math.random() * 8.0; // 20-28 m/s fall speed
      this.rainLengths[i] = 0.45 + Math.random() * 0.35; // 0.45-0.80 m streak length
    }

    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));

    this.rainMat = new THREE.LineBasicMaterial({
      color: 0x9cb8cc, // Slate-blue rainwater sheen
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.rainLines = new THREE.LineSegments(rainGeo, this.rainMat);
    this.rainLines.frustumCulled = false;
    this.group.add(this.rainLines);

    // Initialize Splash Ripples
    this.initSplashRipples();

    // Initialize Volumetric Mountain Clouds
    this.initMountainCloudBlankets();

    // Lightning Flash Light
    this.lightningLight = new THREE.DirectionalLight(0xdbe9ff, 0.0);
    this.lightningLight.position.set(20, 80, -30);
    this.group.add(this.lightningLight);
  }

  private initSplashRipples() {
    const ringGeo = new THREE.RingGeometry(0.04, 0.09, 16);
    ringGeo.rotateX(-Math.PI / 2); // Lay flat on XZ ground

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xb5cddb,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.splashMesh = new THREE.InstancedMesh(ringGeo, ringMat, this.splashCount);
    this.splashMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.splashMesh.frustumCulled = false;
    this.splashMesh.visible = false;
    this.group.add(this.splashMesh);

    for (let i = 0; i < this.splashCount; i++) {
      this.splashData.push({
        x: 0, y: 0, z: 0,
        scale: 0.1,
        opacity: 0,
        life: 0,
        maxLife: 0.35,
        active: false,
      });
      this.dummy.position.set(0, -999, 0);
      this.dummy.updateMatrix();
      this.splashMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.splashMesh.instanceMatrix.needsUpdate = true;
  }

  private initMountainCloudBlankets() {
    // Canvas-generated procedural soft cloud puff texture
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
    grad.addColorStop(0.0, 'rgba(230, 235, 240, 0.7)');
    grad.addColorStop(0.4, 'rgba(215, 222, 230, 0.45)');
    grad.addColorStop(0.8, 'rgba(195, 205, 215, 0.18)');
    grad.addColorStop(1.0, 'rgba(180, 195, 210, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const cloudTex = new THREE.CanvasTexture(canvas);
    cloudTex.wrapS = THREE.ClampToEdgeWrapping;
    cloudTex.wrapT = THREE.ClampToEdgeWrapping;

    const cloudMat = new THREE.MeshBasicMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // Create 6 layered cloud bank planes drifting along the canyon gorge
    const cloudPositions = [
      new THREE.Vector3(15, 12.0, -35),
      new THREE.Vector3(-25, 16.0, 10),
      new THREE.Vector3(40, 14.5, -70),
      new THREE.Vector3(-10, 19.0, -90),
      new THREE.Vector3(30, 22.0, 45),
      new THREE.Vector3(0, 15.0, 15),
    ];

    for (let i = 0; i < cloudPositions.length; i++) {
      const w = 45 + Math.random() * 25;
      const h = 45 + Math.random() * 25;
      const geo = new THREE.PlaneGeometry(w, h);
      geo.rotateX(-Math.PI * 0.48); // Near horizontal with subtle hill-following tilt

      const mesh = new THREE.Mesh(geo, cloudMat.clone());
      mesh.position.copy(cloudPositions[i]);
      this.group.add(mesh);
      this.cloudPlanes.push(mesh);
    }
  }

  public setWeather(state: WeatherState, immediate: boolean = false) {
    this.state = state;
    switch (state) {
      case 'CLEAR':
        this.targetRainIntensity = 0.0;
        this.cloudCoverage = 0.15;
        this.wind.set(2.0, 0, 1.0);
        break;
      case 'OVERCAST':
        this.targetRainIntensity = 0.0;
        this.cloudCoverage = 0.65;
        this.wind.set(3.5, 0, 2.0);
        break;
      case 'RAIN':
        this.targetRainIntensity = 0.75;
        this.cloudCoverage = 0.88;
        this.wind.set(5.5, 0, 3.2);
        break;
      case 'STORM':
        this.targetRainIntensity = 1.0;
        this.cloudCoverage = 1.0;
        this.wind.set(8.5, 0, 5.0);
        break;
    }

    if (immediate) {
      this.rainIntensity = this.targetRainIntensity;
    }
  }

  public triggerLightning(duration: number = 0.14) {
    this.lightningFlash = 1.0;
    this.lightningTimer = duration;
  }

  public spawnSplash(x: number, y: number, z: number) {
    for (const s of this.splashData) {
      if (!s.active) {
        s.active = true;
        s.x = x;
        s.y = y + 0.02; // Just above ground plane
        s.z = z;
        s.scale = 0.2;
        s.opacity = 0.6;
        s.life = 0;
        s.maxLife = 0.25 + Math.random() * 0.15;
        break;
      }
    }
  }

  public update(dt: number, camera: THREE.Camera, characterPos: THREE.Vector3) {
    // 1. Smooth rain intensity transition
    if (this.rainIntensity !== this.targetRainIntensity) {
      const step = 0.6 * dt;
      if (Math.abs(this.rainIntensity - this.targetRainIntensity) <= step) {
        this.rainIntensity = this.targetRainIntensity;
      } else {
        this.rainIntensity += Math.sign(this.targetRainIntensity - this.rainIntensity) * step;
      }
    }

    // 2. Lightning Flash Chiaroscuro Integration
    if (this.state === 'STORM' && Math.random() < 0.003) {
      this.triggerLightning(0.12 + Math.random() * 0.08);
    }

    if (this.lightningTimer > 0) {
      this.lightningTimer -= dt;
      this.lightningFlash = Math.max(0, this.lightningTimer / 0.14);
      if (this.lightningLight) {
        this.lightningLight.intensity = this.lightningFlash * 5.5;
      }
    } else {
      this.lightningFlash = 0;
      if (this.lightningLight) {
        this.lightningLight.intensity = 0;
      }
    }

    // 3. Volumetric Mountain Cloud Drifting
    const cloudSpeed = 0.6 + this.wind.length() * 0.25;
    for (let i = 0; i < this.cloudPlanes.length; i++) {
      const plane = this.cloudPlanes[i];
      plane.position.x += this.wind.x * cloudSpeed * 0.15 * dt;
      plane.position.z += this.wind.z * cloudSpeed * 0.15 * dt;
      plane.rotation.z += (i % 2 === 0 ? 0.02 : -0.02) * dt;

      // Wrap clouds around river canyon (bounds ±120m)
      if (plane.position.x > 110) plane.position.x = -110;
      if (plane.position.x < -110) plane.position.x = 110;
      if (plane.position.z > 110) plane.position.z = -110;
      if (plane.position.z < -110) plane.position.z = 110;

      // Opacity scales with cloudCoverage
      const targetOp = 0.35 * this.cloudCoverage;
      (plane.material as THREE.MeshBasicMaterial).opacity = targetOp;
    }

    // 4. Update Rain Streaks
    if (this.rainIntensity > 0.01 && this.rainLines) {
      this.rainLines.visible = true;
      this.rainMat.opacity = this.rainIntensity * 0.48;

      const camPos = camera.position;
      const boxW = 34, boxH = 26, boxD = 34;
      const halfW = boxW * 0.5, halfD = boxD * 0.5;

      const windNormX = this.wind.x * 0.045;
      const windNormZ = this.wind.z * 0.045;

      const pos = this.rainPositions;

      for (let i = 0; i < this.rainCount; i++) {
        const idx = i * 6;
        const offIdx = i * 3;

        // Advance particle downward
        this.rainOffsets[offIdx + 1] -= this.rainSpeeds[i] * dt;
        this.rainOffsets[offIdx + 0] += this.wind.x * dt;
        this.rainOffsets[offIdx + 2] += this.wind.z * dt;

        // Wrap within camera-relative box
        if (this.rainOffsets[offIdx + 1] < -8.0) {
          this.rainOffsets[offIdx + 1] += boxH;
          // Spawn occasional splash on bottom wrap if near ground
          if (i % 12 === 0) {
            const worldX = camPos.x + this.rainOffsets[offIdx + 0];
            const worldZ = camPos.z + this.rainOffsets[offIdx + 2];
            const groundY = getGlobalTerrainHeight(worldX, worldZ);
            this.spawnSplash(worldX, groundY, worldZ);
          }
        }
        if (this.rainOffsets[offIdx + 0] > halfW) this.rainOffsets[offIdx + 0] -= boxW;
        if (this.rainOffsets[offIdx + 0] < -halfW) this.rainOffsets[offIdx + 0] += boxW;
        if (this.rainOffsets[offIdx + 2] > halfD) this.rainOffsets[offIdx + 2] -= boxD;
        if (this.rainOffsets[offIdx + 2] < -halfD) this.rainOffsets[offIdx + 2] += boxD;

        // World coordinates of top vertex
        const topX = camPos.x + this.rainOffsets[offIdx + 0];
        const topY = camPos.y + this.rainOffsets[offIdx + 1];
        const topZ = camPos.z + this.rainOffsets[offIdx + 2];

        // Bottom vertex trailed along velocity & wind vector
        const streakLen = this.rainLengths[i];
        const botX = topX - windNormX * streakLen;
        const botY = topY - streakLen;
        const botZ = topZ - windNormZ * streakLen;

        pos[idx + 0] = topX;
        pos[idx + 1] = topY;
        pos[idx + 2] = topZ;

        pos[idx + 3] = botX;
        pos[idx + 4] = botY;
        pos[idx + 5] = botZ;
      }

      this.rainLines.geometry.attributes.position.needsUpdate = true;
    } else if (this.rainLines) {
      this.rainLines.visible = false;
    }

    // 5. Update Splash Ripples
    if (this.splashMesh) {
      let activeCount = 0;
      for (let i = 0; i < this.splashCount; i++) {
        const s = this.splashData[i];
        if (s.active) {
          s.life += dt;
          const prog = s.life / s.maxLife;
          if (prog >= 1.0) {
            s.active = false;
            this.dummy.position.set(0, -999, 0);
            this.dummy.updateMatrix();
            this.splashMesh.setMatrixAt(i, this.dummy.matrix);
            continue;
          }

          s.scale = THREE.MathUtils.lerp(0.15, 0.85, prog);
          this.dummy.position.set(s.x, s.y, s.z);
          this.dummy.scale.set(s.scale, 1.0, s.scale);
          this.dummy.updateMatrix();
          this.splashMesh.setMatrixAt(i, this.dummy.matrix);
          activeCount++;
        }
      }
      this.splashMesh.visible = activeCount > 0 && this.rainIntensity > 0.05;
      this.splashMesh.instanceMatrix.needsUpdate = true;
    }
  }
}
