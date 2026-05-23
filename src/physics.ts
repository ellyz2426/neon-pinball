// Neon Pinball VR - 2D Pinball Physics Engine
// Ball moves on tilted playfield with gravity, friction, and collisions

export const BALL_RADIUS = 0.013;
export const PLAYFIELD_WIDTH = 0.52;
export const PLAYFIELD_LENGTH = 1.07;
export const HALF_W = 0.26;
export const HALF_L = 0.535;
export const TILT_ANGLE = 6.5 * (Math.PI / 180);
export const GRAVITY = 9.81 * Math.sin(TILT_ANGLE);
export const FRICTION = 0.4;
export const RESTITUTION = 0.5;
export const SUBSTEPS = 6;

export interface Vec2 {
  x: number;
  z: number;
}

export interface BallState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  active: boolean;
  inPlunger: boolean;
}

export interface WallSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  id?: string;
}

export interface CircleBumper {
  x: number;
  z: number;
  radius: number;
  kickForce: number;
  id: string;
  type: 'pop' | 'slingshot';
}

export interface FlipperState {
  pivotX: number;
  pivotZ: number;
  length: number;
  side: 'left' | 'right';
  angle: number;
  targetAngle: number;
  angularVel: number;
  restAngle: number;
  activeAngle: number;
}

export interface CollisionEvent {
  type: 'wall' | 'bumper' | 'flipper' | 'drain' | 'slingshot' | 'target';
  id?: string;
  x: number;
  z: number;
  force: number;
}

export class PinballPhysics {
  ball: BallState;
  walls: WallSegment[] = [];
  bumpers: CircleBumper[] = [];
  leftFlipper: FlipperState;
  rightFlipper: FlipperState;
  collisionEvents: CollisionEvent[] = [];

  // Plunger lane bounds
  readonly plungerLaneLeft = 0.20;
  readonly plungerLaneRight = HALF_W;
  readonly plungerLaneTop = -0.42;
  readonly plungerLaneBottom = HALF_L;

  // Drain zone
  readonly drainLeft = -0.06;
  readonly drainRight = 0.06;
  readonly drainZ = 0.47;

  constructor() {
    this.ball = { x: 0.23, z: 0.45, vx: 0, vz: 0, active: false, inPlunger: true };

    // Left flipper: pivot left of center, swings right/up
    this.leftFlipper = {
      pivotX: -0.08,
      pivotZ: 0.42,
      length: 0.075,
      side: 'left',
      angle: -30 * Math.PI / 180,
      targetAngle: -30 * Math.PI / 180,
      angularVel: 0,
      restAngle: -30 * Math.PI / 180,
      activeAngle: 30 * Math.PI / 180,
    };

    // Right flipper: pivot right of center, swings left/up
    this.rightFlipper = {
      pivotX: 0.08,
      pivotZ: 0.42,
      length: 0.075,
      side: 'right',
      angle: (180 + 30) * Math.PI / 180,
      targetAngle: (180 + 30) * Math.PI / 180,
      angularVel: 0,
      restAngle: (180 + 30) * Math.PI / 180,
      activeAngle: (180 - 30) * Math.PI / 180,
    };

    this.initWalls();
    this.initBumpers();
  }

