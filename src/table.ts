// Neon Pinball VR - Table Geometry
// Creates the 3D pinball table with neon holodeck aesthetic

import {
  Group, Mesh, BoxGeometry, CylinderGeometry, PlaneGeometry, SphereGeometry,
  RingGeometry, TorusGeometry, MeshStandardMaterial, MeshBasicMaterial,
  LineBasicMaterial, Color, Vector3, EdgesGeometry, LineSegments,
  AdditiveBlending, Float32BufferAttribute, BufferGeometry, DoubleSide,
} from '@iwsdk/core';
import { HALF_W, HALF_L, PLAYFIELD_WIDTH, PLAYFIELD_LENGTH, TILT_ANGLE } from './physics';

export const TABLE_Y = 0.85;
export const TABLE_TILT = TILT_ANGLE;
export const RAIL_HEIGHT = 0.03;

export function createTable(scene: any): Group {
  const table = new Group();
  table.position.set(0, TABLE_Y, 0);
  // Tilt so far end (-Z) is raised
  table.rotation.x = -TABLE_TILT;

  // === Playfield surface ===
  const playfieldGeo = new PlaneGeometry(PLAYFIELD_WIDTH + 0.02, PLAYFIELD_LENGTH + 0.02);
  const playfieldMat = new MeshStandardMaterial({
    color: new Color(0x050510),
    roughness: 0.8,
    metalness: 0.2,
  });
  const playfield = new Mesh(playfieldGeo, playfieldMat);
  playfield.rotation.x = -Math.PI / 2;
  playfield.position.y = 0;
  table.add(playfield);

  // === Grid pattern on playfield ===
  const gridGroup = new Group();
  const gridMat = new MeshBasicMaterial({
    color: new Color(0x0a1a2a),
    transparent: true,
    opacity: 0.3,
  });
  // Horizontal grid lines
  for (let i = -10; i <= 10; i++) {
    const z = (i / 10) * HALF_L;
    const lineGeo = new PlaneGeometry(PLAYFIELD_WIDTH, 0.001);
    const line = new Mesh(lineGeo, gridMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.001, z);
    gridGroup.add(line);
  }
  // Vertical grid lines
  for (let i = -5; i <= 5; i++) {
    const x = (i / 5) * HALF_W;
    const lineGeo = new PlaneGeometry(0.001, PLAYFIELD_LENGTH);
    const line = new Mesh(lineGeo, gridMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.001, 0);
    gridGroup.add(line);
  }
  table.add(gridGroup);

  // === Rails (walls) ===
  const railMat = new MeshStandardMaterial({
    color: new Color(0x00ffff),
    emissive: new Color(0x00aaaa),
    emissiveIntensity: 0.5,
    metalness: 0.8,
    roughness: 0.2,
  });

  // Left rail
  createRail(table, railMat, -HALF_W, 0, PLAYFIELD_LENGTH, true);
  // Right rail
  createRail(table, railMat, HALF_W, 0, PLAYFIELD_LENGTH, true);
  // Top rail
  createRail(table, railMat, -0.03, -HALF_L, PLAYFIELD_WIDTH * 0.87, false);

  // Plunger lane inner wall
  const plungerWallGeo = new BoxGeometry(0.004, RAIL_HEIGHT, 0.38);
  const plungerWall = new Mesh(plungerWallGeo, railMat);
  plungerWall.position.set(0.20, RAIL_HEIGHT / 2, -0.23);
  table.add(plungerWall);

  // Bottom guide walls (angled toward drain)
  createAngledRail(table, railMat, -HALF_W + 0.02, HALF_L - 0.01, -0.12, 0.45);
  createAngledRail(table, railMat, 0.12, 0.45, HALF_W - 0.06, HALF_L - 0.02);

  // === Drain indicators ===
  const drainGlowMat = new MeshBasicMaterial({
    color: new Color(0xff0044),
    transparent: true,
    opacity: 0.6,
  });
  const drainGeo = new PlaneGeometry(0.12, 0.02);
  const drainIndicator = new Mesh(drainGeo, drainGlowMat);
  drainIndicator.rotation.x = -Math.PI / 2;
  drainIndicator.position.set(0, 0.002, 0.48);
  table.add(drainIndicator);

  // === Table understructure ===
  const baseMat = new MeshStandardMaterial({
    color: new Color(0x0a0a1a),
    metalness: 0.6,
    roughness: 0.4,
  });
  const baseGeo = new BoxGeometry(PLAYFIELD_WIDTH + 0.04, 0.04, PLAYFIELD_LENGTH + 0.04);
  const base = new Mesh(baseGeo, baseMat);
  base.position.y = -0.025;
  table.add(base);

  // Edge glow (wireframe)
  const edgeGeo = new EdgesGeometry(baseGeo);
  const edgeMat = new LineBasicMaterial({ color: new Color(0x00ffff), transparent: true, opacity: 0.4 });
  const edgeLines = new LineSegments(edgeGeo, edgeMat);
  edgeLines.position.copy(base.position);
  table.add(edgeLines);

  // === Table legs (4 corner pillars) ===
  const legMat = new MeshStandardMaterial({
    color: new Color(0x1a1a3a),
    metalness: 0.5,
    roughness: 0.5,
  });
  const legGeo = new CylinderGeometry(0.015, 0.015, TABLE_Y - 0.05, 8);
  const legPositions = [
    [-HALF_W + 0.03, -HALF_L + 0.03],
    [HALF_W - 0.03, -HALF_L + 0.03],
    [-HALF_W + 0.03, HALF_L - 0.03],
    [HALF_W - 0.03, HALF_L - 0.03],
  ];
  for (const [lx, lz] of legPositions) {
    const leg = new Mesh(legGeo, legMat);
    leg.position.set(lx, -(TABLE_Y - 0.05) / 2 - 0.025, lz);
    table.add(leg);
    // Leg glow ring
    const ringGeo = new TorusGeometry(0.018, 0.003, 8, 16);
    const ringMat = new MeshBasicMaterial({ color: new Color(0x00ffff), transparent: true, opacity: 0.5 });
    const ring = new Mesh(ringGeo, ringMat);
    ring.position.set(lx, -0.03, lz);
    ring.rotation.x = Math.PI / 2;
    table.add(ring);
  }

  scene.add(table);
  return table;
}

