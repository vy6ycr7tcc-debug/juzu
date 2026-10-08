import * as THREE from 'three';
import { ashlarWeathered } from './materials.js';

export interface RelicData {
  id: string;
  name: string;
  subtitle: string;
  period: string;
  material: string;
  lore: string;
  secretTitle: string;
  secretLore: string;
}

export const INTI_EFFIGY_LORE: RelicData = {
  id: 'inti_sun_effigy',
  name: 'Inti Solar Effigy',
  subtitle: 'Coricancha High Priest Solstice Pectoral',
  period: 'Late Horizon Inca (circa 1480 CE)',
  material: 'Carved Andean Serpentine, Peruvian Turquoise, Aged Tumbaga Bronze',
  lore: 'A sacred ceremonial solar effigy recovered from the Coricancha sun temple in Cusco. During the Winter Solstice (Inti Raymi), the Willaq Umu (High Priest of the Sun) held this disk aloft to catch the dawn light, symbolically renewing the bond between the Inca Empire and the Sun God.',
  secretTitle: '★ Archaeological Secret Uncovered',
  secretLore: 'The reverse reveals twelve incised astronomical quipu notches recording agricultural sowing cycles aligned with the zenith passage of the Pleiades.',
};

/**
 * Generates procedural high-resolution PBR textures for the Serpentine Inti Sun Disk.
 * Features an intricately carved Incan solar mask, concentric Chakana stepped borders,
 * astronomical calendar markings, and reverse quipu notches.
 */
