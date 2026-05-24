// Neon Pinball VR - Table Geometry
// Round 2: Spinners, ramps, outlanes, lane arrows, backbox

import {
  Group, Mesh, BoxGeometry, CylinderGeometry, PlaneGeometry, SphereGeometry,
  RingGeometry, TorusGeometry, MeshStandardMaterial, MeshBasicMaterial,
  LineBasicMaterial, Color, Vector3, EdgesGeometry, LineSegments,
  AdditiveBlending, Float32BufferAttribute, BufferGeometry, DoubleSide,
  ConeGeometry,
} from '@iwsdk/core';
import { HALF_W, HALF_L, PLAYFIELD_WIDTH, PLAYFIELD_LENGTH, TILT_ANGLE } from './physics';

export const TABLE_Y = 0.85;
export const TABLE_TILT = TILT_ANGLE;
export const RAIL_HEIGHT = 0.03;

export function createTable(scene: any): Group {
  const table = new Group();
  table.position.set(0, TABLE_Y, 0);
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

  // === Grid pattern ===
  const gridGroup = new Group();
  const gridMat = new MeshBasicMaterial({
    color: new Color(0x0a1a2a),
    transparent: true,
    opacity: 0.3,
  });
  for (let i = -10; i <= 10; i++) {
    const z = (i / 10) * HALF_L;
    const lineGeo = new PlaneGeometry(PLAYFIELD_WIDTH, 0.001);
    const line = new Mesh(lineGeo, gridMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.001, z);
    gridGroup.add(line);
  }
  for (let i = -5; i <= 5; i++) {
    const x = (i / 5) * HALF_W;
    const lineGeo = new PlaneGeometry(0.001, PLAYFIELD_LENGTH);
    const line = new Mesh(lineGeo, gridMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.001, 0);
    gridGroup.add(line);
  }
  table.add(gridGroup);

  // === Rails ===
  const railMat = new MeshStandardMaterial({
    color: new Color(0x00ffff),
    emissive: new Color(0x00aaaa),
    emissiveIntensity: 0.5,
    metalness: 0.8,
    roughness: 0.2,
  });

  createRail(table, railMat, -HALF_W, 0, PLAYFIELD_LENGTH, true);
  createRail(table, railMat, HALF_W, 0, PLAYFIELD_LENGTH, true);
  createRail(table, railMat, -0.03, -HALF_L, PLAYFIELD_WIDTH * 0.87, false);

  // Plunger lane inner wall
  const plungerWallGeo = new BoxGeometry(0.004, RAIL_HEIGHT, 0.38);
  const plungerWall = new Mesh(plungerWallGeo, railMat);
  plungerWall.position.set(0.20, RAIL_HEIGHT / 2, -0.23);
  table.add(plungerWall);

  // Bottom guide walls
  createAngledRail(table, railMat, -HALF_W + 0.02, HALF_L - 0.01, -0.14, 0.45);
  createAngledRail(table, railMat, 0.14, 0.45, HALF_W - 0.05, HALF_L - 0.02);

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

  // === Table base ===
  const baseMat = new MeshStandardMaterial({
    color: new Color(0x0a0a1a),
    metalness: 0.6,
    roughness: 0.4,
  });
  const baseGeo = new BoxGeometry(PLAYFIELD_WIDTH + 0.04, 0.04, PLAYFIELD_LENGTH + 0.04);
  const base = new Mesh(baseGeo, baseMat);
  base.position.y = -0.025;
  table.add(base);

  const edgeGeo = new EdgesGeometry(baseGeo);
  const edgeMat = new LineBasicMaterial({ color: new Color(0x00ffff), transparent: true, opacity: 0.4 });
  const edgeLines = new LineSegments(edgeGeo, edgeMat);
  edgeLines.position.copy(base.position);
  table.add(edgeLines);

  // === Table legs ===
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
    const ringGeo = new TorusGeometry(0.018, 0.003, 8, 16);
    const ringMat = new MeshBasicMaterial({ color: new Color(0x00ffff), transparent: true, opacity: 0.5 });
    const ring = new Mesh(ringGeo, ringMat);
    ring.position.set(lx, -0.03, lz);
    ring.rotation.x = Math.PI / 2;
    table.add(ring);
  }

  // === Lane arrows ===
  createLaneArrows(table);

  // === Backbox (sign above table) ===
  createBackbox(table);

  scene.add(table);
  return table;
}