function createRail(parent: Group, mat: MeshStandardMaterial, x: number, z: number, length: number, vertical: boolean): void {
  const geo = vertical
    ? new BoxGeometry(0.004, RAIL_HEIGHT, length)
    : new BoxGeometry(length, RAIL_HEIGHT, 0.004);
  const rail = new Mesh(geo, mat);
  if (vertical) {
    rail.position.set(x, RAIL_HEIGHT / 2, z);
  } else {
    rail.position.set(x, RAIL_HEIGHT / 2, z);
  }
  parent.add(rail);

  // Glow line
  const glowMat = new MeshBasicMaterial({
    color: new Color(0x00ffff),
    transparent: true,
    opacity: 0.8,
    blending: AdditiveBlending,
  });
  const glowGeo = vertical
    ? new BoxGeometry(0.008, 0.001, length)
    : new BoxGeometry(length, 0.001, 0.008);
  const glow = new Mesh(glowGeo, glowMat);
  glow.position.copy(rail.position);
  glow.position.y = RAIL_HEIGHT + 0.001;
  parent.add(glow);
}

function createAngledRail(parent: Group, mat: MeshStandardMaterial, x1: number, z1: number, x2: number, z2: number): void {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);

  const geo = new BoxGeometry(0.004, RAIL_HEIGHT, len);
  const rail = new Mesh(geo, mat);
  rail.position.set((x1 + x2) / 2, RAIL_HEIGHT / 2, (z1 + z2) / 2);
  rail.rotation.y = -angle;
  parent.add(rail);
}

