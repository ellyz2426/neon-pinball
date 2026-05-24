// Neon Pinball VR - 2D Pinball Physics Engine
// Ball moves on tilted playfield with gravity, friction, and collisions
// Round 2: Multi-ball, spinners, ramps, outlanes

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
export const MAX_BALLS = 4;

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
  id: number;
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

export interface SpinnerDef {
  x: number;
  z: number;
  id: string;
  width: number;     // passage width
  spinAngle: number; // current rotation for visual
  spinVel: number;   // angular velocity (decays)
}

export interface RampDef {
  entryX: number;
  entryZ: number;
  exitX: number;
  exitZ: number;
  entryWidth: number;
  exitVx: number;
  exitVz: number;
  id: string;
  active: boolean; // ball is currently on ramp
}

export interface OutlaneDef {
  x: number;
  z: number;
  width: number;
  side: 'left' | 'right';
  kickbackActive: boolean;
  kickbackForce: number;
  id: string;
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
  type: 'wall' | 'bumper' | 'flipper' | 'drain' | 'slingshot' | 'target' | 'spinner' | 'ramp_enter' | 'ramp_exit' | 'outlane' | 'kickback' | 'captive_ball' | 'vuk';
  id?: string;
  x: number;
  z: number;
  force: number;
  ballId?: number;
}

// Captive ball: a ball trapped in a lane that the player's ball hits
export interface CaptiveBallDef {
  x: number;
  z: number;
  homeX: number;
  homeZ: number;
  radius: number;
  currentX: number;
  currentZ: number;
  vx: number;
  vz: number;
  id: string;
}

// VUK (Vertical Up-Kicker): scoop that captures ball then launches it
export interface VUKDef {
  x: number;
  z: number;
  radius: number;
  launchVx: number;
  launchVz: number;
  cooldown: number;
  timer: number;  // countdown before launch
  captured: boolean;
  id: string;
}

let nextBallId = 0;