function createSerpentineTextures(): {
  frontMap: THREE.CanvasTexture;
  backMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 512;
  const c = size / 2;

  // 1. FRONT DIFFUSE CANVAS
  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = size;
  frontCanvas.height = size;
  const fCtx = frontCanvas.getContext('2d')!;

  // Deep Andean serpentine stone base with fine mineral mottling
  fCtx.fillStyle = '#26382c';
  fCtx.fillRect(0, 0, size, size);

  // Mineral grain & vein variation
  for (let i = 0; i < 3500; i++) {
    const gx = Math.random() * size;
    const gy = Math.random() * size;
    const gr = Math.random() * 3 + 1;
    const v = Math.random();
    fCtx.fillStyle = v < 0.4 ? 'rgba(24, 38, 29, 0.45)' : v < 0.8 ? 'rgba(48, 70, 56, 0.35)' : 'rgba(74, 98, 80, 0.2)';
    fCtx.beginPath();
    fCtx.arc(gx, gy, gr, 0, Math.PI * 2);
    fCtx.fill();
  }

  // Circular clip for disk face
  fCtx.save();
  fCtx.beginPath();
  fCtx.arc(c, c, 235, 0, Math.PI * 2);
  fCtx.clip();

  // Outer calendar tick ring
  fCtx.strokeStyle = 'rgba(16, 26, 19, 0.85)';
  fCtx.lineWidth = 3;
  fCtx.beginPath();
  fCtx.arc(c, c, 222, 0, Math.PI * 2);
  fCtx.stroke();
  fCtx.beginPath();
  fCtx.arc(c, c, 204, 0, Math.PI * 2);
  fCtx.stroke();

  // 24 Radial Calendar Notches
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const x1 = c + Math.cos(angle) * 204;
    const y1 = c + Math.sin(angle) * 204;
    const x2 = c + Math.cos(angle) * 222;
    const y2 = c + Math.sin(angle) * 222;
    fCtx.beginPath();
    fCtx.moveTo(x1, y1);
    fCtx.lineTo(x2, y2);
    fCtx.lineWidth = i % 2 === 0 ? 3.5 : 2;
    fCtx.stroke();
  }

  // Middle Chakana stepped diamond relief ring
  fCtx.strokeStyle = 'rgba(18, 29, 21, 0.9)';
  fCtx.lineWidth = 4;
  fCtx.beginPath();
  fCtx.arc(c, c, 172, 0, Math.PI * 2);
  fCtx.stroke();
  fCtx.beginPath();
  fCtx.arc(c, c, 142, 0, Math.PI * 2);
  fCtx.stroke();

  // Stepped zig-zag pattern between 142 and 172
  fCtx.lineWidth = 2.5;
  fCtx.beginPath();
  for (let i = 0; i < 32; i++) {
    const a1 = (i / 32) * Math.PI * 2;
    const a2 = ((i + 0.5) / 32) * Math.PI * 2;
    const r1 = 144;
    const r2 = 170;
    fCtx.lineTo(c + Math.cos(a1) * r1, c + Math.sin(a1) * r1);
    fCtx.lineTo(c + Math.cos(a2) * r2, c + Math.sin(a2) * r2);
  }
  fCtx.closePath();
  fCtx.stroke();

  // Central Carved Inti Sun Mask
  // Stepped Crown / Radiant Headdress
  fCtx.fillStyle = 'rgba(16, 26, 19, 0.95)';
  fCtx.strokeStyle = 'rgba(92, 116, 96, 0.4)';
  fCtx.lineWidth = 2;

  // Crown rays rising above forehead
  for (let k = -2; k <= 2; k++) {
    const cx = c + k * 22;
    const cy = c - 70;
    const h = 34 - Math.abs(k) * 6;
    fCtx.fillRect(cx - 8, cy - h, 16, h);
    fCtx.strokeRect(cx - 8, cy - h, 16, h);
  }

  // Brow Ridge & Nose Bridge
  fCtx.fillRect(c - 45, c - 45, 90, 12);
  fCtx.beginPath();
  fCtx.moveTo(c - 14, c - 33);
  fCtx.lineTo(c + 14, c - 33);
  fCtx.lineTo(c + 20, c + 14);
  fCtx.lineTo(c - 20, c + 14);
  fCtx.closePath();
  fCtx.fill();

  // Stylized Inca Almond Eyes
  for (const side of [-1, 1]) {
    const ex = c + side * 42;
    const ey = c - 18;
    fCtx.beginPath();
    fCtx.ellipse(ex, ey, 20, 10, side * 0.15, 0, Math.PI * 2);
    fCtx.fillStyle = 'rgba(14, 22, 16, 0.98)';
    fCtx.fill();
    fCtx.strokeStyle = 'rgba(80, 108, 86, 0.5)';
    fCtx.stroke();

    // Obsidian Pupil
    fCtx.beginPath();
    fCtx.arc(ex, ey, 6, 0, Math.PI * 2);
    fCtx.fillStyle = '#0c120e';
    fCtx.fill();

    // Sacred Solstice Tear Conduit Lines (Inca rain/fertility symbolism)
    fCtx.strokeStyle = 'rgba(16, 26, 19, 0.9)';
    fCtx.lineWidth = 2.5;
    fCtx.beginPath();
    fCtx.moveTo(ex, ey + 10);
    fCtx.lineTo(ex - side * 4, ey + 38);
    fCtx.lineTo(ex + side * 2, ey + 52);
    fCtx.stroke();
  }

  // Ceremonial Mouth & Teeth Plate
  fCtx.fillStyle = 'rgba(14, 22, 16, 0.95)';
  fCtx.fillRect(c - 36, c + 32, 72, 22);
  fCtx.strokeStyle = 'rgba(92, 116, 96, 0.45)';
  fCtx.strokeRect(c - 36, c + 32, 72, 22);

  // Incised teeth divisions
  fCtx.strokeStyle = 'rgba(56, 80, 64, 0.7)';
  fCtx.lineWidth = 1.5;
  for (let t = 1; t < 6; t++) {
    fCtx.beginPath();
    fCtx.moveTo(c - 36 + t * 12, c + 32);
    fCtx.lineTo(c - 36 + t * 12, c + 54);
    fCtx.stroke();
  }

  // Radiating cheek flare incisions
  for (const s of [-1, 1]) {
    fCtx.strokeStyle = 'rgba(18, 28, 20, 0.8)';
    fCtx.lineWidth = 2;
    for (let r = 0; r < 3; r++) {
      fCtx.beginPath();
      fCtx.moveTo(c + s * 65, c + r * 16 - 10);
      fCtx.lineTo(c + s * 115, c + r * 22 - 6);
      fCtx.stroke();
    }
  }

  fCtx.restore();

  // 2. BACK CANVAS (Archaeological Secret: Quipu Calendar & Solstice Notches)
  const backCanvas = document.createElement('canvas');
  backCanvas.width = size;
  backCanvas.height = size;
  const bCtx = backCanvas.getContext('2d')!;

  bCtx.fillStyle = '#223227';
  bCtx.fillRect(0, 0, size, size);

  // Back grain
  for (let i = 0; i < 2500; i++) {
    const gx = Math.random() * size;
    const gy = Math.random() * size;
    bCtx.fillStyle = Math.random() < 0.5 ? 'rgba(16, 26, 19, 0.4)' : 'rgba(40, 60, 48, 0.3)';
    bCtx.beginPath();
    bCtx.arc(gx, gy, Math.random() * 2.5 + 1, 0, Math.PI * 2);
    bCtx.fill();
  }

  bCtx.save();
  bCtx.beginPath();
  bCtx.arc(c, c, 235, 0, Math.PI * 2);
  bCtx.clip();

  // Concentric Astronomical Solstice Rings
  bCtx.strokeStyle = 'rgba(14, 22, 16, 0.9)';
  bCtx.lineWidth = 3;
  bCtx.beginPath();
  bCtx.arc(c, c, 215, 0, Math.PI * 2);
  bCtx.arc(c, c, 185, 0, Math.PI * 2);
  bCtx.arc(c, c, 130, 0, Math.PI * 2);
  bCtx.arc(c, c, 65, 0, Math.PI * 2);
  bCtx.stroke();

  // 12 Agricultural Quipu Calendar Cords Radiating from Center
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const xEnd = c + Math.cos(a) * 215;
    const yEnd = c + Math.sin(a) * 215;

    bCtx.strokeStyle = 'rgba(12, 18, 14, 0.95)';
    bCtx.lineWidth = 3;
    bCtx.beginPath();
    bCtx.moveTo(c, c);
    bCtx.lineTo(xEnd, yEnd);
    bCtx.stroke();

    // Knotted Quipu nodules along the cord
    for (let k = 1; k <= 3; k++) {
      const nr = 45 + k * 45;
      const kx = c + Math.cos(a) * nr;
      const ky = c + Math.sin(a) * nr;
      bCtx.fillStyle = '#bfa157'; // Gold-leaf filled knot incisions
      bCtx.beginPath();
      bCtx.arc(kx, ky, 4.5, 0, Math.PI * 2);
      bCtx.fill();
      bCtx.strokeStyle = '#221a0d';
      bCtx.stroke();
    }
  }

  // Central Solstice Sun Spiral
  bCtx.strokeStyle = 'rgba(180, 150, 80, 0.7)';
  bCtx.lineWidth = 3.5;
  bCtx.beginPath();
  for (let t = 0; t < Math.PI * 6; t += 0.1) {
    const rad = 5 + t * 4;
    const sx = c + Math.cos(t) * rad;
    const sy = c + Math.sin(t) * rad;
    if (t === 0) bCtx.moveTo(sx, sy);
    else bCtx.lineTo(sx, sy);
  }
  bCtx.stroke();

  bCtx.restore();

  // 3. BUMP / NORMAL MAP CANVAS (High-frequency Chisel Relief)
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bumpCtx = bumpCanvas.getContext('2d')!;

  bumpCtx.fillStyle = '#808080'; // Neutral midpoint
  bumpCtx.fillRect(0, 0, size, size);

  // Render front lines as dark recessed incisions and raised surfaces as bright
  bumpCtx.drawImage(frontCanvas, 0, 0);
  const bumpImg = bumpCtx.getImageData(0, 0, size, size);
  const d = bumpImg.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // Map dark carvings to depressed heights, medium stone to 128, raised details to 180+
    const h = Math.min(255, Math.max(0, Math.floor(128 + (lum - 60) * 1.8)));
    d[i] = h;
    d[i + 1] = h;
    d[i + 2] = h;
    d[i + 3] = 255;
  }
  bumpCtx.putImageData(bumpImg, 0, 0);

  // 4. ROUGHNESS MAP CANVAS
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  // Smooth polished semi-gloss stone base
  rCtx.fillStyle = '#6e6e6e'; // ~0.43 roughness
  rCtx.fillRect(0, 0, size, size);

  // Chiseled carvings have higher roughness (~0.85)
  rCtx.drawImage(bumpCanvas, 0, 0);
  const rImg = rCtx.getImageData(0, 0, size, size);
  const rd = rImg.data;
  for (let i = 0; i < rd.length; i += 4) {
    // Invert height so deep cuts are rougher
    const rough = Math.min(240, Math.max(90, 255 - rd[i]));
    rd[i] = rough;
    rd[i + 1] = rough;
    rd[i + 2] = rough;
  }
  rCtx.putImageData(rImg, 0, 0);

  // Wrap in three.js CanvasTextures
  const frontTex = new THREE.CanvasTexture(frontCanvas);
  frontTex.colorSpace = THREE.SRGBColorSpace;
  frontTex.generateMipmaps = true;

  const backTex = new THREE.CanvasTexture(backCanvas);
  backTex.colorSpace = THREE.SRGBColorSpace;
  backTex.generateMipmaps = true;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.generateMipmaps = true;

  const roughTex = new THREE.CanvasTexture(roughCanvas);
  roughTex.generateMipmaps = true;

  return { frontMap: frontTex, backMap: backTex, bumpMap: bumpTex, roughnessMap: roughTex };
}

