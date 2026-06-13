// Neon Pinball VR - Visual Effects
// Round 3: Enhanced particles, intensity-reactive effects, wizard mode visuals

import {
  Mesh, SphereGeometry, PlaneGeometry, MeshBasicMaterial,
  Color, Vector3, AdditiveBlending, Group, DoubleSide, CylinderGeometry,
} from '@iwsdk/core';

import { IntensityLevel } from './game';

interface Particle {
  mesh: Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

interface ScorePopup {
  mesh: Mesh;
  vy: number;
  life: number;
}

interface TrailPoint {
  mesh: Mesh;
  life: number;
}

interface PulseRing {
  mesh: Mesh;
  life: number;
  maxLife: number;
  speed: number;
}

export class EffectsManager {
  private scene: any;
  private tableGroup: Group;
  private particles: Particle[] = [];
  private scorePopups: ScorePopup[] = [];
  private trail: TrailPoint[] = [];
  private pulseRings: PulseRing[] = [];
  private maxParticles = 150;
  private maxTrail = 50;

  private particleGeo = new SphereGeometry(0.004, 4, 4);
  private trailGeo = new SphereGeometry(0.006, 4, 4);

  // Particle pool: reuse meshes instead of creating/destroying
  private particlePool: Mesh[] = [];
  private trailPool: Mesh[] = [];

  // Bumper pulse animation
  private bumperPulsePhase = 0;
  private currentIntensity: IntensityLevel = 'calm';

  constructor(scene: any, tableGroup: Group) {
    this.scene = scene;
    this.tableGroup = tableGroup;
    this.preallocatePool();
  }

  private preallocatePool(): void {
    // Pre-create particle meshes for reuse
    for (let i = 0; i < 60; i++) {
      const mat = new MeshBasicMaterial({
        color: new Color(0xffffff),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
      });
      const mesh = new Mesh(this.particleGeo, mat);
      mesh.visible = false;
      this.tableGroup.add(mesh);
      this.particlePool.push(mesh);
    }
    // Pre-create trail meshes
    for (let i = 0; i < this.maxTrail; i++) {
      const mat = new MeshBasicMaterial({
        color: new Color(0x00ffff),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
      });
      const mesh = new Mesh(this.trailGeo, mat);
      mesh.visible = false;
      this.tableGroup.add(mesh);
      this.trailPool.push(mesh);
    }
  }

  private acquireParticle(color: number, x: number, y: number, z: number): Mesh | null {
    // Try to get from pool first
    const pooled = this.particlePool.pop();
    if (pooled) {
      (pooled.material as MeshBasicMaterial).color.setHex(color);
      (pooled.material as MeshBasicMaterial).opacity = 1;
      pooled.position.set(x, y, z);
      pooled.scale.setScalar(1);
      pooled.visible = true;
      return pooled;
    }
    // Fallback: create new if pool is empty
    if (this.particles.length >= this.maxParticles) return null;
    const mat = new MeshBasicMaterial({
      color: new Color(color),
      transparent: true,
      opacity: 1,
      blending: AdditiveBlending,
    });
    const mesh = new Mesh(this.particleGeo, mat);
    mesh.position.set(x, y, z);
    this.tableGroup.add(mesh);
    return mesh;
  }

  private releaseParticle(mesh: Mesh): void {
    mesh.visible = false;
    (mesh.material as MeshBasicMaterial).opacity = 0;
    this.particlePool.push(mesh);
  }

  private acquireTrailMesh(color: number, x: number, y: number, z: number): Mesh | null {
    const pooled = this.trailPool.pop();
    if (pooled) {
      (pooled.material as MeshBasicMaterial).color.setHex(color);
      (pooled.material as MeshBasicMaterial).opacity = 0.6;
      pooled.position.set(x, y, z);
      pooled.scale.setScalar(1);
      pooled.visible = true;
      return pooled;
    }
    // Fallback
    const mat = new MeshBasicMaterial({
      color: new Color(color),
      transparent: true,
      opacity: 0.6,
      blending: AdditiveBlending,
    });
    const mesh = new Mesh(this.trailGeo, mat);
    mesh.position.set(x, y, z);
    this.tableGroup.add(mesh);
    return mesh;
  }