function createLaneArrows(table: Group): void {
  // Arrow-shaped lane indicators pointing upward
  const arrowMat = new MeshBasicMaterial({
    color: new Color(0x00ffff),
    transparent: true,
    opacity: 0.4,
  });

  // Left lane arrows
  const arrowPositions = [
    { x: -0.125, z: 0.18, color: 0xff00ff },
    { x: -0.125, z: 0.12, color: 0xff00ff },
    { x: -0.125, z: 0.06, color: 0xff00ff },
    // Right lane arrows
    { x: 0.125, z: 0.18, color: 0x00ff88 },
    { x: 0.125, z: 0.12, color: 0x00ff88 },
    { x: 0.125, z: 0.06, color: 0x00ff88 },
    // Center lane arrows
    { x: 0, z: 0.15, color: 0xffff00 },
    { x: 0, z: 0.08, color: 0xffff00 },
  ];

  for (const ap of arrowPositions) {
    const coneGeo = new ConeGeometry(0.008, 0.018, 3);
    const coneMat = new MeshBasicMaterial({
      color: new Color(ap.color),
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending,
    });
    const cone = new Mesh(coneGeo, coneMat);
    cone.rotation.x = -Math.PI / 2;
    cone.rotation.z = Math.PI;
    cone.position.set(ap.x, 0.002, ap.z);
    table.add(cone);
  }
}

function createBackbox(table: Group): void {
  // Backbox frame behind the top of the table
  const backboxGeo = new BoxGeometry(PLAYFIELD_WIDTH + 0.02, 0.25, 0.02);
  const backboxMat = new MeshStandardMaterial({
    color: new Color(0x0a0a1a),
    metalness: 0.6,
    roughness: 0.4,
  });
  const backbox = new Mesh(backboxGeo, backboxMat);
  backbox.position.set(0, 0.155, -HALF_L - 0.015);
  table.add(backbox);

  // Backbox edge glow
  const bbEdgeGeo = new EdgesGeometry(backboxGeo);
  const bbEdgeMat = new LineBasicMaterial({
    color: new Color(0xff00ff),
    transparent: true,
    opacity: 0.6,
  });
  const bbEdgeLines = new LineSegments(bbEdgeGeo, bbEdgeMat);
  bbEdgeLines.position.copy(backbox.position);
  table.add(bbEdgeLines);

  // Center decorative emblem on backbox
  const emblemGeo = new TorusGeometry(0.04, 0.006, 8, 16);
  const emblemMat = new MeshBasicMaterial({
    color: new Color(0xff00ff),
    transparent: true,
    opacity: 0.8,
    blending: AdditiveBlending,
  });
  const emblem = new Mesh(emblemGeo, emblemMat);
  emblem.position.set(0, 0.16, -HALF_L - 0.006);
  table.add(emblem);

  // Inner emblem diamond
  const diamondGeo = new BoxGeometry(0.025, 0.025, 0.003);
  const diamondMat = new MeshBasicMaterial({
    color: new Color(0x00ffff),
    transparent: true,
    opacity: 0.7,
    blending: AdditiveBlending,
  });
  const diamond = new Mesh(diamondGeo, diamondMat);
  diamond.rotation.z = Math.PI / 4;
  diamond.position.set(0, 0.16, -HALF_L - 0.005);
  table.add(diamond);
}