/**
 * Creates authentic Peruvian chrysocolla/turquoise cabochon texture with
 * branching dark limonite matrix veins.
 */
function createTurquoiseTexture(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Vivid Andean blue-green turquoise base
  const grad = ctx.createRadialGradient(size * 0.4, size * 0.4, 4, size * 0.5, size * 0.5, size * 0.6);
  grad.addColorStop(0, '#1ec8a7');
  grad.addColorStop(0.5, '#14a387');
  grad.addColorStop(1, '#0e7c67');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Spiderweb limonite matrix veins
  ctx.strokeStyle = '#22180e';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  let vx = 20, vy = 30;
  ctx.moveTo(vx, vy);
  for (let i = 0; i < 16; i++) {
    vx += (Math.random() - 0.4) * 20;
    vy += Math.random() * 12 + 4;
    ctx.lineTo(vx, vy);
    if (Math.random() < 0.4) {
      // Branch vein
      const bx = vx + (Math.random() - 0.5) * 24;
      const by = vy + (Math.random() - 0.5) * 16;
      ctx.moveTo(vx, vy);
      ctx.lineTo(bx, by);
      ctx.moveTo(vx, vy);
    }
  }
  ctx.stroke();

  // Golden pyrite flecks
  ctx.fillStyle = '#b39542';
  for (let i = 0; i < 20; i++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    ctx.fillRect(px, py, 2, 2);
  }

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d')!;
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);
  bctx.drawImage(canvas, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const bump = new THREE.CanvasTexture(bumpCanvas);

  return { map: tex, bumpMap: bump };
}

