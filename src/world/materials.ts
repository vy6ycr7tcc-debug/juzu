/**
 * Module: src/world/materials.ts
 * Responsibility: Complete PBR Material Library per Bible §2.2 using real
 * photographic albedo, normal, and roughness maps from `public/assets/`
 * (zero procedural noise DataTextures).
 * Depends on: three.
 * Exports: PbrMaterialLibrary.
 */

import * as THREE from 'three';
import { applyNanoHexagonRelief, applyFoliageSubsurfaceShader } from '../rendering/nanoHex';

export class PbrMaterialLibrary {
  public andesiteCut!: THREE.MeshStandardMaterial;
  public fieldstoneRough!: THREE.MeshStandardMaterial;
  public moss!: THREE.MeshStandardMaterial;
  public woodAged!: THREE.MeshStandardMaterial;
  public woodBark!: THREE.MeshStandardMaterial;
  public clothOlive!: THREE.MeshStandardMaterial;
  public clothTrousers!: THREE.MeshStandardMaterial;
  public clothQuechuaRed!: THREE.MeshStandardMaterial;
  public leather!: THREE.MeshStandardMaterial;
  public metalBronze!: THREE.MeshStandardMaterial;
  public metalIron!: THREE.MeshStandardMaterial;
  public skin!: THREE.MeshStandardMaterial;
  public hair!: THREE.MeshStandardMaterial;
  public water!: THREE.MeshStandardMaterial;
  public foliageLeaf!: THREE.MeshStandardMaterial;
  public foliageFern!: THREE.MeshStandardMaterial;
  public goldOrnamental!: THREE.MeshStandardMaterial;
  public groundForestFloor!: THREE.MeshStandardMaterial;
  public highSierraSnow!: THREE.MeshStandardMaterial;
  public highSierraPuna!: THREE.MeshStandardMaterial;
  public ropeBraided!: THREE.MeshStandardMaterial;

  private readonly textures: THREE.Texture[] = [];
  private readonly materials: THREE.Material[] = [];