export class PinballPhysics {
  balls: BallState[] = [];
  ball: BallState; // primary ball reference (first active ball)
  walls: WallSegment[] = [];
  bumpers: CircleBumper[] = [];
  spinners: SpinnerDef[] = [];
  ramps: RampDef[] = [];
  outlanes: OutlaneDef[] = [];
  captiveBalls: CaptiveBallDef[] = [];
  vuks: VUKDef[] = [];
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
    this.ball = this.createBall(0.23, 0.45, true);
    this.balls.push(this.ball);

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
    this.initSpinners();
    this.initRamps();
    this.initOutlanes();
    this.initCaptiveBalls();
    this.initVUKs();
  }

  private createBall(x: number, z: number, inPlunger: boolean): BallState {
    return {
      x, z, vx: 0, vz: 0,
      active: false, inPlunger,
      id: nextBallId++,
    };
  }

  private initWalls(): void {
    const W = HALF_W;
    const L = HALF_L;

    // Left wall (full height)
    this.walls.push({ x1: -W, z1: -L, x2: -W, z2: L, id: 'wall-left' });
    // Top wall (from left to plunger lane inner wall)
    this.walls.push({ x1: -W, z1: -L, x2: 0.20, z2: -L, id: 'wall-top' });
    // Plunger lane inner wall
    this.walls.push({ x1: 0.20, z1: -L, x2: 0.20, z2: -0.42, id: 'wall-plunger-inner' });
    // Right wall (plunger lane outer, full height)
    this.walls.push({ x1: W, z1: -L, x2: W, z2: L, id: 'wall-right' });

    // Bottom-left wall (angled toward drain) — with outlane gap
    this.walls.push({ x1: -W, z1: L, x2: -W + 0.02, z2: 0.50, id: 'wall-bl-outer' });
    // Left outlane wall (gap between outer wall and guide)
    this.walls.push({ x1: -W + 0.05, z1: 0.48, x2: -0.14, z2: 0.45, id: 'wall-bl-inner' });
    // Left flipper guide wall
    this.walls.push({ x1: -0.14, z1: 0.45, x2: -0.10, z2: 0.44, id: 'wall-flipper-l-guide' });

    // Right flipper guide wall
    this.walls.push({ x1: 0.10, z1: 0.44, x2: 0.14, z2: 0.45, id: 'wall-flipper-r-guide' });
    // Right outlane wall
    this.walls.push({ x1: 0.14, z1: 0.45, x2: W - 0.05, z2: 0.48, id: 'wall-br-inner' });
    this.walls.push({ x1: W - 0.02, z1: 0.50, x2: 0.20, z2: L, id: 'wall-br-outer' });

    // Upper playfield guide rails
    this.walls.push({ x1: -0.22, z1: -0.20, x2: -0.20, z2: -0.35, id: 'wall-left-orbit' });
    this.walls.push({ x1: 0.16, z1: -0.20, x2: 0.18, z2: -0.35, id: 'wall-right-orbit' });

    // Ramp entry guide walls (left ramp)
    this.walls.push({ x1: -0.16, z1: 0.10, x2: -0.14, z2: -0.05, id: 'wall-ramp-l-left' });
    this.walls.push({ x1: -0.09, z1: 0.10, x2: -0.11, z2: -0.05, id: 'wall-ramp-l-right' });

    // Ramp entry guide walls (right ramp)
    this.walls.push({ x1: 0.09, z1: 0.10, x2: 0.11, z2: -0.05, id: 'wall-ramp-r-left' });
    this.walls.push({ x1: 0.16, z1: 0.10, x2: 0.14, z2: -0.05, id: 'wall-ramp-r-right' });
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

  private initSpinners(): void {
    // Center spinner — ball passes through and spins the gate
    this.spinners.push({
      x: 0, z: -0.06, id: 'spinner-center',
      width: 0.04, spinAngle: 0, spinVel: 0,
    });
    // Left orbit spinner
    this.spinners.push({
      x: -0.21, z: -0.12, id: 'spinner-left',
      width: 0.035, spinAngle: 0, spinVel: 0,
    });
  }

  private initRamps(): void {
    // Left ramp: enters from lower-left, exits upper-left (ball drops back)
    this.ramps.push({
      entryX: -0.125, entryZ: 0.05,
      exitX: -0.20, exitZ: -0.38,
      entryWidth: 0.05,
      exitVx: 0.1, exitVz: 0.4,
      id: 'ramp-left', active: false,
    });

    // Right ramp: enters from lower-right, exits upper-right
    this.ramps.push({
      entryX: 0.125, entryZ: 0.05,
      exitX: 0.20, exitZ: -0.38,
      entryWidth: 0.05,
      exitVx: -0.1, exitVz: 0.4,
      id: 'ramp-right', active: false,
    });
  }

  private initOutlanes(): void {
    this.outlanes.push({
      x: -0.235, z: 0.46,
      width: 0.04, side: 'left',
      kickbackActive: true,
      kickbackForce: 3.0,
      id: 'outlane-left',
    });
    this.outlanes.push({
      x: 0.235, z: 0.46,
      width: 0.04, side: 'right',
      kickbackActive: true,
      kickbackForce: 3.0,
      id: 'outlane-right',
    });
  }

  private initCaptiveBalls(): void {
    // One captive ball in the upper-right area
    this.captiveBalls.push({
      x: 0.14, z: -0.38,
      homeX: 0.14, homeZ: -0.38,
      radius: BALL_RADIUS,
      currentX: 0.14, currentZ: -0.38,
      vx: 0, vz: 0,
      id: 'captive-1',
    });
  }

  private initVUKs(): void {
    // VUK scoop on left side
    this.vuks.push({
      x: -0.18, z: 0.05,
      radius: 0.02,
      launchVx: 0.3, launchVz: -2.5,
      cooldown: 0, timer: 0,
      captured: false,
      id: 'vuk-left',
    });
  }

  resetBall(): void {
    // Reset primary ball
    this.ball.x = 0.23;
    this.ball.z = 0.45;
    this.ball.vx = 0;
    this.ball.vz = 0;
    this.ball.active = true;
    this.ball.inPlunger = true;
  }

  resetAllBalls(): void {
    // Remove all extra balls, keep only primary
    this.balls = [this.ball];
    this.resetBall();
  }

  launchBall(power: number): void {
    if (!this.ball.inPlunger) return;
    const launchSpeed = 1.0 + power * 3.5;
    this.ball.vz = -launchSpeed;
    this.ball.vx = -0.15;
    this.ball.inPlunger = false;
  }

  // Multiball: spawn additional balls at the given position
  spawnExtraBall(x: number, z: number, vx: number, vz: number): BallState {
    const b = this.createBall(x, z, false);
    b.active = true;
    b.vx = vx;
    b.vz = vz;
    this.balls.push(b);
    return b;
  }

  getActiveBalls(): BallState[] {
    return this.balls.filter(b => b.active);
  }

  getActiveBallCount(): number {
    return this.balls.filter(b => b.active).length;
  }

  setFlipperActive(side: 'left' | 'right', active: boolean): void {
    const flipper = side === 'left' ? this.leftFlipper : this.rightFlipper;
    flipper.targetAngle = active ? flipper.activeAngle : flipper.restAngle;
  }

  update(dt: number): CollisionEvent[] {
    this.collisionEvents = [];

    const subDt = dt / SUBSTEPS;

    for (let s = 0; s < SUBSTEPS; s++) {
      this.updateFlippers(subDt);
      this.updateSpinners(subDt);
      this.updateCaptiveBalls(subDt);
      this.updateVUKs(subDt);

      // Update all active balls
      for (const b of this.balls) {
        if (!b.active) continue;
        this.updateBallPhysics(b, subDt);
        this.checkCollisions(b);
      }

      // Ball-ball collisions (multiball)
      this.checkBallBallCollisions();
    }

    // Update primary ball reference to first active ball
    const activeBalls = this.getActiveBalls();
    if (activeBalls.length > 0 && !this.ball.active) {
      this.ball = activeBalls[0];
    }

    return this.collisionEvents;
  }

  private updateFlippers(dt: number): void {
    for (const flipper of [this.leftFlipper, this.rightFlipper]) {
      const diff = flipper.targetAngle - flipper.angle;
      const speed = 25;
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

  private updateSpinners(dt: number): void {
    for (const spinner of this.spinners) {
      spinner.spinAngle += spinner.spinVel * dt;
      // Friction decay
      spinner.spinVel *= (1 - 3.0 * dt);
      if (Math.abs(spinner.spinVel) < 0.1) spinner.spinVel = 0;
    }
  }

  private updateBallPhysics(b: BallState, dt: number): void {
    if (!b.inPlunger) {
      b.vz += GRAVITY * dt;
    }

    const frictionFactor = 1 - FRICTION * dt;
    b.vx *= frictionFactor;
    b.vz *= frictionFactor;

    const speed = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
    const maxSpeed = 5.0;
    if (speed > maxSpeed) {
      b.vx = (b.vx / speed) * maxSpeed;
      b.vz = (b.vz / speed) * maxSpeed;
    }

    b.x += b.vx * dt;
    b.z += b.vz * dt;
  }

  private checkCollisions(b: BallState): void {
    const r = BALL_RADIUS;

    // Plunger lane constraints (only for primary ball in plunger)
    if (b.inPlunger) {
      if (b.x < this.plungerLaneLeft + r) b.x = this.plungerLaneLeft + r;
      if (b.x > this.plungerLaneRight - r) b.x = this.plungerLaneRight - r;
      if (b.z < this.plungerLaneTop) {
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
      this.collideWall(b, wall);
    }

    // Bumper collisions
    for (const bumper of this.bumpers) {
      this.collideBumper(b, bumper);
    }

    // Spinner collisions
    for (const spinner of this.spinners) {
      this.collideSpinner(b, spinner);
    }

    // Ramp entry/exit
    for (const ramp of this.ramps) {
      this.checkRamp(b, ramp);
    }

    // Outlane checks
    for (const outlane of this.outlanes) {
      this.checkOutlane(b, outlane);
    }

    // Captive ball collisions
    for (const cap of this.captiveBalls) {
      this.collideCaptiveBall(b, cap);
    }

    // VUK scoops
    for (const vuk of this.vuks) {
      this.checkVUK(b, vuk);
    }

    // Flipper collisions
    this.collideFlipper(b, this.leftFlipper);
    this.collideFlipper(b, this.rightFlipper);

    // Drain check
    if (b.z > this.drainZ && b.x > this.drainLeft && b.x < this.drainRight) {
      if (b.z > HALF_L + 0.05) {
        this.collisionEvents.push({
          type: 'drain', x: b.x, z: b.z, force: 0, ballId: b.id,
        });
        b.active = false;
      }
    }

    // Final bounds
    if (b.x < -HALF_W + r) { b.x = -HALF_W + r; b.vx = Math.abs(b.vx) * RESTITUTION; }
    if (b.x > HALF_W - r) { b.x = HALF_W - r; b.vx = -Math.abs(b.vx) * RESTITUTION; }
    if (b.z < -HALF_L + r) { b.z = -HALF_L + r; b.vz = Math.abs(b.vz) * RESTITUTION; }
  }

  private checkBallBallCollisions(): void {
    const activeBalls = this.getActiveBalls();
    for (let i = 0; i < activeBalls.length; i++) {
      for (let j = i + 1; j < activeBalls.length; j++) {
        const a = activeBalls[i];
        const b = activeBalls[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const minDist = BALL_RADIUS * 2;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const nz = dz / dist;

          // Separate
          const overlap = (minDist - dist) / 2;
          a.x -= nx * overlap;
          a.z -= nz * overlap;
          b.x += nx * overlap;
          b.z += nz * overlap;

          // Elastic collision
          const relVx = a.vx - b.vx;
          const relVz = a.vz - b.vz;
          const relDot = relVx * nx + relVz * nz;

          if (relDot > 0) {
            a.vx -= relDot * nx;
            a.vz -= relDot * nz;
            b.vx += relDot * nx;
            b.vz += relDot * nz;
          }
        }
      }
    }
  }

  private collideSpinner(b: BallState, spinner: SpinnerDef): void {
    const dx = b.x - spinner.x;
    const dz = b.z - spinner.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Ball passes through spinner zone
    if (dist < spinner.width && Math.abs(b.vz) > 0.3) {
      // Impart spin proportional to ball speed
      const speed = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
      spinner.spinVel = speed * 30; // visual spin

      // Slight speed reduction as ball passes through
      b.vz *= 0.92;
      b.vx *= 0.95;

      // Score event per pass (throttle with distance check)
      this.collisionEvents.push({
        type: 'spinner', id: spinner.id,
        x: spinner.x, z: spinner.z,
        force: speed, ballId: b.id,
      });
    }
  }

  private checkRamp(b: BallState, ramp: RampDef): void {
    // Check if ball enters ramp entry zone (going upward = negative vz)
    const dx = b.x - ramp.entryX;
    const dz = b.z - ramp.entryZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < ramp.entryWidth && b.vz < -0.8 && !ramp.active) {
      // Ball enters ramp
      ramp.active = true;
      const speed = Math.sqrt(b.vx * b.vx + b.vz * b.vz);

      this.collisionEvents.push({
        type: 'ramp_enter', id: ramp.id,
        x: ramp.entryX, z: ramp.entryZ,
        force: speed, ballId: b.id,
      });

      // Teleport ball to ramp exit after short delay (simulated)
      b.x = ramp.exitX;
      b.z = ramp.exitZ;
      b.vx = ramp.exitVx * (speed * 0.6);
      b.vz = ramp.exitVz * (speed * 0.4);

      this.collisionEvents.push({
        type: 'ramp_exit', id: ramp.id,
        x: ramp.exitX, z: ramp.exitZ,
        force: speed, ballId: b.id,
      });

      // Reset ramp after brief cooldown
      setTimeout(() => { ramp.active = false; }, 500);
    }
  }

  private checkOutlane(b: BallState, outlane: OutlaneDef): void {
    const dx = Math.abs(b.x - outlane.x);
    const dz = Math.abs(b.z - outlane.z);

    if (dx < outlane.width / 2 && dz < 0.04 && b.vz > 0.1) {
      if (outlane.kickbackActive) {
        // Kickback! Save the ball
        outlane.kickbackActive = false;
        b.vz = -outlane.kickbackForce;
        b.vx = outlane.side === 'left' ? 0.5 : -0.5;

        this.collisionEvents.push({
          type: 'kickback', id: outlane.id,
          x: outlane.x, z: outlane.z,
          force: outlane.kickbackForce, ballId: b.id,
        });
      } else {
        // Outlane drain
        this.collisionEvents.push({
          type: 'outlane', id: outlane.id,
          x: outlane.x, z: outlane.z,
          force: 0, ballId: b.id,
        });
      }
    }
  }

  private collideWall(b: BallState, wall: WallSegment): void {
    const r = BALL_RADIUS;
    const dx = wall.x2 - wall.x1;
    const dz = wall.z2 - wall.z1;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 0.0001) return;

    let t = ((b.x - wall.x1) * dx + (b.z - wall.z1) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const closestX = wall.x1 + t * dx;
    const closestZ = wall.z1 + t * dz;
    const distX = b.x - closestX;
    const distZ = b.z - closestZ;
    const dist = Math.sqrt(distX * distX + distZ * distZ);

    if (dist < r && dist > 0.0001) {
      const nx = distX / dist;
      const nz = distZ / dist;

      b.x = closestX + nx * (r + 0.001);
      b.z = closestZ + nz * (r + 0.001);

      const dot = b.vx * nx + b.vz * nz;
      if (dot < 0) {
        b.vx -= (1 + RESTITUTION) * dot * nx;
        b.vz -= (1 + RESTITUTION) * dot * nz;

        const force = Math.abs(dot);
        if (force > 0.1) {
          this.collisionEvents.push({
            type: 'wall', id: wall.id, x: closestX, z: closestZ, force, ballId: b.id,
          });
        }
      }
    }
  }

  private collideBumper(b: BallState, bumper: CircleBumper): void {
    const r = BALL_RADIUS;
    const dx = b.x - bumper.x;
    const dz = b.z - bumper.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const minDist = r + bumper.radius;

    if (dist < minDist && dist > 0.001) {
      const nx = dx / dist;
      const nz = dz / dist;

      b.x = bumper.x + nx * (minDist + 0.001);
      b.z = bumper.z + nz * (minDist + 0.001);

      const currentSpeed = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
      const kickSpeed = Math.max(bumper.kickForce, currentSpeed * 0.8);
      b.vx = nx * kickSpeed;
      b.vz = nz * kickSpeed;

      this.collisionEvents.push({
        type: bumper.type === 'slingshot' ? 'slingshot' : 'bumper',
        id: bumper.id, x: bumper.x, z: bumper.z,
        force: kickSpeed, ballId: b.id,
      });
    }
  }

  private collideFlipper(b: BallState, flipper: FlipperState): void {
    const r = BALL_RADIUS;

    const tipX = flipper.pivotX + Math.cos(flipper.angle) * flipper.length;
    const tipZ = flipper.pivotZ + Math.sin(flipper.angle) * flipper.length;

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

    const flipperRadius = 0.008;
    const minDist = r + flipperRadius;

    if (dist < minDist && dist > 0.001) {
      const nx = distX / dist;
      const nz = distZ / dist;

      b.x = closestX + nx * (minDist + 0.001);
      b.z = closestZ + nz * (minDist + 0.001);

      const contactDist = t * flipper.length;
      const flipperVelX = -Math.sin(flipper.angle) * flipper.angularVel * contactDist;
      const flipperVelZ = Math.cos(flipper.angle) * flipper.angularVel * contactDist;

      const relVx = b.vx - flipperVelX;
      const relVz = b.vz - flipperVelZ;
      const relDot = relVx * nx + relVz * nz;

      if (relDot < 0) {
        b.vx -= (1 + 0.7) * relDot * nx;
        b.vz -= (1 + 0.7) * relDot * nz;
        b.vx += flipperVelX * 1.2;
        b.vz += flipperVelZ * 1.2;

        const force = Math.abs(relDot) + Math.abs(flipper.angularVel) * contactDist;
        if (force > 0.05) {
          this.collisionEvents.push({
            type: 'flipper', id: flipper.side,
            x: closestX, z: closestZ, force, ballId: b.id,
          });
        }
      }
    }
  }

  private updateCaptiveBalls(dt: number): void {
    for (const cap of this.captiveBalls) {
      // Apply spring force back to home position
      const dx = cap.homeX - cap.currentX;
      const dz = cap.homeZ - cap.currentZ;
      const springK = 50;
      cap.vx += dx * springK * dt;
      cap.vz += dz * springK * dt;

      // Damping
      cap.vx *= (1 - 5 * dt);
      cap.vz *= (1 - 5 * dt);

      cap.currentX += cap.vx * dt;
      cap.currentZ += cap.vz * dt;

      // Clamp movement range
      const maxDist = 0.04;
      const dist = Math.sqrt((cap.currentX - cap.homeX) ** 2 + (cap.currentZ - cap.homeZ) ** 2);
      if (dist > maxDist) {
        const scale = maxDist / dist;
        cap.currentX = cap.homeX + (cap.currentX - cap.homeX) * scale;
        cap.currentZ = cap.homeZ + (cap.currentZ - cap.homeZ) * scale;
      }
    }
  }

  private collideCaptiveBall(b: BallState, cap: CaptiveBallDef): void {
    const dx = b.x - cap.currentX;
    const dz = b.z - cap.currentZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const minDist = BALL_RADIUS + cap.radius;

    if (dist < minDist && dist > 0.001) {
      const nx = dx / dist;
      const nz = dz / dist;

      // Separate
      b.x = cap.currentX + nx * (minDist + 0.001);
      b.z = cap.currentZ + nz * (minDist + 0.001);

      // Transfer momentum
      const dot = b.vx * nx + b.vz * nz;
      if (dot < 0) {
        b.vx -= (1 + 0.6) * dot * nx;
        b.vz -= (1 + 0.6) * dot * nz;

        // Push captive ball
        cap.vx -= dot * nx * 0.8;
        cap.vz -= dot * nz * 0.8;

        const force = Math.abs(dot);
        if (force > 0.2) {
          this.collisionEvents.push({
            type: 'captive_ball', id: cap.id,
            x: cap.currentX, z: cap.currentZ,
            force, ballId: b.id,
          });
        }
      }
    }
  }

  private updateVUKs(dt: number): void {
    for (const vuk of this.vuks) {
      if (vuk.cooldown > 0) vuk.cooldown -= dt;
      if (vuk.captured && vuk.timer > 0) {
        vuk.timer -= dt;
        if (vuk.timer <= 0) {
          // Launch!
          vuk.captured = false;
          // Find the ball sitting in the VUK and launch it
          for (const b of this.balls) {
            if (b.active && Math.abs(b.x - vuk.x) < 0.03 && Math.abs(b.z - vuk.z) < 0.03) {
              b.vx = vuk.launchVx;
              b.vz = vuk.launchVz;
              break;
            }
          }
          vuk.cooldown = 1.0;
        }
      }
    }
  }

  private checkVUK(b: BallState, vuk: VUKDef): void {
    if (vuk.captured || vuk.cooldown > 0) return;

    const dx = b.x - vuk.x;
    const dz = b.z - vuk.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < vuk.radius && b.vz > 0.2) {
      // Capture ball
      vuk.captured = true;
      vuk.timer = 0.8; // Hold for 0.8 seconds then launch
      b.x = vuk.x;
      b.z = vuk.z;
      b.vx = 0;
      b.vz = 0;

      this.collisionEvents.push({
        type: 'vuk', id: vuk.id,
        x: vuk.x, z: vuk.z,
        force: 1.0, ballId: b.id,
      });
    }
  }

  getFlipperTip(flipper: FlipperState): Vec2 {
    return {
      x: flipper.pivotX + Math.cos(flipper.angle) * flipper.length,
      z: flipper.pivotZ + Math.sin(flipper.angle) * flipper.length,
    };
  }

  getBall3DY(tableY: number): number {
    return tableY + (HALF_L - this.ball.z) * Math.sin(TILT_ANGLE) + BALL_RADIUS + 0.001;
  }

  getBallY(b: BallState, tableY: number): number {
    return tableY + (HALF_L - b.z) * Math.sin(TILT_ANGLE) + BALL_RADIUS + 0.001;
  }

  // Reset outlane kickbacks (called when ball saver activates or new game)
  resetKickbacks(): void {
    for (const ol of this.outlanes) {
      ol.kickbackActive = true;
    }
  }
}
