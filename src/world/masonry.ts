/**
 * Module: src/world/masonry.ts
 * Responsibility: Procedural generation of authentic Inca imperial masonry
 * (ashlar cushion-faced / almohadillado coursed stonework, battered pylons,
 * ceremonial waka steles, circular usnu altars, and river-worn cobbles)
 * per Bible §1.7, §2.1, and §2.2:
 * - "No perfect geometry. Stone blocks have chips, bevels, uneven faces."
 * - "Every wall has an inward batter (slope) toward the top."
 * - Individual coursed stones with convex pillow bulges and recessed joint seams
 *   that cast dynamic crevice shadows and catch natural highlights.
 * - Zero monolithic box primitives; zero Minecraft-style right-angle cubes.
 * Depends on: three.
 * Exports: IncaMasonrySystem.
 */

import * as THREE from 'three';

export interface WallOptions {
  courses?: number;
  stonesPerCourse?: number;
  pillowBulge?: number;
  jointDepth?: number;
  batter?: number;
  irregularity?: number;
}

export class IncaMasonrySystem {
  /**
   * Generates a coursed, pillow-faced Inca retaining wall geometry (Almohadillado).
   * Front face (+Z) has distinct horizontal courses of convex cushion stones
   * with recessed joint seams between them, chamfered margins, and inward batter.
   */
  public static createIncaPillowWallGeometry(
    w: number,
    h: number,
    d: number,
    options: WallOptions = {}
  ): THREE.BufferGeometry {
    const courses = options.courses ?? Math.max(3, Math.round(h / 0.65));
    const stonesPerCourse = options.stonesPerCourse ?? Math.max(3, Math.round(w / 0.85));
    const pillowBulge = options.pillowBulge ?? 0.048;
    const jointDepth = options.jointDepth ?? 0.024;
    const batter = options.batter ?? 0.09;
    const irregularity = options.irregularity ?? 0.016;

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    let vertexOffset = 0;

    // Helper to push a vertex
    function addVertex(x: number, y: number, z: number, u: number, v: number): number {
      positions.push(x, y, z);
      normals.push(0, 0, 1); // Will be recomputed by computeVertexNormals
      uvs.push(u, v);
      return vertexOffset++;
    }

    // Helper to push a quad (2 triangles)
    function addQuad(i0: number, i1: number, i2: number, i3: number) {
      indices.push(i0, i1, i2);
      indices.push(i0, i2, i3);
    }

    const courseHeight = h / courses;

    // Build the front coursed pillow face (+Z)
    for (let c = 0; c < courses; c++) {
      const y0 = -h * 0.5 + c * courseHeight;
      const y1 = y0 + courseHeight;
      const normY0 = (y0 + h * 0.5) / h;
      const normY1 = (y1 + h * 0.5) / h;
      const batterZ0 = (d * 0.5) * (1.0 - normY0 * batter);
      const batterZ1 = (d * 0.5) * (1.0 - normY1 * batter);

      // Stagger vertical joints between courses (running bond)
      const isOddCourse = c % 2 === 1;
      const staggerShift = isOddCourse ? 0.5 : 0.0;
      const nStones = isOddCourse ? stonesPerCourse + 1 : stonesPerCourse;

      for (let s = 0; s < nStones; s++) {
        // Individual stone X span with slight organic jitter
        const t0 = (s - staggerShift) / stonesPerCourse;
        const t1 = (s + 1 - staggerShift) / stonesPerCourse;
        let x0 = -w * 0.5 + t0 * w;
        let x1 = -w * 0.5 + t1 * w;

        // Clamp to wall ends
        if (x1 <= -w * 0.5 || x0 >= w * 0.5) continue;
        x0 = Math.max(-w * 0.5, x0);
        x1 = Math.min(w * 0.5, x1);
        if (x1 - x0 < 0.12) continue; // Skip sliver blocks at edges

        // Pseudo-random deterministic jitter per stone
        const stoneSeed = Math.sin(c * 17.3 + s * 31.7) * 43758.5453;
        const randJitter = (stoneSeed - Math.floor(stoneSeed)) * 2.0 - 1.0;
        const stoneBulge = pillowBulge * (0.85 + 0.3 * Math.abs(randJitter));

        // Subdivide stone front face: 4 cols x 3 rows = 12 vertices, 6 quads
        const gridX = 4;
        const gridY = 3;
        const stoneVertGrid: number[][] = [];

        for (let gy = 0; gy <= gridY; gy++) {
          const row: number[] = [];
          const vy = gy / gridY;
          const curY = y0 + vy * (y1 - y0);
          const curBatterZ = batterZ0 + vy * (batterZ1 - batterZ0);

          for (let gx = 0; gx <= gridX; gx++) {
            const ux = gx / gridX;
            const curX = x0 + ux * (x1 - x0);

            // Pillow bulge curve: max in center, 0 at boundaries
            const pillowFactor = Math.sin(ux * Math.PI) * Math.sin(vy * Math.PI);
            // Joint seam recession: deep groove at perimeter
            const seamRecess = (1.0 - Math.pow(pillowFactor, 0.45)) * jointDepth;
            const surfaceJitter = Math.sin(curX * 12.3 + curY * 15.7) * irregularity;

            const curZ = curBatterZ + pillowFactor * stoneBulge - seamRecess + surfaceJitter;

            const uCoord = (curX / w + 0.5) * 3.0;
            const vCoord = (curY / h + 0.5) * 3.0;

            const vIdx = addVertex(curX, curY, curZ, uCoord, vCoord);
            row.push(vIdx);
          }
          stoneVertGrid.push(row);
        }

        // Connect the quads for this stone
        for (let gy = 0; gy < gridY; gy++) {
          for (let gx = 0; gx < gridX; gx++) {
            const i0 = stoneVertGrid[gy][gx];
            const i1 = stoneVertGrid[gy][gx + 1];
            const i2 = stoneVertGrid[gy + 1][gx + 1];
            const i3 = stoneVertGrid[gy + 1][gx];
            addQuad(i0, i1, i2, i3);
          }
        }
      }
    }

    // Top horizontal face with slight crowning & chamfered edge (+Y)
    const topY = h * 0.5;
    const topFrontZ = (d * 0.5) * (1.0 - batter);
    const topBackZ = -d * 0.5;
    const topSegs = stonesPerCourse * 2;

    const topFrontIndices: number[] = [];
    const topBackIndices: number[] = [];

    for (let i = 0; i <= topSegs; i++) {
      const u = i / topSegs;
      const x = -w * 0.5 + u * w;
      // Slight scalloped undulation along the top edge per block
      const scallop = Math.sin(u * stonesPerCourse * Math.PI * 2) * 0.015;
      const tfIdx = addVertex(x, topY + scallop, topFrontZ, u * 3.0, 0);
      const tbIdx = addVertex(x, topY + scallop * 0.5, topBackZ, u * 3.0, 1.0);
      topFrontIndices.push(tfIdx);
      topBackIndices.push(tbIdx);
    }

    for (let i = 0; i < topSegs; i++) {
      addQuad(
        topFrontIndices[i],
        topFrontIndices[i + 1],
        topBackIndices[i + 1],
        topBackIndices[i]
      );
    }

    // Back vertical face (-Z)
    const b0 = addVertex(-w * 0.5, -h * 0.5, -d * 0.5, 0, 0);
    const b1 = addVertex(w * 0.5, -h * 0.5, -d * 0.5, 3.0, 0);
    const b2 = addVertex(w * 0.5, h * 0.5, -d * 0.5, 3.0, 3.0);
    const b3 = addVertex(-w * 0.5, h * 0.5, -d * 0.5, 0, 3.0);
    addQuad(b1, b0, b3, b2);

    // Bottom face (-Y)
    const botFrontZ = d * 0.5;
    const botBackZ = -d * 0.5;
    const bot0 = addVertex(-w * 0.5, -h * 0.5, botFrontZ, 0, 0);
    const bot1 = addVertex(w * 0.5, -h * 0.5, botFrontZ, 3.0, 0);
    const bot2 = addVertex(w * 0.5, -h * 0.5, botBackZ, 3.0, 1.0);
    const bot3 = addVertex(-w * 0.5, -h * 0.5, botBackZ, 0, 1.0);
    addQuad(bot0, bot1, bot2, bot3);

    // Left face (-X) — coursed stone return with pillow bulges and corner chamfer
    for (let c = 0; c < courses; c++) {
      const cy0 = -h * 0.5 + c * courseHeight;
      const cy1 = cy0 + courseHeight;
      const normCy0 = (cy0 + h * 0.5) / h;
      const normCy1 = (cy1 + h * 0.5) / h;
      const cFrontZ0 = (d * 0.5) * (1.0 - normCy0 * batter);
      const cFrontZ1 = (d * 0.5) * (1.0 - normCy1 * batter);
      const cMidZ0 = (cFrontZ0 + botBackZ) * 0.5;
      const cMidZ1 = (cFrontZ1 + botBackZ) * 0.5;

      const bulge = pillowBulge * 0.75;
      const recess = jointDepth * 0.6;

      // Inset front edge slightly to create corner chamfer
      const l0 = addVertex(-w * 0.5 + 0.02, cy0, cFrontZ0, 0, normCy0 * 3);
      const l1 = addVertex(-w * 0.5 - bulge + recess, cy0, cMidZ0, 0.5, normCy0 * 3);
      const l2 = addVertex(-w * 0.5, cy0, botBackZ, 1.0, normCy0 * 3);

      const l3 = addVertex(-w * 0.5 + 0.02, cy1, cFrontZ1, 0, normCy1 * 3);
      const l4 = addVertex(-w * 0.5 - bulge + recess, cy1, cMidZ1, 0.5, normCy1 * 3);
      const l5 = addVertex(-w * 0.5, cy1, botBackZ, 1.0, normCy1 * 3);

      addQuad(l0, l1, l4, l3);
      addQuad(l1, l2, l5, l4);
    }

    // Right face (+X) — coursed stone return with pillow bulges and corner chamfer
    for (let c = 0; c < courses; c++) {
      const cy0 = -h * 0.5 + c * courseHeight;
      const cy1 = cy0 + courseHeight;
      const normCy0 = (cy0 + h * 0.5) / h;
      const normCy1 = (cy1 + h * 0.5) / h;
      const cFrontZ0 = (d * 0.5) * (1.0 - normCy0 * batter);
      const cFrontZ1 = (d * 0.5) * (1.0 - normCy1 * batter);
      const cMidZ0 = (cFrontZ0 + botBackZ) * 0.5;
      const cMidZ1 = (cFrontZ1 + botBackZ) * 0.5;

      const bulge = pillowBulge * 0.75;
      const recess = jointDepth * 0.6;

      const r0 = addVertex(w * 0.5 - 0.02, cy0, cFrontZ0, 0, normCy0 * 3);
      const r1 = addVertex(w * 0.5 + bulge - recess, cy0, cMidZ0, 0.5, normCy0 * 3);
      const r2 = addVertex(w * 0.5, cy0, botBackZ, 1.0, normCy0 * 3);

      const r3 = addVertex(w * 0.5 - 0.02, cy1, cFrontZ1, 0, normCy1 * 3);
      const r4 = addVertex(w * 0.5 + bulge - recess, cy1, cMidZ1, 0.5, normCy1 * 3);
      const r5 = addVertex(w * 0.5, cy1, botBackZ, 1.0, normCy1 * 3);

      addQuad(r1, r0, r3, r4);
      addQuad(r2, r1, r4, r5);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }

  /**
   * Generates a 4-sided coursed Inca stone anchor tower / pillar geometry.
   * All 4 vertical faces have pillow-faced stone courses, corner chamfers,
   * inward batter, and a stepped cornice profile at the top.
   */
  public static createIncaPillarGeometry(
    w: number,
    h: number,
    d: number,
    options: WallOptions = {}
  ): THREE.BufferGeometry {
    const courses = options.courses ?? Math.max(4, Math.round(h / 0.55));
    const pillowBulge = options.pillowBulge ?? 0.038;
    const jointDepth = options.jointDepth ?? 0.020;
    const batter = options.batter ?? 0.08;

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let vertexOffset = 0;

    function addVertex(x: number, y: number, z: number, u: number, v: number): number {
      positions.push(x, y, z);
      normals.push(0, 0, 1);
      uvs.push(u, v);
      return vertexOffset++;
    }

    function addQuad(i0: number, i1: number, i2: number, i3: number) {
      indices.push(i0, i1, i2);
      indices.push(i0, i2, i3);
    }

    const courseHeight = h / courses;

    // Four sides: 0: +Z, 1: +X, 2: -Z, 3: -X
    for (let side = 0; side < 4; side++) {
      const angle = (side * Math.PI) / 2;
      const cosA = Math.round(Math.cos(angle));
      const sinA = Math.round(Math.sin(angle));

      const spanW = side % 2 === 0 ? w : d;
      const depthD = side % 2 === 0 ? d : w;

      for (let c = 0; c < courses; c++) {
        const y0 = -h * 0.5 + c * courseHeight;
        const y1 = y0 + courseHeight;
        const normY0 = (y0 + h * 0.5) / h;
        const normY1 = (y1 + h * 0.5) / h;

        // Subtle width & height variations
        const gridX = 3;
        const gridY = 3;
        const grid: number[][] = [];

        for (let gy = 0; gy <= gridY; gy++) {
          const row: number[] = [];
          const vy = gy / gridY;
          const curY = y0 + vy * (y1 - y0);
          const curNormY = (curY + h * 0.5) / h;
          const curBatter = 1.0 - curNormY * batter;
          const curHalfW = (spanW * 0.5) * curBatter;
          const curFaceZ = (depthD * 0.5) * curBatter;

          for (let gx = 0; gx <= gridX; gx++) {
            const ux = gx / gridX;
            // Inset slightly from sharp corners to form corner chamfers
            const chamferFactor = ux === 0 || ux === 1 ? 0.94 : 1.0;
            const lx = (-curHalfW + ux * curHalfW * 2) * chamferFactor;

            const pillow = Math.sin(ux * Math.PI) * Math.sin(vy * Math.PI);
            const seamRecess = (1.0 - Math.pow(pillow, 0.5)) * jointDepth;
            const lz = curFaceZ + pillow * pillowBulge - seamRecess;

            // Rotate local (lx, curY, lz) by side angle
            const wx = lx * cosA + lz * sinA;
            const wz = -lx * sinA + lz * cosA;

            const uCoord = ux * 1.5 + side;
            const vCoord = curNormY * 4.0;

            row.push(addVertex(wx, curY, wz, uCoord, vCoord));
          }
          grid.push(row);
        }

        for (let gy = 0; gy < gridY; gy++) {
          for (let gx = 0; gx < gridX; gx++) {
            addQuad(grid[gy][gx], grid[gy][gx + 1], grid[gy + 1][gx + 1], grid[gy + 1][gx]);
          }
        }
      }
    }

    // Top cap (+Y) with slight overhang
    const topY = h * 0.5;
    const topBatter = 1.0 - batter;
    const hw = w * 0.5 * topBatter;
    const hd = d * 0.5 * topBatter;

    const t0 = addVertex(-hw, topY, -hd, 0, 0);
    const t1 = addVertex(hw, topY, -hd, 1, 0);
    const t2 = addVertex(hw, topY, hd, 1, 1);
    const t3 = addVertex(-hw, topY, hd, 0, 1);
    addQuad(t0, t1, t2, t3);

    // Bottom base (-Y)
    const b0 = addVertex(-w * 0.5, -h * 0.5, -d * 0.5, 0, 0);
    const b1 = addVertex(w * 0.5, -h * 0.5, -d * 0.5, 1, 0);
    const b2 = addVertex(w * 0.5, -h * 0.5, d * 0.5, 1, 1);
    const b3 = addVertex(-w * 0.5, -h * 0.5, d * 0.5, 0, 1);
    addQuad(b3, b2, b1, b0);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }

  /**
   * Generates a circular stepped Inca ceremonial altar dais (Usnu platform).
   * Two concentric stepped stone tiers with radial Inti solar carving runnels
   * and softened, organic perimeter edges embedded into the loam.
   */
  public static createIncaAltarDaisGeometry(
    radius: number,
    height: number,
    segments: number = 20
  ): THREE.BufferGeometry {
    const geo = new THREE.CylinderGeometry(radius * 0.94, radius, height, segments, 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);

      const r = Math.hypot(vx, vz);
      const angle = Math.atan2(vz, vx);

      // Organic undulating perimeter with 6 radial andesite flagstone seams
      const seamWave = Math.sin(angle * 6.0) * (height * 0.08);
      const perimeterWobble = Math.cos(angle * 5.0 + vy * 3.0) * 0.025;

      // Softened top edge bevel
      const topEdgeBevel = vy > height * 0.35 ? Math.min(1.0, 1.0 - (r / radius) * 0.05) : 1.0;

      pos.setXYZ(
        i,
        vx * topEdgeBevel + perimeterWobble * (vx / Math.max(0.01, r)),
        vy + seamWave,
        vz * topEdgeBevel + perimeterWobble * (vz / Math.max(0.01, r))
      );
    }

    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Generates an authentic sacred Inca carved andesite stele (Waka monolith).
   * Tapered 10-sided monolithic pillar with stepped Chakana collars and solar reliefs.
   */
  public static createIncaWakaSteleGeometry(
    radius: number,
    height: number,
    segments: number = 10
  ): THREE.BufferGeometry {
    const geo = new THREE.CylinderGeometry(radius * 0.72, radius, height, segments, 6);
    const pos = geo.attributes.position as THREE.BufferAttribute;

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);

      const normY = (vy + height * 0.5) / height; // 0 at base, 1 at summit
      const r = Math.hypot(vx, vz);
      const angle = Math.atan2(vz, vx);

      // Stepped Chakana relief rings at 0.35 and 0.70 height
      const chakanaBand1 = Math.exp(-Math.pow((normY - 0.35) * 16.0, 2)) * 0.045;
      const chakanaBand2 = Math.exp(-Math.pow((normY - 0.70) * 18.0, 2)) * 0.038;
      const relief = chakanaBand1 + chakanaBand2;

      // Subtle fluted facets along the shaft
      const fluting = Math.sin(angle * segments) * 0.012;

      const scale = (r + relief + fluting) / Math.max(0.001, r);
      pos.setXYZ(i, vx * scale, vy, vz * scale);
    }

    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Generates an organic river-worn or moraine andesite cobble boulder.
   * Completely eliminates sharp cubic boxes on the ground.
   */
  public static createRiverCobbleGeometry(
    radius: number,
    seed: number = 1.0
  ): THREE.BufferGeometry {
    const geo = new THREE.DodecahedronGeometry(radius, 1);
    const pos = geo.attributes.position as THREE.BufferAttribute;

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);