  public build(): void {
    const loader = new THREE.TextureLoader();

    // Photographic Environment Textures
    const stoneworkAlbedo = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/environment-textures/environment-stonework.jpeg',
      2.5,
      2.5,
      true
    );
    const stoneworkNormal = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/environment-textures/environment-stonework-normal.jpg',
      2.5,
      2.5,
      false
    );
    const stoneworkRoughness = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/environment-textures/environment-stonework-roughness.jpg',
      2.5,
      2.5,
      false
    );

    const fieldstoneAlbedo = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/environment-textures/environment-stonework.jpeg',
      1.8,
      1.8,
      true
    );

    const planksAlbedo = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/environment-textures/environment-planks.jpeg',
      2.0,
      2.0,
      true
    );
    const planksNormal = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/environment-textures/environment-planks-normal.jpg',
      2.0,
      2.0,
      false
    );
    const planksRoughness = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/environment-textures/environment-planks-roughness.jpg',
      2.0,
      2.0,
      false
    );

    const barkAlbedo = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/environment-textures/environment-bark.jpeg',
      2.0,
      4.0,
      true
    );
    const barkNormal = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/environment-textures/environment-bark-normal.jpg',
      2.0,
      4.0,
      false
    );
    const barkRoughness = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/environment-textures/environment-bark-roughness.jpg',
      2.0,
      4.0,
      false
    );

    const forestFloorAlbedo = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/environment-textures/environment-forest-floor.jpeg',
      64.0,
      64.0,
      true
    );
    const forestFloorNormal = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/environment-textures/environment-forest-floor-normal.jpg',
      64.0,
      64.0,
      false
    );
    const forestFloorRoughness = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/environment-textures/environment-forest-floor-roughness.jpg',
      64.0,
      64.0,
      false
    );

    const mossAlbedo = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/environment-textures/environment-forest-floor.jpeg',
      3.5,
      3.5,
      true
    );

    const foliageCanopyAlbedo = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/environment-textures/environment-foliage.jpeg',
      3.0,
      3.0,
      true
    );
    const foliageFernAlbedo = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/environment-textures/environment-foliage.jpeg',
      1.5,
      1.5,
      true
    );
    const foliageNormal = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/environment-textures/environment-foliage-normal.jpg',
      2.5,
      2.5,
      false
    );

    const snowRockAlbedo = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/environment-textures/environment-snow-rock.jpg',
      10.0,
      10.0,
      true
    );
    const punaGrassAlbedo = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/environment-textures/environment-snow-rock.jpg',
      44.0,
      44.0,
      true
    );
    const punaGrassNormal = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/environment-textures/environment-stonework-normal.jpg',
      44.0,
      44.0,
      false
    );
    const punaGrassRoughness = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/environment-textures/environment-stonework-roughness.jpg',
      44.0,
      44.0,
      false
    );

    // Photographic Character & Material Textures
    const fabricAlbedo = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/character-textures/character-fabric.jpeg',
      3.0,
      3.0,
      true
    );
    const canvasAlbedo = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/character-textures/character-canvas.jpeg',
      3.0,
      3.0,
      true
    );
    const leatherAlbedo = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/character-textures/character-leather.jpeg',
      2.0,
      2.0,
      true
    );
    const skinAlbedo = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/character-textures/character-skin.jpeg',
      1.0,
      1.0,
      true
    );
    const quechuaWeaveAlbedo = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/character-textures/character-quechua-weave.jpg',
      1.0,
      2.0,
      true
    );

    // 1. Inca andesite stone (cut) — §2.2
    this.andesiteCut = new THREE.MeshStandardMaterial({
      name: 'IncaAndesiteCut',
      color: new THREE.Color(0xfff6ec),
      map: stoneworkAlbedo,
      normalMap: stoneworkNormal,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughnessMap: stoneworkRoughness,
      roughness: 0.82,
      metalness: 0.0,
    });

    // 2. Fieldstone / rough rock — §2.2
    this.fieldstoneRough = new THREE.MeshStandardMaterial({
      name: 'FieldstoneRough',
      color: new THREE.Color(0xded8cc),
      map: fieldstoneAlbedo,
      normalMap: stoneworkNormal,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughnessMap: stoneworkRoughness,
      roughness: 0.88,
      metalness: 0.0,
    });

    // 3. Moss — §2.2
    this.moss = new THREE.MeshStandardMaterial({
      name: 'CloudForestMoss',
      color: new THREE.Color(0x98bf6a),
      map: mossAlbedo,
      normalMap: forestFloorNormal,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness: 0.95,
      metalness: 0.0,
    });

    // 4. Wood (aged planks) — §2.2
    this.woodAged = new THREE.MeshStandardMaterial({
      name: 'WoodAged',
      color: new THREE.Color(0xdfd2c4),
      map: planksAlbedo,
      normalMap: planksNormal,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughnessMap: planksRoughness,
      roughness: 0.82,
      metalness: 0.0,
    });

    // 4b. Tree Bark (cloud forest trunks)
    this.woodBark = new THREE.MeshStandardMaterial({
      name: 'WoodBark',
      color: new THREE.Color(0xd2c4b4),
      map: barkAlbedo,
      normalMap: barkNormal,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughnessMap: barkRoughness,
      roughness: 0.89,
      metalness: 0.0,
    });

    // 5. Cloth (faded olive field shirt & dark brown canvas trousers) — §2.2
    this.clothOlive = new THREE.MeshStandardMaterial({
      name: 'ClothFadedOlive',
      color: new THREE.Color(0x6e7e5c),
      map: fabricAlbedo,
      roughness: 0.9,
      metalness: 0.0,
    });

    this.clothTrousers = new THREE.MeshStandardMaterial({
      name: 'ClothDarkBrownCanvas',
      color: new THREE.Color(0x644c38),
      map: canvasAlbedo,
      roughness: 0.91,
      metalness: 0.0,
    });

    this.clothQuechuaRed = new THREE.MeshStandardMaterial({
      name: 'ClothQuechuaWeave',
      color: new THREE.Color(0xffffff),
      map: quechuaWeaveAlbedo,
      normalMap: stoneworkNormal,
      normalScale: new THREE.Vector2(0.25, 0.25),
      roughness: 0.88,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    // 6. Leather — §2.2
    this.leather = new THREE.MeshStandardMaterial({
      name: 'LeatherWeathered',
      color: new THREE.Color(0x785238),
      map: leatherAlbedo,
      roughness: 0.65,
      metalness: 0.0,
    });

    // 7. Metal (bronze, iron) — §2.2
    this.metalBronze = new THREE.MeshStandardMaterial({
      name: 'MetalWeatheredBronze',
      color: new THREE.Color(0xb28e54),
      normalMap: stoneworkNormal,
      normalScale: new THREE.Vector2(0.28, 0.28),
      roughnessMap: stoneworkRoughness,
      roughness: 0.34,
      metalness: 0.9,
      envMapIntensity: 1.35,
    });

    this.metalIron = new THREE.MeshStandardMaterial({
      name: 'MetalWeatheredIron',
      color: new THREE.Color(0x585e66),
      normalMap: stoneworkNormal,
      normalScale: new THREE.Vector2(0.32, 0.32),
      roughnessMap: stoneworkRoughness,
      roughness: 0.50,
      metalness: 0.86,
      envMapIntensity: 1.15,
    });

    // 8. Skin — §2.2
    this.skin = new THREE.MeshStandardMaterial({
      name: 'NairaSkinPBR',
      color: new THREE.Color(0xb87e58),
      map: skinAlbedo,
      roughness: 0.56,
      metalness: 0.0,
      envMapIntensity: 0.85,
    });

    // 9. Hair — §2.2
    this.hair = new THREE.MeshStandardMaterial({
      name: 'NairaHairBraid',
      color: new THREE.Color(0x241a15),
      map: barkAlbedo,
      normalMap: planksNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.42,
      metalness: 0.0,
      envMapIntensity: 0.95,
    });

    // 10. Water — §2.2
    const waterNormal = this.loadRepeatingTexture(
      loader,
      '/juzu/assets/environment-textures/environment-forest-floor-normal.jpg',
      12.0,
      12.0,
      false
    );
    this.water = new THREE.MeshStandardMaterial({
      name: 'AndeanRiverWater',
      color: new THREE.Color(0x286e66),
      normalMap: waterNormal,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughness: 0.05,
      metalness: 0.06,
      envMapIntensity: 1.38,
      transparent: true,
      opacity: 0.9,
    });

    // 11. Foliage (volumetric cloud-forest tree crowns & 3D fern rosettes) — §2.2
    const leafAlphaTex = this.createFoliageLeafAlphaTexture();
    const fernAlphaTex = this.createFoliageFernAlphaTexture();

    this.foliageLeaf = new THREE.MeshStandardMaterial({
      name: 'CloudForestCanopyLeaf',
      color: new THREE.Color(0x98c64e),
      emissive: new THREE.Color(0x162408),
      map: foliageCanopyAlbedo,
      alphaMap: leafAlphaTex,
      alphaTest: 0.35,
      transparent: false,
      depthWrite: true,
      normalMap: foliageNormal,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughness: 0.76,
      metalness: 0.0,
      envMapIntensity: 0.28,
      side: THREE.DoubleSide,
      shadowSide: THREE.DoubleSide,
    });

    this.foliageFern = new THREE.MeshStandardMaterial({
      name: 'CloudForestFernFrond',
      color: new THREE.Color(0xa2ce56),
      emissive: new THREE.Color(0x142206),
      map: foliageFernAlbedo,
      alphaMap: fernAlphaTex,
      alphaTest: 0.35,
      transparent: false,
      depthWrite: true,
      normalMap: foliageNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.74,
      metalness: 0.0,
      envMapIntensity: 0.28,
      side: THREE.DoubleSide,
      shadowSide: THREE.DoubleSide,
    });

    // Apply warm chlorophyll subsurface scattering transmission to canopy & fern foliage
    applyFoliageSubsurfaceShader(this.foliageLeaf);
    applyFoliageSubsurfaceShader(this.foliageFern);

    // 12. Gold (ornamental) — §2.2
    this.goldOrnamental = new THREE.MeshStandardMaterial({
      name: 'IncaOrnamentalGold',
      color: new THREE.Color(0xe6b852),
      normalMap: stoneworkNormal,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughnessMap: stoneworkRoughness,
      roughness: 0.24,
      metalness: 0.94,
      envMapIntensity: 1.48,
    });

    // 13. Cloud Forest Floor terrain material
    this.groundForestFloor = new THREE.MeshStandardMaterial({
      name: 'CloudForestGroundPBR',
      color: new THREE.Color(0xdce6ce),
      map: forestFloorAlbedo,
      normalMap: forestFloorNormal,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughnessMap: forestFloorRoughness,
      roughness: 0.86,
      metalness: 0.0,
      envMapIntensity: 0.65,
      vertexColors: true,
    });

    // 14. High Sierra Snowline & Glacial Peak material (§1.7 Region 2)
    this.highSierraSnow = new THREE.MeshStandardMaterial({
      name: 'HighSierraSnowRockPBR',
      color: new THREE.Color(0xf4f8ff),
      map: snowRockAlbedo,
      normalMap: stoneworkNormal,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughness: 0.62,
      metalness: 0.0,
      envMapIntensity: 0.95,
    });

    // 15. High Sierra Puna Steppe & Agricultural Terrace Soil material (§1.7 Region 2)
    this.highSierraPuna = new THREE.MeshStandardMaterial({
      name: 'HighSierraPunaSteppePBR',
      color: new THREE.Color(0xffffff),
      map: punaGrassAlbedo,
      normalMap: punaGrassNormal,
      normalScale: new THREE.Vector2(1.25, 1.25),
      roughnessMap: punaGrassRoughness,
      roughness: 0.88,
      metalness: 0.0,
      envMapIntensity: 0.65,
      vertexColors: true,
    });

    // 16. Braided Andean Ichu Grass Rope (Q'eswachaka style) — §2.2
    this.ropeBraided = new THREE.MeshStandardMaterial({
      name: 'RopeBraidedIchu',
      color: new THREE.Color(0x3e3224),
      map: canvasAlbedo,
      normalMap: barkNormal,
      normalScale: new THREE.Vector2(1.8, 1.8),
      roughness: 0.96,
      metalness: 0.0,
    });

    // Apply nano-hexagonal stochastic micro-relief, non-repeating hex-tiling, and triplanar slope cliff-rock blending
    applyNanoHexagonRelief(this.andesiteCut, {
      scale: 68.0,
      reliefStrength: 0.34,
      grooveDepth: 0.22,
      hexTiling: false, // preserve coursed masonry direction while adding hand-pecked mineral relief
    });

    applyNanoHexagonRelief(this.fieldstoneRough, {
      scale: 54.0,
      reliefStrength: 0.42,
      grooveDepth: 0.28,
      hexTiling: true, // break repeating square patterns on rough rock and boulders
    });

    applyNanoHexagonRelief(this.groundForestFloor, {
      scale: 56.0,
      reliefStrength: 0.38,
      grooveDepth: 0.24,
      hexTiling: true, // break square grid repetition on valley terrain
      slopeRockMap: stoneworkAlbedo,
      slopeRockNormalMap: stoneworkNormal,
      slopeThreshold: 0.84,
    });

    applyNanoHexagonRelief(this.highSierraPuna, {
      scale: 58.0,
      reliefStrength: 0.40,
      grooveDepth: 0.26,
      hexTiling: true, // break repetition across puna steppe
      slopeRockMap: stoneworkAlbedo,
      slopeRockNormalMap: stoneworkNormal,
      slopeThreshold: 0.84,
    });

    // Micro-fibrous relief for braided Andean ichu grass ropes (Q'eswachaka)
    applyNanoHexagonRelief(this.ropeBraided, {
      scale: 86.0,
      reliefStrength: 0.35,
      grooveDepth: 0.28,
      hexTiling: false,
    });

    // Crystalline rime & firn ice granular micro-relief on snow peaks
    applyNanoHexagonRelief(this.highSierraSnow, {
      scale: 58.0,
      reliefStrength: 0.32,
      grooveDepth: 0.20,
      hexTiling: true,
    });

    // Tactile hand-hammered gold leaf relief on Inca ornamental treasures
    applyNanoHexagonRelief(this.goldOrnamental, {
      scale: 64.0,
      reliefStrength: 0.22,
      grooveDepth: 0.15,
      roughnessVariation: 0.12,
      hexTiling: false,
    });

    // Tactile loom-woven thread micro-relief on Quechua poncho cloth
    applyNanoHexagonRelief(this.clothQuechuaRed, {
      scale: 96.0,
      reliefStrength: 0.24,
      grooveDepth: 0.16,
      hexTiling: false,
    });

    this.materials.push(
      this.andesiteCut,
      this.fieldstoneRough,
      this.moss,
      this.woodAged,
      this.woodBark,
      this.clothOlive,
      this.clothTrousers,
      this.clothQuechuaRed,
      this.leather,
      this.metalBronze,
      this.metalIron,
      this.skin,
      this.hair,
      this.water,
      this.foliageLeaf,
      this.foliageFern,
      this.goldOrnamental,
      this.groundForestFloor,
      this.highSierraSnow,
      this.highSierraPuna,
      this.ropeBraided
    );
  }

  private loadRepeatingTexture(
    loader: THREE.TextureLoader,
    url: string,
    repeatX: number,
    repeatY: number,
    isSRGB: boolean
  ): THREE.Texture {
    const tex = loader.load(url, loaded => {
      loaded.needsUpdate = true;
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.colorSpace = isSRGB ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.generateMipmaps = true;
    this.textures.push(tex);
    return tex;
  }

  private createFoliageLeafAlphaTexture(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const fallback = new THREE.CanvasTexture(canvas);
      this.textures.push(fallback);
      return fallback;
    }

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);

    const drawLeaf = (cx: number, cy: number, length: number, width: number, angle: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-width * 0.5, length * 0.25, -width * 0.6, length * 0.65, 0, length);
      ctx.bezierCurveTo(width * 0.6, length * 0.65, width * 0.5, length * 0.25, 0, 0);
      ctx.fill();
      ctx.restore();
    };

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(size * 0.5, size * 0.95);
    ctx.bezierCurveTo(size * 0.5, size * 0.6, size * 0.48, size * 0.35, size * 0.5, size * 0.1);
    ctx.stroke();

    const leafConfigs = [
      { x: 0.50, y: 0.12, len: 90, w: 38, ang: 0 },
      { x: 0.48, y: 0.18, len: 80, w: 36, ang: -0.35 },
      { x: 0.52, y: 0.18, len: 80, w: 36, ang: 0.35 },
      { x: 0.44, y: 0.30, len: 95, w: 42, ang: -0.7 },
      { x: 0.56, y: 0.30, len: 95, w: 42, ang: 0.7 },
      { x: 0.40, y: 0.25, len: 75, w: 34, ang: -1.0 },
      { x: 0.60, y: 0.25, len: 75, w: 34, ang: 1.0 },
      { x: 0.35, y: 0.45, len: 110, w: 48, ang: -1.2 },
      { x: 0.65, y: 0.45, len: 110, w: 48, ang: 1.2 },
      { x: 0.46, y: 0.42, len: 90, w: 40, ang: -0.4 },
      { x: 0.54, y: 0.42, len: 90, w: 40, ang: 0.4 },
      { x: 0.28, y: 0.40, len: 85, w: 38, ang: -1.45 },
      { x: 0.72, y: 0.40, len: 85, w: 38, ang: 1.45 },
      { x: 0.38, y: 0.62, len: 105, w: 46, ang: -1.3 },
      { x: 0.62, y: 0.62, len: 105, w: 46, ang: 1.3 },
      { x: 0.25, y: 0.58, len: 90, w: 40, ang: -1.6 },
      { x: 0.75, y: 0.58, len: 90, w: 40, ang: 1.6 },
      { x: 0.48, y: 0.58, len: 85, w: 38, ang: -0.2 },
      { x: 0.52, y: 0.58, len: 85, w: 38, ang: 0.2 },
      { x: 0.32, y: 0.78, len: 95, w: 42, ang: -1.5 },
      { x: 0.68, y: 0.78, len: 95, w: 42, ang: 1.5 },
      { x: 0.42, y: 0.75, len: 80, w: 36, ang: -0.8 },
      { x: 0.58, y: 0.75, len: 80, w: 36, ang: 0.8 },
    ];

    for (let i = 0; i < leafConfigs.length; i++) {
      const cfg = leafConfigs[i];
      drawLeaf(cfg.x * size, cfg.y * size, cfg.len, cfg.w, cfg.ang);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = true;
    this.textures.push(tex);
    return tex;
  }

  private createFoliageFernAlphaTexture(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const fallback = new THREE.CanvasTexture(canvas);
      this.textures.push(fallback);
      return fallback;
    }

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(size * 0.5, size * 0.98);
    ctx.quadraticCurveTo(size * 0.51, size * 0.45, size * 0.49, size * 0.04);
    ctx.stroke();

    const pinnaeCount = 24;
    for (let p = 0; p < pinnaeCount; p++) {
      const t = p / pinnaeCount;
      const y = size * (0.92 - t * 0.86);
      const curveX = size * (0.5 + Math.sin(t * Math.PI) * 0.01);
      const maxW = 180 * Math.sin(t * Math.PI * 0.85 + 0.15);
      const pinnaLen = Math.max(16, maxW);
      const pWidth = Math.max(6, 14 * (1.0 - t * 0.5));

      ctx.save();
      ctx.translate(curveX, y);
      ctx.rotate(-Math.PI * 0.5 + 0.25 - t * 0.4);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-pWidth * 0.5, pinnaLen * 0.3, -pWidth * 0.4, pinnaLen * 0.7, 0, pinnaLen);
      ctx.bezierCurveTo(pWidth * 0.4, pinnaLen * 0.7, pWidth * 0.5, pinnaLen * 0.3, 0, 0);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(curveX, y);
      ctx.rotate(Math.PI * 0.5 - 0.25 + t * 0.4);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-pWidth * 0.5, pinnaLen * 0.3, -pWidth * 0.4, pinnaLen * 0.7, 0, pinnaLen);
      ctx.bezierCurveTo(pWidth * 0.4, pinnaLen * 0.7, pWidth * 0.5, pinnaLen * 0.3, 0, 0);
      ctx.fill();
      ctx.restore();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = true;
    this.textures.push(tex);
    return tex;
  }

  public dispose(): void {
    for (let i = 0; i < this.textures.length; i++) {
      this.textures[i].dispose();
    }
    for (let i = 0; i < this.materials.length; i++) {
      this.materials[i].dispose();
    }
    this.textures.length = 0;
    this.materials.length = 0;
  }
}
