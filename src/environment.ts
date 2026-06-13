// Neon Pinball VR - Environment
// Holodeck neon wireframe surroundings

import {
  Group, Mesh, BoxGeometry, SphereGeometry, TorusGeometry, ConeGeometry,
  PlaneGeometry, MeshStandardMaterial, MeshBasicMaterial, LineBasicMaterial,
  Color, Vector3, Fog, AmbientLight, PointLight, DirectionalLight,
  EdgesGeometry, LineSegments, AdditiveBlending,
} from '@iwsdk/core';

export interface EnvState {
  decorations: { mesh: Mesh; baseY: number; rotSpeed: number; bobSpeed: number }[];
  particles: { mesh: Mesh; vx: number; vy: number; vz: number }[];
}

export function createEnvironment(scene: any): EnvState {
  const state: EnvState = { decorations: [], particles: [] };

  // Fog
  scene.fog = new Fog(new Color(0x000010), 3, 20);

  // Lighting
  const ambient = new AmbientLight(new Color(0x111133), 0.6);
  scene.add(ambient);

  const dir = new DirectionalLight(new Color(0x4488ff), 0.4);
  dir.position.set(2, 5, 3);
  scene.add(dir);

  // Key lights for table
  const tableLight1 = new PointLight(new Color(0x00ffff), 1.2, 3);
  tableLight1.position.set(0, 1.5, 0);
  scene.add(tableLight1);

  const tableLight2 = new PointLight(new Color(0xff00ff), 0.6, 3);
  tableLight2.position.set(-0.3, 1.3, -0.3);
  scene.add(tableLight2);

  const tableLight3 = new PointLight(new Color(0x00ff88), 0.4, 3);
  tableLight3.position.set(0.3, 1.3, 0.3);
  scene.add(tableLight3);

  // Floor grid
  const floorMat = new MeshStandardMaterial({
    color: new Color(0x000008),
    roughness: 0.9,
    metalness: 0.1,
  });
  const floorGeo = new PlaneGeometry(20, 20);
  const floor = new Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  // Floor grid lines
  const gridMat = new MeshBasicMaterial({
    color: new Color(0x001133),
    transparent: true,
    opacity: 0.3,
  });
  for (let i = -10; i <= 10; i++) {
    // X lines
    const xGeo = new PlaneGeometry(20, 0.005);
    const xLine = new Mesh(xGeo, gridMat);
    xLine.rotation.x = -Math.PI / 2;
    xLine.position.set(0, 0.001, i);
    scene.add(xLine);
    // Z lines
    const zGeo = new PlaneGeometry(0.005, 20);
    const zLine = new Mesh(zGeo, gridMat);
    zLine.rotation.x = -Math.PI / 2;
    zLine.position.set(i, 0.001, 0);
    scene.add(zLine);
  }

  // Ceiling grid
  const ceilMat = new MeshBasicMaterial({
    color: new Color(0x001122),
    transparent: true,
    opacity: 0.15,
  });
  const ceilGeo = new PlaneGeometry(20, 20);
  const ceiling = new Mesh(ceilGeo, ceilMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 3;
  scene.add(ceiling);

  // Floating wireframe decorations
  const decoTypes = [
    () => new TorusGeometry(0.15, 0.03, 8, 16),
    () => new BoxGeometry(0.2, 0.2, 0.2),
    () => new SphereGeometry(0.12, 8, 6),
    () => new ConeGeometry(0.1, 0.2, 6),
  ];
  const decoColors = [0x00ffff, 0xff00ff, 0x00ff88, 0xff8800, 0x4488ff];

  for (let i = 0; i < 12; i++) {
    const geoFn = decoTypes[i % decoTypes.length];
    const color = decoColors[i % decoColors.length];
    const geo = geoFn();
    const edgeGeo = new EdgesGeometry(geo);
    const edgeMat = new LineBasicMaterial({
      color: new Color(color),
      transparent: true,
      opacity: 0.4,
    });
    const mesh = new LineSegments(edgeGeo, edgeMat) as unknown as Mesh;

    const angle = (i / 12) * Math.PI * 2;
    const radius = 2 + Math.random() * 2;
    const y = 0.5 + Math.random() * 2;
    mesh.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);

    scene.add(mesh);
    state.decorations.push({
      mesh,
      baseY: y,
      rotSpeed: 0.3 + Math.random() * 0.5,
      bobSpeed: 0.5 + Math.random() * 0.5,
    });
  }

  // Ambient particles
  const particleMat = new MeshBasicMaterial({
    color: new Color(0x00ffff),
    transparent: true,
    opacity: 0.4,
    blending: AdditiveBlending,
  });
  const particleGeo = new SphereGeometry(0.005, 4, 4);

  for (let i = 0; i < 40; i++) {
    const p = new Mesh(particleGeo, particleMat.clone());
    p.position.set(
      (Math.random() - 0.5) * 6,
      0.5 + Math.random() * 2.5,
      (Math.random() - 0.5) * 6,
    );
    scene.add(p);
    state.particles.push({
      mesh: p,
      vx: (Math.random() - 0.5) * 0.1,
      vy: (Math.random() - 0.5) * 0.05,
      vz: (Math.random() - 0.5) * 0.1,
    });
  }

  return state;
}

export function updateEnvironment(state: EnvState, time: number, dt: number, intensityMultiplier: number = 1.0): void {
  // Animate decorations — spin faster at higher intensity
  const rotMul = intensityMultiplier;
  for (const d of state.decorations) {
    d.mesh.rotation.x += d.rotSpeed * rotMul * dt;
    d.mesh.rotation.y += d.rotSpeed * 0.7 * rotMul * dt;
    d.mesh.position.y = d.baseY + Math.sin(time * d.bobSpeed * rotMul) * 0.1;
    // Decorations glow brighter at high intensity
    const dMat = d.mesh.material as LineBasicMaterial;
    dMat.opacity = 0.3 + (intensityMultiplier - 1) * 0.15;
  }

  // Animate particles — move faster at higher intensity
  const speedMul = intensityMultiplier;
  for (const p of state.particles) {
    p.mesh.position.x += p.vx * speedMul * dt;
    p.mesh.position.y += p.vy * speedMul * dt;
    p.mesh.position.z += p.vz * speedMul * dt;

    // Bounds wrap
    if (p.mesh.position.x > 3) p.mesh.position.x = -3;
    if (p.mesh.position.x < -3) p.mesh.position.x = 3;
    if (p.mesh.position.y > 3) p.mesh.position.y = 0.5;
    if (p.mesh.position.y < 0.5) p.mesh.position.y = 3;
    if (p.mesh.position.z > 3) p.mesh.position.z = -3;
    if (p.mesh.position.z < -3) p.mesh.position.z = 3;

    // Pulse opacity — brighter at higher intensity
    const mat = p.mesh.material as MeshBasicMaterial;
    const baseOpacity = 0.3 + (intensityMultiplier - 1) * 0.1;
    mat.opacity = baseOpacity + Math.sin(time * 2 + p.mesh.position.x * 5) * 0.2;

    // Shift particle hue at frenzy intensity
    if (intensityMultiplier > 2.0) {
      const hue = (time * 0.3 + p.mesh.position.x * 0.2) % 1;
      mat.color.setHSL(hue, 1, 0.6);
    }
  }
}