  private initWalls(): void {
    const W = HALF_W;
    const L = HALF_L;
    const r = BALL_RADIUS;

    // Left wall (full height)
    this.walls.push({ x1: -W, z1: -L, x2: -W, z2: L, id: 'wall-left' });

    // Top wall (from left to plunger lane inner wall)
    this.walls.push({ x1: -W, z1: -L, x2: 0.20, z2: -L, id: 'wall-top' });

    // Top-right curve (plunger lane entrance) - angled segment
    this.walls.push({ x1: 0.20, z1: -L, x2: 0.20, z2: -0.42, id: 'wall-plunger-inner' });

    // Right wall (plunger lane outer, full height)
    this.walls.push({ x1: W, z1: -L, x2: W, z2: L, id: 'wall-right' });

    // Bottom-left wall (angled toward drain)
    this.walls.push({ x1: -W, z1: L, x2: -W + 0.04, z2: 0.48, id: 'wall-bl-outer' });
    this.walls.push({ x1: -W + 0.04, z1: 0.48, x2: -0.12, z2: 0.45, id: 'wall-bl-inner' });

    // Left flipper guide wall
    this.walls.push({ x1: -0.12, z1: 0.45, x2: -0.10, z2: 0.44, id: 'wall-flipper-l-guide' });

    // Right flipper guide wall
    this.walls.push({ x1: 0.10, z1: 0.44, x2: 0.12, z2: 0.45, id: 'wall-flipper-r-guide' });

    // Bottom-right wall (angled toward drain, up to plunger lane)
    this.walls.push({ x1: 0.12, z1: 0.45, x2: W - 0.06, z2: 0.48, id: 'wall-br-inner' });
    this.walls.push({ x1: W - 0.06, z1: 0.48, x2: 0.20, z2: L, id: 'wall-br-outer' });

    // Upper playfield guide rails (create interesting ball paths)
    // Left orbit entry rail
    this.walls.push({ x1: -0.22, z1: -0.20, x2: -0.20, z2: -0.35, id: 'wall-left-orbit' });
    // Right orbit entry rail
    this.walls.push({ x1: 0.16, z1: -0.20, x2: 0.18, z2: -0.35, id: 'wall-right-orbit' });
  }

  private initBumpers(): void {
    // Three pop bumpers in the upper-center area
    this.bumpers.push({
      x: 0, z: -0.18, radius: 0.028,
      kickForce: 2.5, id: 'pop-center', type: 'pop',
    });
    this.bumpers.push({
      x: -0.08, z: -0.28, radius: 0.025,
      kickForce: 2.5, id: 'pop-left', type: 'pop',
    });
    this.bumpers.push({
      x: 0.08, z: -0.28, radius: 0.025,
      kickForce: 2.5, id: 'pop-right', type: 'pop',
    });

    // Two slingshots (above flippers)
    this.bumpers.push({
      x: -0.17, z: 0.28, radius: 0.035,
      kickForce: 2.0, id: 'sling-left', type: 'slingshot',
    });
    this.bumpers.push({
      x: 0.17, z: 0.28, radius: 0.035,
      kickForce: 2.0, id: 'sling-right', type: 'slingshot',
    });
  }

  resetBall(): void {
    this.ball.x = 0.23;
    this.ball.z = 0.45;
    this.ball.vx = 0;
    this.ball.vz = 0;
    this.ball.active = true;
    this.ball.inPlunger = true;
  }

  launchBall(power: number): void {
    if (!this.ball.inPlunger) return;
    // Launch upward (-z direction) with given power
    const launchSpeed = 1.0 + power * 3.5;
    this.ball.vz = -launchSpeed;
    this.ball.vx = -0.15; // slight leftward curve into playfield
    this.ball.inPlunger = false;
  }

  setFlipperActive(side: 'left' | 'right', active: boolean): void {
    const flipper = side === 'left' ? this.leftFlipper : this.rightFlipper;
    flipper.targetAngle = active ? flipper.activeAngle : flipper.restAngle;
  }

  update(dt: number): CollisionEvent[] {
    this.collisionEvents = [];
    if (!this.ball.active) return this.collisionEvents;

    const subDt = dt / SUBSTEPS;

    for (let s = 0; s < SUBSTEPS; s++) {
      this.updateFlippers(subDt);
      this.updateBallPhysics(subDt);
      this.checkCollisions();
    }

    return this.collisionEvents;
  }

  private updateFlippers(dt: number): void {
    for (const flipper of [this.leftFlipper, this.rightFlipper]) {
      const diff = flipper.targetAngle - flipper.angle;
      const speed = 25; // radians per second
      if (Math.abs(diff) > 0.001) {
        const step = Math.sign(diff) * speed * dt;
        if (Math.abs(step) > Math.abs(diff)) {
          flipper.angularVel = diff / dt;
          flipper.angle = flipper.targetAngle;
        } else {
          flipper.angularVel = Math.sign(diff) * speed;
          flipper.angle += step;
        }
      } else {
        flipper.angularVel = 0;
      }
    }
  }

