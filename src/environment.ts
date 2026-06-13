// Neon Pinball VR - Environment
// Holodeck neon wireframe surroundings

import {
  Group, Mesh, BoxGeometry, SphereGeometry, TorusGeometry, ConeGeometry,
  PlaneGeometry, MeshStandardMaterial, MeshBasicMaterial, LineBasicMaterial,
  Color, Vector3, Fog, AmbientLight, PointLight, DirectionalLight,
  EdgesGeometry, LineSegments, AdditiveBlending,
} from '@iwsdk/core';

export interface EnvState {
  decorations: { mesh: Mesh; baseY: number; rotSpeed: number; bobSpeed: number; baseColor: number }[];
  particles: { mesh: Mesh; vx: number; vy: number; vz: number; baseColor: number }[];
  gridLines: Mesh[];
  floor: Mesh;
  ceiling: Mesh;
  ambientLight: AmbientLight;
  currentThemeId: string;
}

export function createEnvironment(scene: any): EnvState {
  const state: EnvState = { decorations: [], particles: [], gridLines: [], floor: null as any, ceiling: null as any, ambientLight: null as any, currentThemeId: 'neon-classic' };

  // Fog
  scene.fog = new Fog(new Color(0x000010), 3, 20);

  // Lighting
  const ambient = new AmbientLight(new Color(0x111133), 0.6);
  scene.add(ambient);
  state.ambientLight = ambient;

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
  state.floor = floor;

  // Floor grid lines
  const gridMat = new MeshBasicMaterial({
    color: new Color(0x001133),
    transparent: true,
    opacity: 0.3,
  });
  for (let i = -10; i <= 10; i++) {
    // X lines
    const xGeo = new PlaneGeometry(20, 0.005);
    const xLine = new Mesh(xGeo, gridMat.clone());
    xLine.rotation.x = -Math.PI / 2;
    xLine.position.set(0, 0.001, i);
    scene.add(xLine);
    state.gridLines.push(xLine);
    // Z lines
    const zGeo = new PlaneGeometry(0.005, 20);
    const zLine = new Mesh(zGeo, gridMat.clone());
    zLine.rotation.x = -Math.PI / 2;
    zLine.position.set(i, 0.001, 0);
    scene.add(zLine);
    state.gridLines.push(zLine);
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
  state.ceiling = ceiling;

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
      baseColor: color,
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
      baseColor: 0x00ffff,
    });
  }

  return state;
}

// Theme color mappings for environment
interface EnvThemeColors {
  fog: number;
  grid: number;
  ambient: number;
  particleBase: number;
  decoColors: number[];
  floorTint: number;
  ceilTint: number;
}

const ENV_THEME_MAP: Record<string, EnvThemeColors> = {
  'neon-classic': {
    fog: 0x000010, grid: 0x001133, ambient: 0x111133,
    particleBase: 0x00ffff, decoColors: [0x00ffff, 0xff00ff, 0x00ff88, 0xff8800, 0x4488ff],
    floorTint: 0x000008, ceilTint: 0x001122,
  },
  'cyber-red': {
    fog: 0x100000, grid: 0x330808, ambient: 0x221111,
    particleBase: 0xff4422, decoColors: [0xff2222, 0xff6600, 0xff0066, 0xffaa00, 0xff4400],
    floorTint: 0x080000, ceilTint: 0x110808,
  },
  'ocean-blue': {
    fog: 0x000510, grid: 0x001144, ambient: 0x111133,
    particleBase: 0x0088ff, decoColors: [0x0088ff, 0x00aaff, 0x00ffaa, 0x0066ff, 0x44aaff],
    floorTint: 0x000408, ceilTint: 0x001133,
  },
  'solar-flare': {
    fog: 0x0a0400, grid: 0x331a00, ambient: 0x221811,
    particleBase: 0xffaa00, decoColors: [0xffaa00, 0xff6600, 0xffcc00, 0xff4400, 0xff8800],
    floorTint: 0x060300, ceilTint: 0x110a04,
  },
  'toxic-green': {
    fog: 0x010500, grid: 0x003308, ambient: 0x112211,
    particleBase: 0x00ff44, decoColors: [0x00ff44, 0x44ff00, 0x00ff88, 0xaaff00, 0x22ff66],
    floorTint: 0x000800, ceilTint: 0x081108,
  },
};

export function applyEnvironmentTheme(state: EnvState, scene: any, themeId: string): void {
  if (state.currentThemeId === themeId) return;
  state.currentThemeId = themeId;

  const colors = ENV_THEME_MAP[themeId] || ENV_THEME_MAP['neon-classic'];

  // Fog
  if (scene.fog) {
    (scene.fog as Fog).color.setHex(colors.fog);
  }

  // Ambient light
  state.ambientLight.color.setHex(colors.ambient);

  // Floor
  (state.floor.material as MeshStandardMaterial).color.setHex(colors.floorTint);

  // Ceiling
  (state.ceiling.material as MeshBasicMaterial).color.setHex(colors.ceilTint);

  // Grid lines
  for (const gl of state.gridLines) {
    (gl.material as MeshBasicMaterial).color.setHex(colors.grid);
  }

  // Decorations
  for (let i = 0; i < state.decorations.length; i++) {
    const d = state.decorations[i];
    const newColor = colors.decoColors[i % colors.decoColors.length];
    d.baseColor = newColor;
    (d.mesh.material as LineBasicMaterial).color.setHex(newColor);
  }

  // Particles
  for (const p of state.particles) {
    p.baseColor = colors.particleBase;
    (p.mesh.material as MeshBasicMaterial).color.setHex(colors.particleBase);
  }
}

export function updateEnvironment(state: EnvState, time: number, dt: number, intensityMultiplier: number = 1.0): void {
  // Animate decorations -- spin faster at higher intensity
  const rotMul = intensityMultiplier;
  for (const d of state.decorations) {
    d.mesh.rotation.x += d.rotSpeed * rotMul * dt;
    d.mesh.rotation.y += d.rotSpeed * 0.7 * rotMul * dt;
    d.mesh.position.y = d.baseY + Math.sin(time * d.bobSpeed * rotMul) * 0.1;
    // Decorations glow brighter at high intensity
    const dMat = d.mesh.material as LineBasicMaterial;
    dMat.opacity = 0.3 + (intensityMultiplier - 1) * 0.15;
  }

  // Animate particles -- move faster at higher intensity
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

    // Pulse opacity -- brighter at higher intensity
    const mat = p.mesh.material as MeshBasicMaterial;
    const baseOpacity = 0.3 + (intensityMultiplier - 1) * 0.1;
    mat.opacity = baseOpacity + Math.sin(time * 2 + p.mesh.position.x * 5) * 0.2;

    // Shift particle hue at frenzy intensity
    if (intensityMultiplier > 2.0) {
      const hue = (time * 0.3 + p.mesh.position.x * 0.2) % 1;
      mat.color.setHSL(hue, 1, 0.6);
    } else {
      // Restore base color when not in frenzy
      mat.color.setHex(p.baseColor);
    }
  }
}