  private releaseTrailMesh(mesh: Mesh): void {
    mesh.visible = false;
    (mesh.material as MeshBasicMaterial).opacity = 0;
    this.trailPool.push(mesh);
  }

  spawnBumperHit(x: number, z: number, color: number): void {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const mesh = this.acquireParticle(color, x, 0.03, z);
      if (!mesh) break;

      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 0.3 + Math.random() * 0.4;
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vy: 0.5 + Math.random() * 0.5,
        vz: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8,
      });
    }
  }

  spawnTargetHit(x: number, z: number, color: number): void {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const mesh = this.acquireParticle(color, x, 0.02, z);
      if (!mesh) break;

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.2 + Math.random() * 0.3;
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vy: 0.3 + Math.random() * 0.3,
        vz: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.2,
        maxLife: 0.6,
      });
    }
  }

  spawnDrain(x: number, z: number): void {
    for (let i = 0; i < 15; i++) {
      const mesh = this.acquireParticle(0xff0044, x, 0.02, z);
      if (!mesh) break;

      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 0.6,
        vy: 0.3 + Math.random() * 0.5,
        vz: (Math.random() - 0.5) * 0.6,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
      });
    }
  }

  spawnRampTrail(x: number, z: number): void {
    for (let i = 0; i < 8; i++) {
      const color = i % 2 === 0 ? 0xff00ff : 0x00ffff;
      const mesh = this.acquireParticle(color, x, 0.04, z);
      if (!mesh) break;

      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 0.3,
        vy: 0.8 + Math.random() * 0.5,
        vz: -0.5 - Math.random() * 0.3,
        life: 0.6 + Math.random() * 0.3,
        maxLife: 0.9,
      });
    }
  }

  addTrailPoint(x: number, y: number, z: number, color: number = 0x00ffff): void {
    if (this.trail.length >= this.maxTrail) {
      const old = this.trail.shift()!;
      this.releaseTrailMesh(old.mesh);
    }

    const mesh = this.acquireTrailMesh(color, x, y, z);
    if (!mesh) return;
    this.trail.push({ mesh, life: 0.5 });
  }

  // Score popup: glowing orb sized by score value, floats up and fades
  spawnScorePopup(x: number, z: number, score: number, color: number = 0x00ffff): void {
    // Size based on score magnitude
    const magnitude = Math.log10(Math.max(100, score)) - 1; // 2 for 100, 3 for 1000, etc
    const radius = 0.006 + magnitude * 0.004;
    const geo = new SphereGeometry(radius, 8, 6);

    const mat = new MeshBasicMaterial({
      color: new Color(color),
      transparent: true,
      opacity: 1.0,
      blending: AdditiveBlending,
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(x, 0.04, z);
    this.tableGroup.add(mesh);

    const speed = 0.1 + magnitude * 0.03;
    this.scorePopups.push({ mesh, vy: speed, life: 1.0 + magnitude * 0.2 });

    // For big scores (jackpots, etc), spawn a pulse ring too
    if (score >= 10000) {
      this.spawnPulseRing(x, z, color);
    }
    // For mega scores spawn extra particles
    if (score >= 50000) {
      for (let i = 0; i < 6; i++) {
        const pmesh = this.acquireParticle(color, x, 0.04, z);
        if (!pmesh) break;
        const angle = (i / 6) * Math.PI * 2;
        this.particles.push({
          mesh: pmesh,
          vx: Math.cos(angle) * 0.2,
          vy: 0.6 + Math.random() * 0.3,
          vz: Math.sin(angle) * 0.2,
          life: 0.6,
          maxLife: 0.6,
        });
      }
    }
  }

  // Tilt warning: brief red flash ring expanding from center
  spawnTiltWarning(): void {
    const geo = new CylinderGeometry(0.01, 0.01, 0.003, 16, 1, true);
    const mat = new MeshBasicMaterial({
      color: new Color(0xff0000),
      transparent: true,
      opacity: 1.0,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(0, 0.01, 0);
    this.tableGroup.add(mesh);
    this.pulseRings.push({
      mesh,
      life: 0.4,
      maxLife: 0.4,
      speed: 0.6,
    });

    // Red particle burst from center
    for (let i = 0; i < 8; i++) {
      const pmesh = this.acquireParticle(0xff0022, 0, 0.02, 0);
      if (!pmesh) break;
      const angle = (i / 8) * Math.PI * 2;
      this.particles.push({
        mesh: pmesh,
        vx: Math.cos(angle) * 0.5,
        vy: 0.3,
        vz: Math.sin(angle) * 0.5,
        life: 0.3,
        maxLife: 0.3,
      });
    }
  }

  setIntensity(level: IntensityLevel): void {
    this.currentIntensity = level;
  }

  // Spawn a pulse ring at location (wizard mode / big hits)
  spawnPulseRing(x: number, z: number, color: number): void {
    const geo = new CylinderGeometry(0.01, 0.01, 0.002, 16, 1, true);
    const mat = new MeshBasicMaterial({
      color: new Color(color),
      transparent: true,
      opacity: 0.8,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(x, 0.005, z);
    this.tableGroup.add(mesh);
    this.pulseRings.push({
      mesh,
      life: 0.8,
      maxLife: 0.8,
      speed: 0.3,
    });
  }

  // Wizard mode celebration burst
  spawnWizardBurst(x: number, z: number): void {
    const colors = [0xff00ff, 0x00ffff, 0xffff00, 0x00ff88, 0xff8800];
    for (let i = 0; i < 25; i++) {
      const color = colors[i % colors.length];
      const mesh = this.acquireParticle(color, x, 0.05, z);
      if (!mesh) break;

      const angle = (i / 25) * Math.PI * 2;
      const speed = 0.4 + Math.random() * 0.6;
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vy: 0.8 + Math.random() * 0.8,
        vz: Math.sin(angle) * speed,
        life: 0.8 + Math.random() * 0.5,
        maxLife: 1.3,
      });
    }
    // Pulse rings
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.spawnPulseRing(x, z, colors[i]), i * 200);
    }
  }

  update(dt: number): void {
    this.bumperPulsePhase += dt;

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.releaseParticle(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 1.5 * dt;

      const alpha = p.life / p.maxLife;
      (p.mesh.material as MeshBasicMaterial).opacity = alpha;
      const s = 0.5 + alpha * 0.5;
      p.mesh.scale.setScalar(s);
    }

    // Update trail
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const t = this.trail[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.releaseTrailMesh(t.mesh);
        this.trail.splice(i, 1);
        continue;
      }
      const alpha = t.life / 0.5;
      (t.mesh.material as MeshBasicMaterial).opacity = alpha * 0.6;
      t.mesh.scale.setScalar(alpha * 0.8);
    }

    // Update pulse rings
    for (let i = this.pulseRings.length - 1; i >= 0; i--) {
      const pr = this.pulseRings[i];
      pr.life -= dt;
      if (pr.life <= 0) {
        this.tableGroup.remove(pr.mesh);
        this.pulseRings.splice(i, 1);
        continue;
      }
      const progress = 1 - (pr.life / pr.maxLife);
      const scale = 1 + progress * 15;
      pr.mesh.scale.set(scale, 1, scale);
      (pr.mesh.material as MeshBasicMaterial).opacity = (pr.life / pr.maxLife) * 0.8;
    }

    // Update score popups
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const sp = this.scorePopups[i];
      sp.life -= dt;
      if (sp.life <= 0) {
        this.scene.remove(sp.mesh);
        this.scorePopups.splice(i, 1);
        continue;
      }
      sp.mesh.position.y += sp.vy * dt;
      sp.vy -= 0.3 * dt;
      const alpha = sp.life / 1.5;
      (sp.mesh.material as MeshBasicMaterial).opacity = alpha;
      // Scale up slightly as they float
      const s = 1.0 + (1.0 - alpha) * 0.3;
      sp.mesh.scale.setScalar(s);
    }
  }

  flashBumper(bumperMeshes: Map<string, { mesh: Mesh; glow: Mesh }>, id: string): void {
    const entry = bumperMeshes.get(id);
    if (!entry) return;

    const origEmissive = (entry.mesh.material as any).emissiveIntensity || 0.4;
    (entry.mesh.material as any).emissiveIntensity = 2.0;
    (entry.glow.material as MeshBasicMaterial).opacity = 1.0;

    setTimeout(() => {
      (entry.mesh.material as any).emissiveIntensity = origEmissive;
      (entry.glow.material as MeshBasicMaterial).opacity = 0.3;
    }, 150);
  }
}