  private updateBallPhysics(dt: number): void {
    const b = this.ball;

    // Gravity pulls ball toward +z (downward on table)
    if (!b.inPlunger) {
      b.vz += GRAVITY * dt;
    }

    // Friction
    const frictionFactor = 1 - FRICTION * dt;
    b.vx *= frictionFactor;
    b.vz *= frictionFactor;

    // Speed cap
    const speed = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
    const maxSpeed = 5.0;
    if (speed > maxSpeed) {
      b.vx = (b.vx / speed) * maxSpeed;
      b.vz = (b.vz / speed) * maxSpeed;
    }

    // Move
    b.x += b.vx * dt;
    b.z += b.vz * dt;
  }

  private checkCollisions(): void {
    const b = this.ball;
    const r = BALL_RADIUS;

    // Plunger lane constraints
    if (b.inPlunger) {
      if (b.x < this.plungerLaneLeft + r) b.x = this.plungerLaneLeft + r;
      if (b.x > this.plungerLaneRight - r) b.x = this.plungerLaneRight - r;
      if (b.z < this.plungerLaneTop) {
        // Ball exits plunger lane into main playfield
        b.inPlunger = false;
      }
      if (b.z > this.plungerLaneBottom - r) {
        b.z = this.plungerLaneBottom - r;
        b.vz = -Math.abs(b.vz) * 0.3;
      }
      return;
    }

    // Wall collisions
    for (const wall of this.walls) {
      this.collideWall(wall);
    }

    // Bumper collisions
    for (const bumper of this.bumpers) {
      this.collideBumper(bumper);
    }

    // Flipper collisions
    this.collideFlipper(this.leftFlipper);
    this.collideFlipper(this.rightFlipper);

    // Drain check
    if (b.z > this.drainZ && b.x > this.drainLeft && b.x < this.drainRight) {
      if (b.z > HALF_L + 0.05) {
        this.collisionEvents.push({
          type: 'drain', x: b.x, z: b.z, force: 0,
        });
        b.active = false;
      }
    }

    // Final bounds check (prevent ball escaping)
    if (b.x < -HALF_W + r) { b.x = -HALF_W + r; b.vx = Math.abs(b.vx) * RESTITUTION; }
    if (b.x > HALF_W - r) { b.x = HALF_W - r; b.vx = -Math.abs(b.vx) * RESTITUTION; }
    if (b.z < -HALF_L + r) { b.z = -HALF_L + r; b.vz = Math.abs(b.vz) * RESTITUTION; }
  }

  private collideWall(wall: WallSegment): void {
    const b = this.ball;
    const r = BALL_RADIUS;

    // Line segment: (x1,z1) to (x2,z2)
    const dx = wall.x2 - wall.x1;
    const dz = wall.z2 - wall.z1;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 0.0001) return;

    // Project ball center onto line
    let t = ((b.x - wall.x1) * dx + (b.z - wall.z1) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const closestX = wall.x1 + t * dx;
    const closestZ = wall.z1 + t * dz;

    const distX = b.x - closestX;
    const distZ = b.z - closestZ;
    const dist = Math.sqrt(distX * distX + distZ * distZ);

    if (dist < r && dist > 0.0001) {
      // Normal from wall to ball
      const nx = distX / dist;
      const nz = distZ / dist;

      // Separate
      b.x = closestX + nx * (r + 0.001);
      b.z = closestZ + nz * (r + 0.001);

      // Reflect velocity
      const dot = b.vx * nx + b.vz * nz;
      if (dot < 0) {
        b.vx -= (1 + RESTITUTION) * dot * nx;
        b.vz -= (1 + RESTITUTION) * dot * nz;

        const force = Math.abs(dot);
        if (force > 0.1) {
          this.collisionEvents.push({
            type: 'wall', id: wall.id, x: closestX, z: closestZ, force,
          });
        }
      }
    }
  }