function createRail(parent: Group, mat: MeshStandardMaterial, x: number, z: number, length: number, vertical: boolean): void {
  const geo = vertical
    ? new BoxGeometry(0.004, RAIL_HEIGHT, length)
    : new BoxGeometry(length, RAIL_HEIGHT, 0.004);
  const rail = new Mesh(geo, mat);
  rail.position.set(x, RAIL_HEIGHT / 2, z);
  parent.add(rail);

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

    const edgeGeo2 = new EdgesGeometry(geo);
    const edgeMat2 = new LineBasicMaterial({ color: new Color(bd.color), transparent: true, opacity: 0.8 });
    const edge = new LineSegments(edgeGeo2, edgeMat2);
    edge.position.copy(mesh.position);
    if (!isPop) edge.rotation.y = Math.PI / 6;
    table.add(edge);

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

export function createSpinnerMeshes(table: Group): Map<string, { gate: Mesh; post: Mesh }> {
  const meshes = new Map<string, { gate: Mesh; post: Mesh }>();

  const spinnerData = [
    { id: 'spinner-center', x: 0, z: -0.06, color: 0xffff00 },
    { id: 'spinner-left', x: -0.21, z: -0.12, color: 0xff8800 },
  ];

  for (const sd of spinnerData) {
    // Post (axis of rotation)
    const postGeo = new CylinderGeometry(0.003, 0.003, 0.025, 6);
    const postMat = new MeshStandardMaterial({
      color: new Color(sd.color),
      emissive: new Color(sd.color),
      emissiveIntensity: 0.3,
    });
    const post = new Mesh(postGeo, postMat);
    post.position.set(sd.x, 0.0125, sd.z);
    table.add(post);

    // Spinning gate (flat plane that rotates)
    const gateGeo = new BoxGeometry(0.04, 0.02, 0.003);
    const gateMat = new MeshStandardMaterial({
      color: new Color(sd.color),
      emissive: new Color(sd.color),
      emissiveIntensity: 0.6,
      metalness: 0.8,
      roughness: 0.2,
      transparent: true,
      opacity: 0.9,
    });
    const gate = new Mesh(gateGeo, gateMat);
    gate.position.set(sd.x, 0.015, sd.z);
    table.add(gate);

    meshes.set(sd.id, { gate, post });
  }

  return meshes;
}

export function createRampMeshes(table: Group): Map<string, Group> {
  const meshes = new Map<string, Group>();

  const rampData = [
    { id: 'ramp-left', entryX: -0.125, entryZ: 0.05, exitX: -0.20, exitZ: -0.38, color: 0xff00ff },
    { id: 'ramp-right', entryX: 0.125, entryZ: 0.05, exitX: 0.20, exitZ: -0.38, color: 0x00ff88 },
  ];

  for (const rd of rampData) {
    const rampGroup = new Group();

    // Ramp entry (glowing arch)
    const archGeo = new TorusGeometry(0.02, 0.003, 6, 8, Math.PI);
    const archMat = new MeshBasicMaterial({
      color: new Color(rd.color),
      transparent: true,
      opacity: 0.8,
      blending: AdditiveBlending,
    });
    const arch = new Mesh(archGeo, archMat);
    arch.position.set(rd.entryX, 0.03, rd.entryZ);
    arch.rotation.x = Math.PI / 2;
    rampGroup.add(arch);

    // Ramp rails (elevated guide lines from entry to exit)
    const dx = rd.exitX - rd.entryX;
    const dz = rd.exitZ - rd.entryZ;
    const len = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dx, dz);

    const railGeo = new BoxGeometry(0.003, 0.008, len);
    const railMat = new MeshBasicMaterial({
      color: new Color(rd.color),
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending,
    });

    // Left rail
    const leftRail = new Mesh(railGeo, railMat);
    leftRail.position.set(
      (rd.entryX + rd.exitX) / 2 - 0.015,
      0.035,
      (rd.entryZ + rd.exitZ) / 2,
    );
    leftRail.rotation.y = -angle;
    rampGroup.add(leftRail);

    // Right rail
    const rightRail = new Mesh(railGeo, railMat.clone());
    rightRail.position.set(
      (rd.entryX + rd.exitX) / 2 + 0.015,
      0.035,
      (rd.entryZ + rd.exitZ) / 2,
    );
    rightRail.rotation.y = -angle;
    rampGroup.add(rightRail);

    // Exit point glow
    const exitGlowGeo = new RingGeometry(0.01, 0.018, 8);
    const exitGlowMat = new MeshBasicMaterial({
      color: new Color(rd.color),
      transparent: true,
      opacity: 0.4,
      side: DoubleSide,
      blending: AdditiveBlending,
    });
    const exitGlow = new Mesh(exitGlowGeo, exitGlowMat);
    exitGlow.rotation.x = -Math.PI / 2;
    exitGlow.position.set(rd.exitX, 0.002, rd.exitZ);
    rampGroup.add(exitGlow);

    table.add(rampGroup);
    meshes.set(rd.id, rampGroup);
  }

  return meshes;
}

