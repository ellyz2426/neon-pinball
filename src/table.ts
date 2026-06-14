// Neon Pinball VR - Table Geometry
// Round 8: Lane completion indicators, ball lock lights, improved backbox

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


// Lane completion indicators -- 3 glowing bars in the lane area
export function createLaneIndicators(table: Group): Mesh[] {
  const indicators: Mesh[] = [];
  const laneData = [
    { x: -0.125, z: 0.22, color: 0xff00ff },
    { x: 0, z: 0.20, color: 0xffff00 },
    { x: 0.125, z: 0.22, color: 0x00ff88 },
  ];

  for (const ld of laneData) {
    const geo = new PlaneGeometry(0.04, 0.008);
    const mat = new MeshBasicMaterial({
      color: new Color(ld.color),
      transparent: true,
      opacity: 0.15,
      side: DoubleSide,
      blending: AdditiveBlending,
    });
    const mesh = new Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(ld.x, 0.003, ld.z);
    table.add(mesh);
    indicators.push(mesh);
  }

  return indicators;
}

// Ball lock indicators -- 3 glowing dots near the target bank
export function createBallLockIndicators(table: Group): Mesh[] {
  const indicators: Mesh[] = [];

  for (let i = 0; i < 3; i++) {
    const x = -0.06 + i * 0.06;
    const geo = new SphereGeometry(0.008, 8, 6);
    const mat = new MeshBasicMaterial({
      color: new Color(0x444466),
      transparent: true,
      opacity: 0.1,
      blending: AdditiveBlending,
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(x, 0.015, -0.50);
    table.add(mesh);
    indicators.push(mesh);

    // Base ring around each indicator
    const ringGeo = new RingGeometry(0.009, 0.012, 8);
    const ringMat = new MeshBasicMaterial({
      color: new Color(0x222244),
      transparent: true,
      opacity: 0.3,
      side: DoubleSide,
    });
    const ring = new Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.002, -0.50);
    table.add(ring);
  }

  return indicators;
}

// Backglass score area -- a glowing panel on the backbox
export function createBackglassScore(table: Group): Mesh {
  const geo = new PlaneGeometry(0.18, 0.06);
  const mat = new MeshBasicMaterial({
    color: new Color(0x00ffff),
    transparent: true,
    opacity: 0.3,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  const mesh = new Mesh(geo, mat);
  mesh.position.set(0, 0.20, -HALF_L - 0.005);
  table.add(mesh);

  // Border frame around score area
  const frameGeo = new EdgesGeometry(new BoxGeometry(0.19, 0.065, 0.001));
  const frameMat = new LineBasicMaterial({
    color: new Color(0x00ffff),
    transparent: true,
    opacity: 0.5,
  });
  const frame = new LineSegments(frameGeo, frameMat);
  frame.position.set(0, 0.20, -HALF_L - 0.005);
  table.add(frame);

  // Decorative dots flanking the score area
  const dotGeo = new SphereGeometry(0.005, 6, 4);
  const dotColors = [0xff00ff, 0x00ffff, 0xffff00, 0x00ff88];
  for (let i = 0; i < 4; i++) {
    const side = i < 2 ? -1 : 1;
    const row = i % 2;
    const dotMat = new MeshBasicMaterial({
      color: new Color(dotColors[i]),
      transparent: true,
      opacity: 0.6,
      blending: AdditiveBlending,
    });
    const dot = new Mesh(dotGeo, dotMat);
    dot.position.set(side * 0.11, 0.18 + row * 0.04, -HALF_L - 0.004);
    table.add(dot);
  }

  return mesh;
}


// Animated neon rings on table legs -- returns references for game loop animation
export function createLegNeonRings(table: Group): Mesh[] {
  const rings: Mesh[] = [];
  const legPositions = [
    [-HALF_W + 0.03, -HALF_L + 0.03],
    [HALF_W - 0.03, -HALF_L + 0.03],
    [-HALF_W + 0.03, HALF_L - 0.03],
    [HALF_W - 0.03, HALF_L - 0.03],
  ];

  for (const [lx, lz] of legPositions) {
    // Lower ring -- animated
    const ringGeo = new TorusGeometry(0.022, 0.004, 8, 16);
    const ringMat = new MeshBasicMaterial({
      color: new Color(0x00ffff),
      transparent: true,
      opacity: 0.6,
      blending: AdditiveBlending,
    });
    const ring = new Mesh(ringGeo, ringMat);
    ring.position.set(lx, -0.15, lz);
    ring.rotation.x = Math.PI / 2;
    table.add(ring);
    rings.push(ring);
  }

  return rings;
}


// Ball saver indicator -- glowing bar above the drain area
export function createBallSaverBar(table: Group): Mesh {
  const geo = new BoxGeometry(0.20, 0.003, 0.008);
  const mat = new MeshBasicMaterial({
    color: new Color(0x00ff88),
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
  });
  const mesh = new Mesh(geo, mat);
  // Position just above the drain, between flippers
  mesh.position.set(0, 0.005, HALF_L - 0.06);
  table.add(mesh);
  return mesh;
}


// Ramp entry glow indicators -- animated glow arches at ramp entrances
export function createRampEntryGlows(table: Group): Mesh[] {
  const glows: Mesh[] = [];
  const rampEntries = [
    { x: -0.125, z: 0.05, color: 0xff00ff },  // left ramp
    { x: 0.125, z: 0.05, color: 0x00ff88 },   // right ramp
  ];

  for (const re of rampEntries) {
    // Glowing floor indicator beneath the ramp entry
    const geo = new PlaneGeometry(0.05, 0.03);
    const mat = new MeshBasicMaterial({
      color: new Color(re.color),
      transparent: true,
      opacity: 0.3,
      side: DoubleSide,
      blending: AdditiveBlending,
    });
    const mesh = new Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(re.x, 0.002, re.z);
    table.add(mesh);
    glows.push(mesh);
  }

  return glows;
}

// Orbit progress checkpoint indicators -- 3 markers showing orbit shot progress
export function createOrbitCheckpoints(table: Group): Mesh[] {
  const checkpoints: Mesh[] = [];
  // Orbit path: left ramp exit -> upper lane -> right ramp exit
  const cpData = [
    { x: -0.20, z: -0.38, color: 0xff00ff },   // checkpoint 1 (left ramp exit area)
    { x: 0, z: -0.06, color: 0xffff00 },        // checkpoint 2 (spinner/upper lane area)
    { x: 0.20, z: -0.38, color: 0x00ff88 },     // checkpoint 3 (right ramp exit area)
  ];

  for (const cp of cpData) {
    const geo = new RingGeometry(0.008, 0.014, 8);
    const mat = new MeshBasicMaterial({
      color: new Color(cp.color),
      transparent: true,
      opacity: 0.1,
      side: DoubleSide,
      blending: AdditiveBlending,
    });
    const mesh = new Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cp.x, 0.003, cp.z);
    table.add(mesh);
    checkpoints.push(mesh);
  }

  return checkpoints;
}

// Mission progress bar -- visual bar showing current mission completion
export function createMissionProgressBar(table: Group): Mesh {
  const geo = new BoxGeometry(0.16, 0.003, 0.006);
  const mat = new MeshBasicMaterial({
    color: new Color(0xff00ff),
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
  });
  const mesh = new Mesh(geo, mat);
  // Position below the target bank
  mesh.position.set(0, 0.004, -0.42);
  table.add(mesh);
  return mesh;
}

// Plunger lane lights — animated sequence of small lights in the shooter lane
export function createPlungerLaneLights(table: Group): Mesh[] {
  const lights: Mesh[] = [];
  const count = 8;
  for (let i = 0; i < count; i++) {
    const geo = new SphereGeometry(0.004, 6, 4);
    const mat = new MeshBasicMaterial({
      color: new Color(0x00ffff),
      transparent: true,
      opacity: 0.3,
      blending: AdditiveBlending,
    });
    const mesh = new Mesh(geo, mat);
    // Spread from bottom to top of plunger lane
    const t = i / (count - 1);
    mesh.position.set(0.23, 0.003, 0.4 - t * 0.7);
    table.add(mesh);
    lights.push(mesh);
  }
  return lights;
}

// Table edge accent strips — thin neon glow along the table perimeter
export function createTableEdgeAccents(table: Group): Mesh[] {
  const accents: Mesh[] = [];
  const accentMat = new MeshBasicMaterial({
    color: new Color(0x00ffff),
    transparent: true,
    opacity: 0.15,
    blending: AdditiveBlending,
  });

  // Left edge
  const leftGeo = new BoxGeometry(0.003, 0.001, PLAYFIELD_LENGTH - 0.02);
  const leftAccent = new Mesh(leftGeo, accentMat.clone());
  leftAccent.position.set(-HALF_W - 0.018, 0.001, 0);
  table.add(leftAccent);
  accents.push(leftAccent);

  // Right edge
  const rightGeo = new BoxGeometry(0.003, 0.001, PLAYFIELD_LENGTH - 0.02);
  const rightAccent = new Mesh(rightGeo, accentMat.clone());
  rightAccent.position.set(HALF_W + 0.018, 0.001, 0);
  table.add(rightAccent);
  accents.push(rightAccent);

  // Bottom edge
  const bottomGeo = new BoxGeometry(PLAYFIELD_WIDTH - 0.02, 0.001, 0.003);
  const bottomAccent = new Mesh(bottomGeo, accentMat.clone());
  bottomAccent.position.set(0, 0.001, HALF_L + 0.018);
  table.add(bottomAccent);
  accents.push(bottomAccent);

  return accents;
}

// Ball saver drain gate: a glowing barrier across the drain area
export function createDrainGate(table: Group): Mesh {
  const gateGeo = new BoxGeometry(PLAYFIELD_WIDTH * 0.6, 0.015, 0.004);
  const gateMat = new MeshBasicMaterial({
    color: new Color(0x00ff88),
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
  });
  const gate = new Mesh(gateGeo, gateMat);
  gate.position.set(0, 0.008, HALF_L - 0.015);
  gate.visible = false;
  table.add(gate);
  return gate;
}

// ======================================================================
// Round 35: Playfield inserts, table neon art, star rollovers
// ======================================================================

export interface PlayfieldInsert {
  mesh: Mesh;
  glow: Mesh;
  id: string;
  baseColor: number;
  flashTimer: number;
}

/** Circular glowing insert lights at scoring positions — like real pinball inserts */
export function createPlayfieldInserts(table: Group): PlayfieldInsert[] {
  const inserts: PlayfieldInsert[] = [];

  const insertData: { id: string; x: number; z: number; color: number; radius: number }[] = [
    // Bumper ring inserts
    { id: 'insert-bumper-c', x: 0, z: -0.12, color: 0xff00ff, radius: 0.012 },
    { id: 'insert-bumper-l', x: -0.08, z: -0.04, color: 0xff00ff, radius: 0.012 },
    { id: 'insert-bumper-r', x: 0.08, z: -0.04, color: 0xff00ff, radius: 0.012 },
    // Lane rollovers
    { id: 'insert-lane-l', x: -0.125, z: 0.24, color: 0x00ffff, radius: 0.008 },
    { id: 'insert-lane-c', x: 0, z: 0.22, color: 0xffff00, radius: 0.008 },
    { id: 'insert-lane-r', x: 0.125, z: 0.24, color: 0x00ff88, radius: 0.008 },
    // Ramp entry inserts
    { id: 'insert-ramp-l', x: -0.125, z: 0.02, color: 0xff00ff, radius: 0.010 },
    { id: 'insert-ramp-r', x: 0.125, z: 0.02, color: 0x00ff88, radius: 0.010 },
    // Target bank inserts (one per target)
    { id: 'insert-target-1', x: -0.16, z: -0.28, color: 0xff0044, radius: 0.007 },
    { id: 'insert-target-2', x: -0.08, z: -0.28, color: 0xff8800, radius: 0.007 },
    { id: 'insert-target-3', x: 0, z: -0.28, color: 0xffff00, radius: 0.007 },
    { id: 'insert-target-4', x: 0.08, z: -0.28, color: 0x00ff88, radius: 0.007 },
    { id: 'insert-target-5', x: 0.16, z: -0.28, color: 0x0088ff, radius: 0.007 },
    // Outlane danger inserts
    { id: 'insert-outlane-l', x: -0.22, z: 0.44, color: 0xff4400, radius: 0.008 },
    { id: 'insert-outlane-r', x: 0.22, z: 0.44, color: 0xff4400, radius: 0.008 },
    // Jackpot position
    { id: 'insert-jackpot', x: 0, z: -0.40, color: 0xffff00, radius: 0.014 },
    // Orbit entry inserts
    { id: 'insert-orbit-l', x: -0.22, z: -0.30, color: 0x0088ff, radius: 0.009 },
    { id: 'insert-orbit-r', x: 0.22, z: -0.30, color: 0x0088ff, radius: 0.009 },
    // Spinner inserts
    { id: 'insert-spinner-l', x: -0.18, z: -0.10, color: 0x00ffff, radius: 0.008 },
    { id: 'insert-spinner-r', x: 0.18, z: -0.10, color: 0x00ffff, radius: 0.008 },
    // Flipper gap inserts (center drain warning)
    { id: 'insert-center-drain', x: 0, z: 0.44, color: 0xff0044, radius: 0.010 },
  ];

  for (const d of insertData) {
    // Main disc (slightly raised off playfield)
    const discGeo = new CylinderGeometry(d.radius, d.radius, 0.001, 16);
    const discMat = new MeshBasicMaterial({
      color: new Color(d.color),
      transparent: true,
      opacity: 0.25,
      blending: AdditiveBlending,
    });
    const disc = new Mesh(discGeo, discMat);
    disc.position.set(d.x, 0.002, d.z);
    table.add(disc);

    // Outer glow ring
    const ringGeo = new RingGeometry(d.radius * 0.8, d.radius * 1.3, 16);
    const ringMat = new MeshBasicMaterial({
      color: new Color(d.color),
      transparent: true,
      opacity: 0.12,
      side: DoubleSide,
      blending: AdditiveBlending,
    });
    const ring = new Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(d.x, 0.0015, d.z);
    table.add(ring);

    inserts.push({
      mesh: disc,
      glow: ring,
      id: d.id,
      baseColor: d.color,
      flashTimer: 0,
    });
  }

  return inserts;
}

export interface NeonArtLine {
  mesh: Mesh;
  baseColor: number;
}

/** Geometric neon wireframe art on the playfield surface */
export function createPlayfieldArt(table: Group): NeonArtLine[] {
  const lines: NeonArtLine[] = [];
  const artMat = () => new MeshBasicMaterial({
    color: new Color(0x0044aa),
    transparent: true,
    opacity: 0.15,
    blending: AdditiveBlending,
    side: DoubleSide,
  });

  // Helper: create a thin line between two points on the playfield
  function addLine(x1: number, z1: number, x2: number, z2: number, color: number): void {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dx, dz);
    const geo = new PlaneGeometry(0.002, len);
    const mat = artMat();
    mat.color.setHex(color);
    const line = new Mesh(geo, mat);
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = -angle;
    line.position.set((x1 + x2) / 2, 0.0012, (z1 + z2) / 2);
    table.add(line);
    lines.push({ mesh: line, baseColor: color });
  }

  // Diamond connecting bumpers
  addLine(0, -0.12, -0.08, -0.04, 0x4400aa);  // top to left
  addLine(-0.08, -0.04, 0, 0.04, 0x4400aa);    // left to bottom
  addLine(0, 0.04, 0.08, -0.04, 0x4400aa);     // bottom to right
  addLine(0.08, -0.04, 0, -0.12, 0x4400aa);    // right to top

  // V-pattern above flippers
  addLine(-0.14, 0.38, 0, 0.32, 0x002288);     // left arm
  addLine(0, 0.32, 0.14, 0.38, 0x002288);      // right arm

  // Outer frame lines (subtle playfield border art)
  addLine(-0.20, -0.45, -0.20, 0.35, 0x001155);   // left vertical
  addLine(0.20, -0.45, 0.20, 0.35, 0x001155);     // right vertical
  addLine(-0.20, -0.45, 0.20, -0.45, 0x001155);   // top horizontal

  // Chevrons pointing down toward flippers
  addLine(-0.10, 0.26, -0.04, 0.30, 0x003366);
  addLine(-0.04, 0.30, -0.10, 0.34, 0x003366);
  addLine(0.10, 0.26, 0.04, 0.30, 0x003366);
  addLine(0.04, 0.30, 0.10, 0.34, 0x003366);

  // Cross pattern at center
  addLine(-0.04, -0.04, 0.04, -0.04, 0x003388);
  addLine(0, -0.08, 0, 0, 0x003388);

  return lines;
}

/** Star-shaped rollover indicators at lane positions */
export function createStarRollovers(table: Group): Mesh[] {
  const stars: Mesh[] = [];
  const starPositions = [
    { x: -0.125, z: 0.28, color: 0xff00ff },
    { x: 0, z: 0.26, color: 0xffff00 },
    { x: 0.125, z: 0.28, color: 0x00ff88 },
  ];

  for (const sp of starPositions) {
    // 4-pointed star using two intersecting planes
    const starGroup = new Group();

    const bladeMat = new MeshBasicMaterial({
      color: new Color(sp.color),
      transparent: true,
      opacity: 0.35,
      side: DoubleSide,
      blending: AdditiveBlending,
    });

    // Horizontal blade
    const hGeo = new PlaneGeometry(0.016, 0.005);
    const hBlade = new Mesh(hGeo, bladeMat.clone());
    hBlade.rotation.x = -Math.PI / 2;
    starGroup.add(hBlade);

    // Vertical blade
    const vGeo = new PlaneGeometry(0.005, 0.016);
    const vBlade = new Mesh(vGeo, bladeMat.clone());
    vBlade.rotation.x = -Math.PI / 2;
    starGroup.add(vBlade);

    // Diagonal blade 1
    const d1Geo = new PlaneGeometry(0.014, 0.004);
    const d1Blade = new Mesh(d1Geo, bladeMat.clone());
    d1Blade.rotation.x = -Math.PI / 2;
    d1Blade.rotation.z = Math.PI / 4;
    starGroup.add(d1Blade);

    // Diagonal blade 2
    const d2Geo = new PlaneGeometry(0.014, 0.004);
    const d2Blade = new Mesh(d2Geo, bladeMat.clone());
    d2Blade.rotation.x = -Math.PI / 2;
    d2Blade.rotation.z = -Math.PI / 4;
    starGroup.add(d2Blade);

    starGroup.position.set(sp.x, 0.002, sp.z);
    table.add(starGroup);
    stars.push(starGroup as unknown as Mesh);
  }

  return stars;
}