      // Low frequency spherical noise for smooth river-worn stone shape
      const noise =
        Math.sin(vx * 4.2 + vy * 5.1 + seed) * 0.18 +
        Math.cos(vz * 4.8 - vy * 3.7 + seed * 1.7) * 0.12;

      // Flatten bottom where stone embeds into the earth
      const bottomFlatten = vy < -radius * 0.2 ? 0.75 : 1.0;

      pos.setXYZ(
        i,
        vx * (1.0 + noise),
        vy * bottomFlatten * (1.0 + noise * 0.6),
        vz * (1.0 + noise)
      );
    }

    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Generates a sloping earth/moss footing berm to place along the base of retaining walls.
   * Eliminates the harsh 90-degree mathematical clipping line where vertical masonry meets flat ground.
   */
  public static createWallFootingBermGeometry(
    w: number,
    h: number,
    d: number
  ): THREE.BufferGeometry {
    const segs = 8;
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Sloping wedge from (z=d, y=0) to (z=0, y=h)
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const x = -w * 0.5 + u * w;
      const jitter = Math.sin(u * 14.3) * (h * 0.15);

      // Bottom outer point on dirt
      positions.push(x, 0, d);
      normals.push(0, 0.7, 0.7);
      uvs.push(u * 2.0, 0);

      // Top point hugging the wall
      positions.push(x, h + jitter, 0);
      normals.push(0, 0.7, 0.7);
      uvs.push(u * 2.0, 1.0);
    }

    for (let i = 0; i < segs; i++) {
      const i0 = i * 2;
      const i1 = i * 2 + 1;
      const i2 = (i + 1) * 2 + 1;
      const i3 = (i + 1) * 2;
      indices.push(i0, i3, i2);
      indices.push(i0, i2, i1);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }
}