  private collideBumper(bumper: CircleBumper): void {
    const b = this.ball;
    const r = BALL_RADIUS;

    const dx = b.x - bumper.x;
    const dz = b.z - bumper.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const minDist = r + bumper.radius;

    if (dist < minDist && dist > 0.001) {
      const nx = dx / dist;
      const nz = dz / dist;

      // Separate
      b.x = bumper.x + nx * (minDist + 0.001);
      b.z = bumper.z + nz * (minDist + 0.001);

      // Kick ball away
      const currentSpeed = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
      const kickSpeed = Math.max(bumper.kickForce, currentSpeed * 0.8);
      b.vx = nx * kickSpeed;
      b.vz = nz * kickSpeed;

      this.collisionEvents.push({
        type: bumper.type === 'slingshot' ? 'slingshot' : 'bumper',
        id: bumper.id,
        x: bumper.x, z: bumper.z,
        force: kickSpeed,
      });
    }
  }

  private collideFlipper(flipper: FlipperState): void {
    const b = this.ball;
    const r = BALL_RADIUS;

    // Flipper tip position
    const tipX = flipper.pivotX + Math.cos(flipper.angle) * flipper.length;
    const tipZ = flipper.pivotZ + Math.sin(flipper.angle) * flipper.length;

    // Ball to flipper line segment distance
    const dx = tipX - flipper.pivotX;
    const dz = tipZ - flipper.pivotZ;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 0.0001) return;

    let t = ((b.x - flipper.pivotX) * dx + (b.z - flipper.pivotZ) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const closestX = flipper.pivotX + t * dx;
    const closestZ = flipper.pivotZ + t * dz;

    const distX = b.x - closestX;
    const distZ = b.z - closestZ;
    const dist = Math.sqrt(distX * distX + distZ * distZ);

    const flipperRadius = 0.008; // flipper body radius
    const minDist = r + flipperRadius;

    if (dist < minDist && dist > 0.001) {
      const nx = distX / dist;
      const nz = distZ / dist;

      // Separate
      b.x = closestX + nx * (minDist + 0.001);
      b.z = closestZ + nz * (minDist + 0.001);

      // Reflect velocity
      const dot = b.vx * nx + b.vz * nz;

      // Flipper angular velocity contribution at contact point
      const contactDist = t * flipper.length;
      const flipperVelX = -Math.sin(flipper.angle) * flipper.angularVel * contactDist;
      const flipperVelZ = Math.cos(flipper.angle) * flipper.angularVel * contactDist;

      // Velocity relative to flipper surface
      const relVx = b.vx - flipperVelX;
      const relVz = b.vz - flipperVelZ;
      const relDot = relVx * nx + relVz * nz;

      if (relDot < 0) {
        b.vx -= (1 + 0.7) * relDot * nx;
        b.vz -= (1 + 0.7) * relDot * nz;

        // Add flipper velocity
        b.vx += flipperVelX * 1.2;
        b.vz += flipperVelZ * 1.2;

        const force = Math.abs(relDot) + Math.abs(flipper.angularVel) * contactDist;
        if (force > 0.05) {
          this.collisionEvents.push({
            type: 'flipper', id: flipper.side,
            x: closestX, z: closestZ, force,
          });
        }
      }
    }
  }

  getFlipperTip(flipper: FlipperState): Vec2 {
    return {
      x: flipper.pivotX + Math.cos(flipper.angle) * flipper.length,
      z: flipper.pivotZ + Math.sin(flipper.angle) * flipper.length,
    };
  }

  getBall3DY(tableY: number): number {
    // Ball Y position based on table tilt
    return tableY + (HALF_L - this.ball.z) * Math.sin(TILT_ANGLE) + BALL_RADIUS + 0.001;
  }
}