export function createOutlaneMeshes(table: Group): Map<string, { indicator: Mesh; glow: Mesh }> {
  const meshes = new Map<string, { indicator: Mesh; glow: Mesh }>();

  const outlaneData = [
    { id: 'outlane-left', x: -0.235, z: 0.46, color: 0xff4400 },
    { id: 'outlane-right', x: 0.235, z: 0.46, color: 0xff4400 },
  ];

  for (const od of outlaneData) {
    // Kickback indicator
    const indGeo = new PlaneGeometry(0.02, 0.04);
    const indMat = new MeshBasicMaterial({
      color: new Color(0x00ff88),
      transparent: true,
      opacity: 0.7,
      side: DoubleSide,
    });
    const indicator = new Mesh(indGeo, indMat);
    indicator.rotation.x = -Math.PI / 2;
    indicator.position.set(od.x, 0.002, od.z);
    table.add(indicator);

    // Danger glow
    const glowGeo = new PlaneGeometry(0.035, 0.05);
    const glowMat = new MeshBasicMaterial({
      color: new Color(od.color),
      transparent: true,
      opacity: 0.3,
      side: DoubleSide,
      blending: AdditiveBlending,
    });
    const glow = new Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(od.x, 0.001, od.z);
    table.add(glow);

    meshes.set(od.id, { indicator, glow });
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

  const leftMesh = new Mesh(flipperGeo, flipperMat.clone());
  leftMesh.position.set(-0.08, 0.006, 0.42);
  leftMesh.geometry.translate(0.0375, 0, 0);
  table.add(leftMesh);

  const rightMesh = new Mesh(flipperGeo.clone(), flipperMat.clone());
  rightMesh.position.set(0.08, 0.006, 0.42);
  rightMesh.geometry.translate(-0.0375, 0, 0);
  table.add(rightMesh);

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
  const rodGeo = new CylinderGeometry(0.006, 0.006, 0.06, 8);
  const rodMat = new MeshStandardMaterial({
    color: new Color(0xff4400),
    emissive: new Color(0xff2200),
    emissiveIntensity: 0.5,
  });
  const plungerMesh = new Mesh(rodGeo, rodMat);
  plungerMesh.position.set(0.23, 0.015, 0.47);

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
    targets.set(`target-${i}`, mesh);
  }

  return targets;
}