export function createBumperMeshes(table: Group): Map<string, { mesh: Mesh; glow: Mesh }> {
  const meshes = new Map<string, { mesh: Mesh; glow: Mesh }>();

  const bumperData = [
    { id: 'pop-center', x: 0, z: -0.18, r: 0.028, color: 0xff00ff },
    { id: 'pop-left', x: -0.08, z: -0.28, r: 0.025, color: 0xff8800 },
    { id: 'pop-right', x: 0.08, z: -0.28, r: 0.025, color: 0x00ff88 },
    { id: 'sling-left', x: -0.17, z: 0.28, r: 0.035, color: 0xffff00 },
    { id: 'sling-right', x: 0.17, z: 0.28, r: 0.035, color: 0xffff00 },
  ];

  for (const bd of bumperData) {
    const isPop = bd.id.startsWith('pop');

    // Main bumper body
    const geo = new CylinderGeometry(bd.r, bd.r, 0.025, isPop ? 16 : 3, 1);
    const mat = new MeshStandardMaterial({
      color: new Color(bd.color),
      emissive: new Color(bd.color),
      emissiveIntensity: 0.4,
      metalness: 0.6,
      roughness: 0.3,
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(bd.x, 0.0125, bd.z);
    if (!isPop) mesh.rotation.y = Math.PI / 6;
    table.add(mesh);

    // Wireframe edge
    const edgeGeo = new EdgesGeometry(geo);
    const edgeMat = new LineBasicMaterial({ color: new Color(bd.color), transparent: true, opacity: 0.8 });
    const edge = new LineSegments(edgeGeo, edgeMat);
    edge.position.copy(mesh.position);
    if (!isPop) edge.rotation.y = Math.PI / 6;
    table.add(edge);

    // Glow ring
    const glowGeo = new RingGeometry(bd.r + 0.005, bd.r + 0.012, isPop ? 16 : 3);
    const glowMat = new MeshBasicMaterial({
      color: new Color(bd.color),
      transparent: true,
      opacity: 0.3,
      side: DoubleSide,
      blending: AdditiveBlending,
    });
    const glow = new Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(bd.x, 0.001, bd.z);
    if (!isPop) glow.rotation.z = Math.PI / 6;
    table.add(glow);

    meshes.set(bd.id, { mesh, glow });
  }

  return meshes;
}

export function createFlipperMeshes(table: Group): { left: Mesh; right: Mesh } {
  const flipperGeo = new BoxGeometry(0.075, 0.012, 0.016);
  const flipperMat = new MeshStandardMaterial({
    color: new Color(0x00ffff),
    emissive: new Color(0x00aaff),
    emissiveIntensity: 0.6,
    metalness: 0.8,
    roughness: 0.2,
  });

  // Left flipper
  const leftMesh = new Mesh(flipperGeo, flipperMat.clone());
  leftMesh.position.set(-0.08, 0.006, 0.42);
  // Pivot is at the left end — shift geometry so pivot is at local origin
  leftMesh.geometry.translate(0.0375, 0, 0);
  table.add(leftMesh);

  // Right flipper
  const rightMesh = new Mesh(flipperGeo.clone(), flipperMat.clone());
  rightMesh.position.set(0.08, 0.006, 0.42);
  rightMesh.geometry.translate(-0.0375, 0, 0);
  table.add(rightMesh);

  // Pivot caps
  const capGeo = new CylinderGeometry(0.008, 0.008, 0.014, 8);
  const capMat = new MeshBasicMaterial({ color: new Color(0x00ffff) });
  const leftCap = new Mesh(capGeo, capMat);
  leftCap.position.set(-0.08, 0.007, 0.42);
  table.add(leftCap);
  const rightCap = new Mesh(capGeo, capMat.clone());
  rightCap.position.set(0.08, 0.007, 0.42);
  table.add(rightCap);

  return { left: leftMesh, right: rightMesh };
}

export function createPlunger(table: Group): { plungerMesh: Mesh; springMesh: Mesh } {
  // Plunger rod
  const rodGeo = new CylinderGeometry(0.006, 0.006, 0.06, 8);
  const rodMat = new MeshStandardMaterial({
    color: new Color(0xff4400),
    emissive: new Color(0xff2200),
    emissiveIntensity: 0.5,
  });
  const plungerMesh = new Mesh(rodGeo, rodMat);
  plungerMesh.position.set(0.23, 0.015, 0.47);

  // Spring visual
  const springGeo = new CylinderGeometry(0.008, 0.008, 0.03, 8);
  const springMat = new MeshBasicMaterial({
    color: new Color(0xff6600),
    transparent: true,
    opacity: 0.6,
  });
  const springMesh = new Mesh(springGeo, springMat);
  springMesh.position.set(0.23, 0.015, 0.50);

  table.add(plungerMesh);
  table.add(springMesh);

  return { plungerMesh, springMesh };
}

export function createTargetBank(table: Group): Map<string, Mesh> {
  const targets = new Map<string, Mesh>();
  const targetPositions = [-0.16, -0.08, 0, 0.08, 0.16];
  const targetColors = [0xff0044, 0xff8800, 0xffff00, 0x00ff88, 0x0088ff];

  for (let i = 0; i < 5; i++) {
    const geo = new BoxGeometry(0.025, 0.02, 0.006);
    const mat = new MeshStandardMaterial({
      color: new Color(targetColors[i]),
      emissive: new Color(targetColors[i]),
      emissiveIntensity: 0.5,
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(targetPositions[i], 0.01, -0.45);
    table.add(mesh);

    const id = `target-${i}`;
    targets.set(id, mesh);
  }

  return targets;
}