/**
 * Creates aged Andean tumbaga bronze material texture with verdigris patina.
 */
function createBronzePatinaTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Warm hammered bronze base
  ctx.fillStyle = '#85704a';
  ctx.fillRect(0, 0, size, size);

  // Hammered texture noise
  for (let i = 0; i < 1500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(155, 132, 88, 0.4)' : 'rgba(92, 76, 48, 0.5)';
    ctx.fillRect(x, y, 3, 3);
  }

  // Greenish verdigris patina streaks
  ctx.strokeStyle = 'rgba(74, 88, 68, 0.5)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, 0);
    ctx.bezierCurveTo(
      Math.random() * size, size * 0.3,
      Math.random() * size, size * 0.7,
      Math.random() * size, size
    );
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class SacredRelicSystem {
  public group = new THREE.Group();
  public altarMesh: THREE.Mesh;
  public relicGroup = new THREE.Group();
  public isInspecting: boolean = false;
  public inspectionRotation = new THREE.Euler(0, 0, 0);

  public data: RelicData = INTI_EFFIGY_LORE;
  private scene: THREE.Scene;
  private inspectKeyLight: THREE.PointLight;
  private inspectFillLight: THREE.PointLight;
  private inspectRimLight: THREE.PointLight;
  private altarSunbeam: THREE.SpotLight;
  private dustMotes: THREE.Points;
  private secretFound: boolean = false;
  private uiContainer: HTMLElement | null = null;

  constructor(scene: THREE.Scene, altarPosition: THREE.Vector3 = new THREE.Vector3(35, 12, -58.5)) {
    this.scene = scene;
    this.group.name = 'SacredRelicSystem';
    this.group.position.copy(altarPosition);

    // --- 1. Ancient Weathered Ashlar Ceremonial Altar ---
    const altarMat = ashlarWeathered();

    // Stepped plinth foundation base
    const baseGeo = new THREE.BoxGeometry(1.85, 0.35, 1.65);
    const plinthMesh = new THREE.Mesh(baseGeo, altarMat);
    plinthMesh.position.set(0, 0.175, 0);
    plinthMesh.castShadow = true;
    plinthMesh.receiveShadow = true;
    this.group.add(plinthMesh);

    // Mid-tier ashlar altar block
    const midGeo = new THREE.BoxGeometry(1.5, 0.65, 1.35);
    this.altarMesh = new THREE.Mesh(midGeo, altarMat);
    this.altarMesh.position.set(0, 0.35 + 0.325, 0);
    this.altarMesh.castShadow = true;
    this.altarMesh.receiveShadow = true;
    this.group.add(this.altarMesh);

    // Top offering slab with beveled edge
    const slabGeo = new THREE.BoxGeometry(1.68, 0.16, 1.48);
    const slabMesh = new THREE.Mesh(slabGeo, altarMat);
    slabMesh.position.set(0, 1.0 + 0.08, 0);
    slabMesh.castShadow = true;
    slabMesh.receiveShadow = true;
    this.group.add(slabMesh);

    // Carved dark diorite relic cradle / display stand
    const standMat = new THREE.MeshStandardMaterial({
      color: 0x2e2924,
      roughness: 0.88,
      metalness: 0.0,
    });
    const standGeo = new THREE.CylinderGeometry(0.24, 0.32, 0.18, 12);
    const standMesh = new THREE.Mesh(standGeo, standMat);
    standMesh.position.set(0, 1.16 + 0.09, 0);
    standMesh.castShadow = true;
    this.group.add(standMesh);

    // Ceremonial Flanking Offerings: Aged Patinated Bronze Kero Beakers & Copal Incense Bowl
    const keroMat = new THREE.MeshStandardMaterial({
      color: 0x483a24,
      roughness: 0.68,
      metalness: 0.14,
    });
    const keroGeo = new THREE.CylinderGeometry(0.08, 0.05, 0.22, 12);

    const leftKero = new THREE.Mesh(keroGeo, keroMat);
    leftKero.position.set(-0.55, 1.27, -0.15);
    leftKero.castShadow = true;
    this.group.add(leftKero);

    const rightKero = new THREE.Mesh(keroGeo, keroMat);
    rightKero.position.set(0.55, 1.27, -0.15);
    rightKero.castShadow = true;
    this.group.add(rightKero);

    // Stone Copal Incense Bowl in front
    const bowlGeo = new THREE.CylinderGeometry(0.14, 0.08, 0.07, 12);
    const bowlMesh = new THREE.Mesh(bowlGeo, standMat);
    bowlMesh.position.set(0, 1.195, 0.42);
    this.group.add(bowlMesh);

    // --- 2. Inti Sun Effigy (Museum-Grade SOTTR Relic) ---
    this.buildIntiEffigy();

    // Position relic resting tilted ~12 degrees back on the ceremonial stand
    this.relicGroup.position.set(0, 1.48, 0);
    this.relicGroup.rotation.x = -0.15;
    this.group.add(this.relicGroup);

    // --- 3. Sacred Solstice Celestial Sunbeam ---
    this.altarSunbeam = new THREE.SpotLight(0xfff2cc, 2.8, 16.0, 0.32, 0.7, 1.2);
    this.altarSunbeam.position.set(0.2, 5.5, 0.5);
    this.altarSunbeam.target = this.relicGroup;
    this.altarSunbeam.castShadow = true;
    this.group.add(this.altarSunbeam);

    // Golden dust motes drifting in the sunbeam
    const moteCount = 65;
    const moteGeo = new THREE.BufferGeometry();
    const motePos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      motePos[i * 3] = (Math.random() - 0.5) * 1.2;
      motePos[i * 3 + 1] = 1.0 + Math.random() * 3.2;
      motePos[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
    }
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    const moteMat = new THREE.PointsMaterial({
      color: 0xffe290,
      size: 0.04,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    this.dustMotes = new THREE.Points(moteGeo, moteMat);
    this.group.add(this.dustMotes);

    // --- 4. Museum Three-Point Macro Inspection Lighting ---
    // Warm Key Light
    this.inspectKeyLight = new THREE.PointLight(0xffeed0, 0, 8.0, 1.5);
    this.inspectKeyLight.position.set(0.35, 1.75, 0.85);
    this.group.add(this.inspectKeyLight);

    // Cool Sky Fill Light
    this.inspectFillLight = new THREE.PointLight(0x90b8d8, 0, 6.0, 2.0);
    this.inspectFillLight.position.set(-0.75, 1.45, 0.65);
    this.group.add(this.inspectFillLight);

    // Golden Edge Rim Light (creates crisp specular edge silhouette)
    this.inspectRimLight = new THREE.PointLight(0xffc868, 0, 7.0, 1.6);
    this.inspectRimLight.position.set(0.0, 1.95, -0.65);
    this.group.add(this.inspectRimLight);

    this.scene.add(this.group);
  }

  private buildIntiEffigy() {
    const textures = createSerpentineTextures();
    const turquoiseTex = createTurquoiseTexture();
    const bronzeTex = createBronzePatinaTexture();

    // Serpentine Front Material
    const frontMat = new THREE.MeshStandardMaterial({
      map: textures.frontMap,
      bumpMap: textures.bumpMap,
      bumpScale: 0.035,
      roughnessMap: textures.roughnessMap,
      roughness: 0.52,
      metalness: 0.0, // Strictly dielectric stone
    });

    // Serpentine Back Material (Solstice Quipu Secret)
    const backMat = new THREE.MeshStandardMaterial({
      map: textures.backMap,
      bumpMap: textures.bumpMap,
      bumpScale: 0.03,
      roughness: 0.65,
      metalness: 0.0,
    });

    // Serpentine Rim Material
    const stoneEdgeMat = new THREE.MeshStandardMaterial({
      color: 0x243429,
      roughness: 0.75,
      metalness: 0.0,
    });

    // Bronze Alloy Corona Material
    const bronzeMat = new THREE.MeshStandardMaterial({
      map: bronzeTex,
      color: 0x826e46,
      roughness: 0.55,
      metalness: 0.18, // Weathered ancient bronze
    });

    // Peruvian Turquoise Cabochon Material
    const turquoiseMat = new THREE.MeshStandardMaterial({
      map: turquoiseTex.map,
      bumpMap: turquoiseTex.bumpMap,
      bumpScale: 0.008,
      roughness: 0.28,
      metalness: 0.0, // Strictly dielectric gem
    });

    // --- A. Central Serpentine Stone Sun Disk ---
    const diskRadius = 0.32;
    const diskThick = 0.045;

    // Front Face Plate
    const frontGeo = new THREE.CircleGeometry(diskRadius, 32);
    const frontMesh = new THREE.Mesh(frontGeo, frontMat);
    frontMesh.position.set(0, 0, diskThick * 0.5);
    frontMesh.castShadow = true;
    this.relicGroup.add(frontMesh);

    // Back Face Plate (Rotated to face -Z)
    const backGeo = new THREE.CircleGeometry(diskRadius, 32);
    backGeo.rotateY(Math.PI);
    const backMesh = new THREE.Mesh(backGeo, backMat);
    backMesh.position.set(0, 0, -diskThick * 0.5);
    backMesh.castShadow = true;
    this.relicGroup.add(backMesh);

    // Stone Rim Cylinder
    const rimGeo = new THREE.CylinderGeometry(diskRadius, diskRadius, diskThick, 32, 1, true);
    rimGeo.rotateX(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimGeo, stoneEdgeMat);
    this.relicGroup.add(rimMesh);

    // --- B. Heavy Patinated Bronze Torus Outer Rim ---
    const bronzeRimGeo = new THREE.TorusGeometry(diskRadius + 0.015, 0.024, 16, 48);
    const bronzeRim = new THREE.Mesh(bronzeRimGeo, bronzeMat);
    bronzeRim.castShadow = true;
    this.relicGroup.add(bronzeRim);

    // --- C. 12 Sculpted Andean Solar Rays (Corona) ---
    // 6 Major Diamond Pyramidal Rays + 6 Minor Serpent-Flame Rays
    const majorRayGeo = new THREE.ConeGeometry(0.065, 0.19, 4);
    majorRayGeo.rotateY(Math.PI / 4); // Facet ridge faces forward

    const minorRayGeo = new THREE.CylinderGeometry(0.012, 0.042, 0.13, 6);

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const isMajor = i % 2 === 0;

      const rayMesh = new THREE.Mesh(isMajor ? majorRayGeo : minorRayGeo, bronzeMat);
      const dist = diskRadius + 0.025 + (isMajor ? 0.085 : 0.06);
      rayMesh.position.set(Math.cos(angle) * dist, Math.sin(angle) * dist, 0);
      rayMesh.rotation.z = angle - Math.PI / 2;
      rayMesh.castShadow = true;
      this.relicGroup.add(rayMesh);
    }

    // --- D. 4 Cardinal Turquoise Mineral Cabochons ---
    const bezelGeo = new THREE.TorusGeometry(0.042, 0.009, 10, 20);
    const cabochonGeo = new THREE.SphereGeometry(0.038, 16, 12);
    cabochonGeo.scale(1, 1, 0.42); // Domed cabochon profile

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const r = 0.225;
      const cx = Math.cos(angle) * r;
      const cy = Math.sin(angle) * r;

      // Recessed bronze bezel setting
      const bezel = new THREE.Mesh(bezelGeo, bronzeMat);
      bezel.position.set(cx, cy, diskThick * 0.5 + 0.008);
      bezel.castShadow = true;
      this.relicGroup.add(bezel);

      // Polished turquoise cabochon
      const cabochon = new THREE.Mesh(cabochonGeo, turquoiseMat);
      cabochon.position.set(cx, cy, diskThick * 0.5 + 0.016);
      cabochon.castShadow = true;
      this.relicGroup.add(cabochon);
    }

    // --- E. Central Crown Solstice Turquoise Gem ---
    const crownGem = new THREE.Mesh(cabochonGeo, turquoiseMat);
    crownGem.position.set(0, 0.125, diskThick * 0.5 + 0.018);
    crownGem.scale.set(0.85, 1.15, 0.45);
    crownGem.castShadow = true;
    this.relicGroup.add(crownGem);

    // 3D Sculpted Nose & Brow Ridge for physical parallax relief
    const noseGeo = new THREE.ConeGeometry(0.026, 0.075, 4);
    noseGeo.rotateX(Math.PI / 2);
    const noseMesh = new THREE.Mesh(noseGeo, stoneEdgeMat);
    noseMesh.position.set(0, 0.01, diskThick * 0.5 + 0.018);
    this.relicGroup.add(noseMesh);
  }

  public canInteract(playerPos: THREE.Vector3): boolean {
    const worldAltarPos = new THREE.Vector3();
    this.altarMesh.getWorldPosition(worldAltarPos);
    return playerPos.distanceTo(worldAltarPos) < 2.5;
  }

  public toggleInspection(camera?: THREE.Camera) {
    this.isInspecting = !this.isInspecting;
    if (this.isInspecting) {
      this.relicGroup.position.set(0, 1.88, 0); // Elevated to float clearly above stand for 3D examination
      this.relicGroup.rotation.set(0, 0.22, 0);
      this.inspectKeyLight.intensity = 3.8;
      this.inspectFillLight.intensity = 1.2;
      this.inspectRimLight.intensity = 2.4;
      this.showInspectionUI();
    } else {
      this.relicGroup.position.set(0, 1.48, 0); // Restored to stand
      this.relicGroup.rotation.set(-0.15, 0, 0);
      this.inspectKeyLight.intensity = 0.0;
      this.inspectFillLight.intensity = 0.0;
      this.inspectRimLight.intensity = 0.0;
      this.hideInspectionUI();
    }
  }

  private showInspectionUI() {
    if (!this.uiContainer) {
      this.uiContainer = document.createElement('div');
      this.uiContainer.id = 'relic-inspect-hud';
      this.uiContainer.style.position = 'fixed';
      this.uiContainer.style.bottom = '28px';
      this.uiContainer.style.right = '32px';
      this.uiContainer.style.maxWidth = '420px';
      this.uiContainer.style.padding = '22px 26px';
      this.uiContainer.style.background = 'linear-gradient(135deg, rgba(18, 22, 19, 0.92) 0%, rgba(10, 14, 12, 0.96) 100%)';
      this.uiContainer.style.border = '1px solid rgba(212, 175, 88, 0.45)';
      this.uiContainer.style.borderRadius = '4px';
      this.uiContainer.style.boxShadow = '0 12px 36px rgba(0, 0, 0, 0.8), inset 0 0 16px rgba(212, 175, 88, 0.08)';
      this.uiContainer.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';
      this.uiContainer.style.color = '#e2dac6';
      this.uiContainer.style.zIndex = '9999';
      this.uiContainer.style.pointerEvents = 'none';

      this.uiContainer.innerHTML = `
        <div style="font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #d4af58; font-weight: 700; margin-bottom: 6px;">
          ★ ANCIENT INCA RELIC
        </div>
        <div style="font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px; margin-bottom: 2px;">
          ${this.data.name}
        </div>
        <div style="font-size: 13px; color: #a4b3a2; font-style: italic; margin-bottom: 12px;">
          ${this.data.subtitle}
        </div>
        <div style="font-size: 11px; color: #8e9c8c; margin-bottom: 4px;">
          <strong style="color: #c4d0c2;">Period:</strong> ${this.data.period}
        </div>
        <div style="font-size: 11px; color: #8e9c8c; margin-bottom: 12px;">
          <strong style="color: #c4d0c2;">Materials:</strong> ${this.data.material}
        </div>
        <div style="font-size: 12.5px; line-height: 1.55; color: #d8d2c2; margin-bottom: 16px; border-top: 1px solid rgba(212, 175, 88, 0.25); padding-top: 10px;">
          ${this.data.lore}
        </div>
        <div id="relic-secret-badge" style="background: rgba(212, 175, 88, 0.12); border-left: 3px solid #d4af58; padding: 8px 12px; margin-bottom: 12px; font-size: 11.5px; color: #ffd875; line-height: 1.45;">
          ${this.data.secretTitle}: ${this.data.secretLore}
        </div>
        <div style="font-size: 11px; color: #889486; letter-spacing: 1px; text-align: right; text-transform: uppercase;">
          [Drag to Rotate 3D] • [Press E to Stow]
        </div>
      `;
      document.body.appendChild(this.uiContainer);
    }
    this.uiContainer.style.display = 'block';
  }

  private hideInspectionUI() {
    if (this.uiContainer) {
      this.uiContainer.style.display = 'none';
    }
  }

  public update(dt: number, playerPos: THREE.Vector3) {
    // Animate golden dust motes in sunbeam
    const pos = this.dustMotes.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i + 1] -= dt * 0.12;
      if (pos[i + 1] < 1.0) pos[i + 1] = 4.2;
    }
    this.dustMotes.geometry.attributes.position.needsUpdate = true;

    if (!this.isInspecting) {
      // Resting on altar stand: gentle celestial hover & subtle shimmer
      this.relicGroup.position.y = 1.48 + Math.sin(performance.now() * 0.002) * 0.008;
      this.relicGroup.rotation.y += 0.12 * dt;
    } else {
      // Inspection mode rotation: showcase 3D craftsmanship and back calendar
      this.relicGroup.position.y = 1.88;
      this.relicGroup.rotation.y += 0.55 * dt;
      this.relicGroup.rotation.x = Math.sin(performance.now() * 0.0012) * 0.12 - 0.05;
    }
  }
}

export function createSacredRelicSystem(scene: THREE.Scene, altarPosition?: THREE.Vector3): SacredRelicSystem {
  return new SacredRelicSystem(scene, altarPosition);
}