export function createCaptiveBallMesh(table: Group): Map<string, { ball: Mesh; cradle: Mesh }> {
  const meshes = new Map<string, { ball: Mesh; cradle: Mesh }>();

  // Captive ball at upper-right
  const BALL_RAD = 0.013;

  // Cradle/channel for the captive ball
  const cradleGeo = new BoxGeometry(0.04, 0.008, 0.06);
  const cradleMat = new MeshStandardMaterial({
    color: new Color(0x222244),
    emissive: new Color(0x4400ff),
    emissiveIntensity: 0.2,
    metalness: 0.7,
    roughness: 0.3,
  });
  const cradle = new Mesh(cradleGeo, cradleMat);
  cradle.position.set(0.14, 0.002, -0.38);
  table.add(cradle);

  // The captive ball itself (looks like a silver ball)
  const ballGeo = new SphereGeometry(BALL_RAD, 12, 8);
  const ballMat = new MeshStandardMaterial({
    color: new Color(0xaaaacc),
    emissive: new Color(0x4400ff),
    emissiveIntensity: 0.5,
    metalness: 0.95,
    roughness: 0.05,
  });
  const ball = new Mesh(ballGeo, ballMat);
  ball.position.set(0.14, BALL_RAD + 0.003, -0.38);
  table.add(ball);

  // Side walls for the cradle
  const wallGeo = new BoxGeometry(0.004, 0.015, 0.06);
  const wallMat = new MeshStandardMaterial({
    color: new Color(0x6600ff),
    emissive: new Color(0x4400ff),
    emissiveIntensity: 0.3,
  });
  const leftWall = new Mesh(wallGeo, wallMat);
  leftWall.position.set(0.14 - 0.022, 0.008, -0.38);
  table.add(leftWall);

  const rightWall = new Mesh(wallGeo.clone(), wallMat.clone());
  rightWall.position.set(0.14 + 0.022, 0.008, -0.38);
  table.add(rightWall);

  // Label
  const labelGeo = new PlaneGeometry(0.035, 0.008);
  const labelMat = new MeshBasicMaterial({
    color: new Color(0x4400ff),
    transparent: true,
    opacity: 0.6,
    side: DoubleSide,
  });
  const label = new Mesh(labelGeo, labelMat);
  label.rotation.x = -Math.PI / 2;
  label.position.set(0.14, 0.003, -0.42);
  table.add(label);

  meshes.set('captive-1', { ball, cradle });
  return meshes;
}

// Skill shot zone visual indicator on plunger lane
export function createSkillShotIndicator(table: Group): { zones: Mesh[] } {
  const zones: Mesh[] = [];
  const zoneColors = [0x00ff88, 0xffff00, 0xff00ff, 0xffff00, 0x00ff88];
  const zoneWidths = [0.03, 0.03, 0.02, 0.03, 0.03];
  const zoneStartZ = -0.35;  // Where zones start on the plunger lane wall
  const zoneSpacing = 0.04;

  for (let i = 0; i < 5; i++) {
    const geo = new PlaneGeometry(0.006, zoneWidths[i]);
    const mat = new MeshBasicMaterial({
      color: new Color(zoneColors[i]),
      transparent: true,
      opacity: 0.5,
      side: DoubleSide,
      blending: AdditiveBlending,
    });
    const mesh = new Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0.20, 0.003, zoneStartZ + i * zoneSpacing);
    table.add(mesh);
    zones.push(mesh);
  }

  return { zones };
}

export function createVUKMesh(table: Group): Map<string, { scoop: Mesh; glow: Mesh }> {
  const meshes = new Map<string, { scoop: Mesh; glow: Mesh }>();

  // VUK scoop on left side
  const scoopGeo = new CylinderGeometry(0.018, 0.022, 0.015, 8);
  const scoopMat = new MeshStandardMaterial({
    color: new Color(0x222244),
    emissive: new Color(0xff8800),
    emissiveIntensity: 0.3,
    metalness: 0.8,
    roughness: 0.2,
  });
  const scoop = new Mesh(scoopGeo, scoopMat);
  scoop.position.set(-0.18, 0.008, 0.05);
  table.add(scoop);

  // Glowing rim
  const glowGeo = new RingGeometry(0.019, 0.025, 12);
  const glowMat = new MeshBasicMaterial({
    color: new Color(0xff8800),
    transparent: true,
    opacity: 0.5,
    side: DoubleSide,
    blending: AdditiveBlending,
  });
  const glow = new Mesh(glowGeo, glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(-0.18, 0.016, 0.05);
  table.add(glow);

  meshes.set('vuk-left', { scoop, glow });
  return meshes;
}
