// Neon Pinball VR - Visual Effects
// Particle effects, bumper flashes, score popups, ball trail

import {
  Mesh, SphereGeometry, PlaneGeometry, MeshBasicMaterial,
  Color, Vector3, AdditiveBlending, Group, DoubleSide,
} from '@iwsdk/core';

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

export class EffectsManager {
  private scene: any;
  private tableGroup: Group;
  private particles: Particle[] = [];
  private scorePopups: ScorePopup[] = [];
  private trail: TrailPoint[] = [];
  private particlePool: Mesh[] = [];
  private maxParticles = 80;
  private maxTrail = 30;

  private particleGeo = new SphereGeometry(0.004, 4, 4);
  private trailGeo = new SphereGeometry(0.006, 4, 4);

  constructor(scene: any, tableGroup: Group) {
    this.scene = scene;
    this.tableGroup = tableGroup;
  }

  spawnBumperHit(x: number, z: number, color: number): void {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const mat = new MeshBasicMaterial({
        color: new Color(color),
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
      });
      const mesh = new Mesh(this.particleGeo, mat);
      mesh.position.set(x, 0.03, z);
      this.tableGroup.add(mesh);

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
      const mat = new MeshBasicMaterial({
        color: new Color(color),
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
      });
      const mesh = new Mesh(this.particleGeo, mat);
      mesh.position.set(x, 0.02, z);
      this.tableGroup.add(mesh);

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
      const mat = new MeshBasicMaterial({
        color: new Color(0xff0044),
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
      });
      const mesh = new Mesh(this.particleGeo, mat);
      mesh.position.set(x, 0.02, z);
      this.tableGroup.add(mesh);

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

  addTrailPoint(x: number, y: number, z: number): void {
    if (this.trail.length >= this.maxTrail) {
      const old = this.trail.shift()!;
      this.tableGroup.remove(old.mesh);
    }

    const mat = new MeshBasicMaterial({
      color: new Color(0x00ffff),
      transparent: true,
      opacity: 0.6,
      blending: AdditiveBlending,
    });
    const mesh = new Mesh(this.trailGeo, mat);
    // Convert world coords to table local
    mesh.position.set(x, y, z);
    this.tableGroup.add(mesh);
    this.trail.push({ mesh, life: 0.5 });
  }

  update(dt: number): void {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.tableGroup.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 1.5 * dt; // gravity

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
        this.tableGroup.remove(t.mesh);
        this.trail.splice(i, 1);
        continue;
      }
      const alpha = t.life / 0.5;
      (t.mesh.material as MeshBasicMaterial).opacity = alpha * 0.6;
      t.mesh.scale.setScalar(alpha * 0.8);
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
