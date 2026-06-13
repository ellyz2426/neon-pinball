// Neon Pinball VR - Proper ECS Game Loop System
// Round 9: Score popups, theme-reactive trails, tilt warnings, lane SFX, intensity edge glow

import {
  createSystem,
  Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  Color,
  PointLight,
  SphereGeometry,
  AdditiveBlending,
  Group,
} from '@iwsdk/core';

import { PinballPhysics, BALL_RADIUS, CollisionEvent } from './physics';
import { TABLE_Y } from './table';
import { GameManager, GameState, IntensityLevel, COMBO_TIERS } from './game';
import { AudioManager } from './audio';
import { EffectsManager } from './effects';
import { UIManager } from './ui';
import { XRInputHandler } from './xrinput';
import { AchievementManager } from './achievements';
import { EnvState, updateEnvironment } from './environment';
import { getTheme } from './themes';

export interface BallVisual {
  mesh: Mesh;
  glow: Mesh;
  ballId: number;
}

export interface GameLoopRefs {
  physics: PinballPhysics;
  game: GameManager;
  audio: AudioManager;
  achievements: AchievementManager;
  effects: EffectsManager;
  ui: UIManager;
  xrInput: XRInputHandler;
  world: any;
  tableGroup: Group;
  bumperMeshes: Map<string, { mesh: Mesh; glow: Mesh }>;
  flipperMeshes: { left: Mesh; right: Mesh };
  plungerMesh: Mesh;
  springMesh: Mesh;
  targetMeshes: Map<string, Mesh>;
  spinnerMeshes: Map<string, { gate: Mesh; post: Mesh }>;
  outlaneMeshes: Map<string, { indicator: Mesh; glow: Mesh }>;
  captiveBallMeshes: Map<string, { ball: Mesh; cradle: Mesh }>;
  vukMeshes: Map<string, { scoop: Mesh; glow: Mesh }>;
  tableLights: {
    main: PointLight | undefined;
    left: PointLight | undefined;
    right: PointLight | undefined;
  };
  envState: EnvState;
  laneIndicators: Mesh[];
  ballLockIndicators: Mesh[];
  skillShotZones: Mesh[];
  backglassScoreMesh: Mesh | null;
  legRings: Mesh[];
  ballSaverBar: Mesh;
}

export class PinballGameLoopSystem extends createSystem({}) {
  private refs!: GameLoopRefs;
  private ballVisuals: BallVisual[] = [];
  private keys: Record<string, boolean> = {};
  private plungerPower = 0;
  private plungerCharging = false;
  private trailCounter = 0;
  private gameTime = 0;
  private wizardPulseTime = 0;
  private spinnerCooldowns: Record<string, number> = {};
  private eventsWired = false;
  private initialized = false;

  // Camera tracking
  private cameraBaseY = 0;
  private cameraBaseZ = 0;
  private cameraSmoothX = 0;
  private cameraSmoothZ = 0;

  // Lane indicator animation
  private laneFlashTimers = [0, 0, 0];

  // Ball lock indicator animation
  private lockPulsePhase = 0;

  // Tilt visual warning state
  private tiltFlashTimer = 0;
  private tiltShakeIntensity = 0;

  // Table shake state (separate from tilt shake)
  private tableShakeTimer = 0;
  private tableShakeIntensity = 0;

  // Current theme trail color (updated on theme change)
  private trailColor = 0x00ffff;

  // Ball alive time tracking
  private ballAliveTimer = 0;

  // Jackpot flash state
  private jackpotFlashTimer = 0;

  // Drain proximity warning
  private drainWarningIntensity = 0;

  // High score approaching indicator
  private highScoreFlashTimer = 0;
  private wasApproachingHighScore = false;

  setRefs(refs: GameLoopRefs): void {
    this.refs = refs;
  }

  init(): void {
    // Keyboard listeners — refs accessed inside callbacks only (fired after setRefs)
    document.addEventListener('keydown', (e) => {
      if (!this.refs) return;
      this.keys[e.code] = true;
      const { game, audio, achievements } = this.refs;

      if (e.code === 'Escape') {
        if (game.state === 'playing' || game.state === 'plunger') {
          game.setState('paused');
        } else if (game.state === 'paused') {
          game.setState('playing');
        }
      }
      if (e.code === 'Space' && game.state === 'plunger') {
        this.plungerCharging = true;
      }
      if (e.code === 'Space' && game.state === 'title') {
        audio.init();
        audio.resume();
        audio.startAmbient();
        game.startGame();
        achievements.startGame();
      }
      if (e.code === 'KeyZ' && game.state === 'playing') {
        game.activateMagnaSave('left');
      }
      if (e.code === 'KeyC' && game.state === 'playing') {
        game.activateMagnaSave('right');
      }
    });

    document.addEventListener('keyup', (e) => {
      if (!this.refs) return;
      this.keys[e.code] = false;
      if (e.code === 'Space' && this.plungerCharging) {
        this.plungerCharging = false;
        if (this.plungerPower > 0.05) {
          const { physics, audio, game } = this.refs;
          const launchPower = this.plungerPower;
          physics.launchBall(this.plungerPower);
          audio.playLaunch();
          game.setState('playing');
          game.handleSkillShot(launchPower, physics.ball.x, physics.ball.z);
        }
        this.plungerPower = 0;
      }
    });

    // Ref-dependent init deferred to first update() frame
  }

  private createBallVisual(id: number): BallVisual {
    const { tableGroup } = this.refs;
    const ballGeo = new SphereGeometry(BALL_RADIUS, 16, 12);
    const ballMat = new MeshStandardMaterial({
      color: new Color(0xffffff),
      emissive: new Color(0x00ffff),
      emissiveIntensity: 0.8,
      metalness: 0.9,
      roughness: 0.1,
    });
    const mesh = new Mesh(ballGeo, ballMat);
    mesh.visible = false;
    tableGroup.add(mesh);

    const glowGeo = new SphereGeometry(BALL_RADIUS * 2, 8, 6);
    const glowMat = new MeshBasicMaterial({
      color: new Color(0x00ffff),
      transparent: true,
      opacity: 0.3,
      blending: AdditiveBlending,
    });
    const glow = new Mesh(glowGeo, glowMat);
    glow.visible = false;
    tableGroup.add(glow);

    return { mesh, glow, ballId: id };
  }

  private ensureBallVisual(ballId: number): BallVisual {
    let bv = this.ballVisuals.find(v => v.ballId === ballId);
    if (!bv) {
      bv = this.createBallVisual(ballId);
      this.ballVisuals.push(bv);
    }
    return bv;
  }

  private hideAllBalls(): void {
    for (const bv of this.ballVisuals) {
      bv.mesh.visible = false;
      bv.glow.visible = false;
    }
  }

  private cleanupInactiveBalls(): void {
    const { physics } = this.refs;
    const activeBallIds = new Set(physics.getActiveBalls().map(b => b.id));
    for (const bv of this.ballVisuals) {
      if (!activeBallIds.has(bv.ballId)) {
        bv.mesh.visible = false;
        bv.glow.visible = false;
      }
    }
  }

  private wireGameEvents(): void {
    if (this.eventsWired) return;
    this.eventsWired = true;
    const { game, audio, physics, effects, achievements } = this.refs;

    game.onStateChange((state: GameState) => {
      this.refs.ui.showState(state);
      if (state === 'plunger') {
        physics.resetBall();
        this.ensureBallVisual(physics.ball.id);
        this.plungerPower = 0;
        this.plungerCharging = false;
      } else if (state === 'gameover') {
        audio.playGameOver();
        audio.stopMultiballMusic();
        this.hideAllBalls();
        achievements.checkNoTilt();
        achievements.resetRoundStats();
      } else if (state === 'title') {
        this.hideAllBalls();
        audio.stopAmbient();
        physics.resetAllBalls();
      }
    });

    game.onScore((_points: number, label: string, x: number, z: number) => {
      if (label.includes('JACKPOT')) {
        audio.playJackpot();
        achievements.checkJackpot();
      } else if (label.includes('BONUS')) {
        audio.playCombo();
      } else if (label.includes('LOCKED')) {
        audio.playBallLock();
      }
      if (label.includes('SUPER JACKPOT')) {
        audio.playSuperJackpot();
        achievements.checkSuperJackpot();
      }

      // Score popup at hit location
      if (_points >= 500 && (x !== 0 || z !== 0)) {
        const theme = getTheme(game.currentThemeId);
        const color = _points >= 50000 ? 0xffff00 :
                      _points >= 10000 ? 0xff00ff :
                      _points >= 5000 ? theme.accentPrimary :
                      theme.ballGlow;
        effects.spawnScorePopup(x, z, _points, color);
      }

      // Table shake on big scores
      if (_points >= 10000) {
        this.tableShakeTimer = 0.2;
        this.tableShakeIntensity = Math.min(0.003, _points / 5000000);
      }

      // Jackpot flash
      if (label.includes('JACKPOT')) {
        this.jackpotFlashTimer = 0.4;
      }
    });

    game.onMessage((msg: string) => {
      this.refs.ui.showMessage(msg);
      if (msg.includes('SAVED')) audio.playBallSaved();
      if (msg.includes('MISSION COMPLETE')) {
        audio.playMissionComplete();
        if (game.completedMissionTypes.size > 0) {
          const lastType = Array.from(game.completedMissionTypes).pop();
          if (lastType) achievements.checkMissionComplete(lastType);
        }
      }
      if (msg.includes('SUPER RAMP')) achievements.checkSuperRamp();
      if (msg.includes('EXTRA BALL')) achievements.checkExtraBall();
    });

    game.onMultiball((active: boolean, count: number) => {
      if (active) {
        audio.playMultiballStart();
        achievements.checkMultiball();
        const positions = [
          { x: -0.15, z: -0.2, vx: 0.3, vz: 0.5 },
          { x: 0.15, z: -0.2, vx: -0.3, vz: 0.5 },
          { x: 0, z: -0.3, vx: 0.1, vz: 0.8 },
        ];
        for (let i = 0; i < count - 1 && i < positions.length; i++) {
          const p = positions[i];
          const b = physics.spawnExtraBall(p.x, p.z, p.vx, p.vz);
          this.ensureBallVisual(b.id);
        }
      } else {
        audio.stopMultiballMusic();
        this.cleanupInactiveBalls();
      }
    });

    game.onWizardMode((active: boolean) => {
      if (active) {
        achievements.checkWizardMode();
        effects.spawnWizardBurst(0, 0);
      }
    });

    game.onMagnaSave((_side, active) => {
      if (active) {
        audio.playMagnaSave();
        achievements.checkMagnaSave();
      }
    });

    game.onSkillShot((zone) => {
      if (zone) {
        audio.playSkillShot(zone.name as 'GOOD' | 'GREAT' | 'PERFECT');
        achievements.checkSkillShot(zone.name);
      }
    });

    game.onMatch((_number, matched) => {
      if (matched) audio.playMatchWin();
    });

    game.onComboTier((tier) => {
      if (tier) {
        achievements.checkComboTier(tier);
        // Visual escalation based on combo tier
        const tierDef = COMBO_TIERS.find(t => t.name === tier);
        if (tierDef) {
          const color = parseInt(tierDef.color.replace('#', ''), 16);
          // Burst particles at center of table
          effects.spawnPulseRing(0, 0, color);
          // Bigger burst for higher tiers
          const idx = COMBO_TIERS.indexOf(tierDef);
          if (idx >= 4) {
            effects.spawnWizardBurst(0, 0);
          } else if (idx >= 2) {
            effects.spawnBumperHit(0, 0, color);
          }
        }
      }
    });

    game.onLaneComplete((lanes) => {
      // Flash lane indicators when a lane is hit
      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i]) {
          this.laneFlashTimers[i] = 0.5;
        }
      }
      // Play lane completion sound and check achievement when all lanes are lit
      if (lanes.every(l => l)) {
        audio.playLaneComplete();
        achievements.checkLaneComplete();
      }
    });

    // Tilt warning visual + audio
    game.onTilt((tilted) => {
      achievements.recordTiltWarning();
      if (tilted) {
        // Full tilt
        audio.playTiltFull();
        effects.spawnTiltWarning();
        this.tiltFlashTimer = 0.8;
        this.tiltShakeIntensity = 0.006;
      } else {
        // Warning
        audio.playTiltWarning();
        effects.spawnTiltWarning();
        this.tiltFlashTimer = 0.3;
        this.tiltShakeIntensity = 0.003;
      }
    });

    game.onCaptiveBall((hits) => {
      achievements.checkCaptiveBall(hits);
    });

    game.onBonus((data) => {
      achievements.checkBonusTotal(data.totalBonus);
    });
  }

  // The per-frame tick — called by IWSDK's ECS loop
  update(delta: number, time: number): void {
    if (!this.refs) return;

    // Lazy init: runs once on first frame after setRefs
    if (!this.initialized) {
      this.initialized = true;
      this.ballVisuals.push(this.createBallVisual(0));
      this.wireGameEvents();

      // Store initial camera position for tracking
      const cam = this.refs.world.camera;
      this.cameraBaseY = cam.position.y;
      this.cameraBaseZ = cam.position.z;
      this.cameraSmoothX = 0;
      this.cameraSmoothZ = 0;
    }

    const dt = Math.min(delta, 0.033);
    this.gameTime += dt;

    const {
      physics, game, audio, achievements, effects, ui, xrInput,
      flipperMeshes, plungerMesh, springMesh,
      targetMeshes, spinnerMeshes, outlaneMeshes,
      captiveBallMeshes, vukMeshes, bumperMeshes,
    } = this.refs;

    // Environment animation (inside ECS loop, not setInterval)
    // Environment animation with intensity-reactive speed
    const intensityMul = game.intensity === 'frenzy' ? 2.5 :
                         game.intensity === 'heated' ? 1.8 :
                         game.intensity === 'normal' ? 1.3 : 1.0;
    updateEnvironment(this.refs.envState, this.gameTime, dt, intensityMul);

    xrInput.update(dt);
    game.update(dt);
    ui.update(dt);
    this.updateIntensityVisuals(dt);

    // Update spinner cooldowns
    for (const key of Object.keys(this.spinnerCooldowns)) {
      this.spinnerCooldowns[key] -= dt;
      if (this.spinnerCooldowns[key] <= 0) delete this.spinnerCooldowns[key];
    }

    if (game.state === 'playing' || game.state === 'plunger') {
      // Flipper input
      const leftFlip = this.keys['KeyA'] || this.keys['ArrowLeft'] || xrInput.leftFlipperPressed;
      const rightFlip = this.keys['KeyD'] || this.keys['ArrowRight'] || xrInput.rightFlipperPressed;
      physics.setFlipperActive('left', leftFlip);
      physics.setFlipperActive('right', rightFlip);

      // Plunger input
      if (game.state === 'plunger') {
        if (this.plungerCharging) {
          this.plungerPower = Math.min(1, this.plungerPower + dt * 1.2);
        }
        if (xrInput.launchHeld) {
          this.plungerPower = Math.min(1, this.plungerPower + dt * 1.2);
        } else if (xrInput.launchPressed && this.plungerPower > 0.05) {
          const launchPower = this.plungerPower;
          physics.launchBall(this.plungerPower);
          audio.playLaunch();
          game.setState('playing');
          game.handleSkillShot(launchPower, physics.ball.x, physics.ball.z);
          this.plungerPower = 0;
        }
        plungerMesh.position.z = 0.47 + this.plungerPower * 0.03;
        springMesh.scale.z = 1 - this.plungerPower * 0.5;
        ui.updatePlungerPower(this.plungerPower);
      }

      // Nudge
      const nudgeL = this.keys['KeyQ'] || xrInput.nudgeLeft;
      const nudgeR = this.keys['KeyE'] || xrInput.nudgeRight;
      if ((nudgeL || nudgeR) && !game.tilted) {
        const allowed = game.handleNudge();
        if (allowed) {
          for (const b of physics.getActiveBalls()) {
            if (nudgeL) b.vx -= 0.3 * dt;
            if (nudgeR) b.vx += 0.3 * dt;
          }
        }
      }

      if (game.tilted) {
        physics.setFlipperActive('left', false);
        physics.setFlipperActive('right', false);
      }

      // Magna-Save
      const magnaSaveForce = game.getMagnaSaveForce();
      if (magnaSaveForce && game.state === 'playing') {
        for (const b of physics.getActiveBalls()) {
          b.vx += magnaSaveForce.fx * dt;
          b.vz += magnaSaveForce.fz * dt;
        }
      }

      // Physics update
      if (game.state === 'playing') {
        const events = physics.update(dt);
        this.handleCollisionEvents(events);
      }

      // Target collisions
      const targetPositions = [-0.16, -0.08, 0, 0.08, 0.16];
      const targetZ = -0.45;
      if (game.state === 'playing') {
        for (const b of physics.getActiveBalls()) {
          for (let i = 0; i < 5; i++) {
            const tx = targetPositions[i];
            const dx = b.x - tx;
            const dz = b.z - targetZ;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < BALL_RADIUS + 0.015 && game.targets[i].active) {
              game.handleTargetHit(`target-${i}`, tx, targetZ);
              audio.playTargetHit();
              effects.spawnTargetHit(tx, targetZ, [0xff0044, 0xff8800, 0xffff00, 0x00ff88, 0x0088ff][i]);
              b.vz = Math.abs(b.vz) * 0.8;

              const mesh = targetMeshes.get(`target-${i}`);
              if (mesh) {
                mesh.visible = false;
                const idx = i;
                const checkReset = () => {
                  if (game.targets[idx].active) {
                    const m = targetMeshes.get(`target-${idx}`);
                    if (m) m.visible = true;
                  } else {
                    setTimeout(checkReset, 500);
                  }
                };
                setTimeout(checkReset, 500);
              }
            }
          }

          if (game.rampCombo >= 5) {
            this.refs.achievements.checkRampCombo(game.rampCombo);
          }

          // Lane detection
          if (b.x < -0.10 && b.x > -0.15 && b.z > 0.04 && b.z < 0.20 && b.vz < -0.3) {
            game.handleLaneHit(0, b.x, b.z);
          }
          if (b.x > -0.02 && b.x < 0.02 && b.z > 0.06 && b.z < 0.17 && b.vz < -0.3) {
            game.handleLaneHit(1, b.x, b.z);
          }
          if (b.x > 0.10 && b.x < 0.15 && b.z > 0.04 && b.z < 0.20 && b.vz < -0.3) {
            game.handleLaneHit(2, b.x, b.z);
          }
        }
      }

      // Update ball visuals
      for (const b of physics.balls) {
        const bv = this.ballVisuals.find(v => v.ballId === b.id);
        if (!bv) continue;

        if (b.active) {
          bv.mesh.position.set(b.x, physics.getBallY(b, 0) - TABLE_Y, b.z);
          bv.mesh.visible = true;
          bv.glow.position.copy(bv.mesh.position);
          bv.glow.visible = true;

          if (b === physics.ball) {
            this.trailCounter += dt;
            if (this.trailCounter > 0.03) {
              this.trailCounter = 0;
              const speed = Math.sqrt(b.vx ** 2 + b.vz ** 2);
              if (speed > 0.3) {
                // Use theme-reactive trail color
                const theme = getTheme(game.currentThemeId);
                this.trailColor = theme.ballGlow;
                effects.addTrailPoint(b.x, physics.getBallY(b, 0) - TABLE_Y, b.z, this.trailColor);
              }
            }
          }

          const speed = Math.sqrt(b.vx ** 2 + b.vz ** 2);
          (bv.glow.material as MeshBasicMaterial).opacity = 0.2 + Math.min(0.5, speed * 0.15);

          if (!game.wizardModeActive && b !== physics.ball && game.multiballActive) {
            (bv.mesh.material as MeshStandardMaterial).emissive.setHex(0xff00ff);
          } else if (!game.wizardModeActive) {
            const theme = getTheme(game.currentThemeId);
            (bv.mesh.material as MeshStandardMaterial).emissive.setHex(theme.ballEmissive);
            (bv.glow.material as MeshBasicMaterial).color.setHex(theme.ballGlow);
          }
        } else {
          bv.mesh.visible = false;
          bv.glow.visible = false;
        }
      }

      // Update flipper visuals
      flipperMeshes.left.rotation.y = -physics.leftFlipper.angle;
      flipperMeshes.right.rotation.y = -(physics.rightFlipper.angle - Math.PI);

      // Flipper glow: brighter emissive when active
      const leftActive = this.keys['KeyA'] || this.keys['ArrowLeft'];
      const rightActive = this.keys['KeyD'] || this.keys['ArrowRight'];
      const leftMat = flipperMeshes.left.material as MeshStandardMaterial;
      const rightMat = flipperMeshes.right.material as MeshStandardMaterial;
      leftMat.emissiveIntensity = leftActive ? 1.5 : 0.4;
      rightMat.emissiveIntensity = rightActive ? 1.5 : 0.4;

      // Update spinner visuals
      for (const spinner of physics.spinners) {
        const sm = spinnerMeshes.get(spinner.id);
        if (sm) {
          sm.gate.rotation.y = spinner.spinAngle;
          const intensity = Math.min(1, Math.abs(spinner.spinVel) / 20);
          (sm.gate.material as MeshStandardMaterial).emissiveIntensity = 0.3 + intensity * 0.7;
        }
      }

      // Update outlane indicators
      for (const outlane of physics.outlanes) {
        const om = outlaneMeshes.get(outlane.id);
        if (om) {
          const color = outlane.kickbackActive ? 0x00ff88 : 0x440000;
          (om.indicator.material as MeshBasicMaterial).color.setHex(color);
          (om.indicator.material as MeshBasicMaterial).opacity = outlane.kickbackActive ? 0.7 : 0.2;
        }
      }

      // Update captive ball
      for (const cap of physics.captiveBalls) {
        const cm = captiveBallMeshes.get(cap.id);
        if (cm) {
          cm.ball.position.set(cap.currentX, 0.013 + 0.003, cap.currentZ);
        }
      }

      // Update VUK visuals
      for (const vuk of physics.vuks) {
        const vm = vukMeshes.get(vuk.id);
        if (vm) {
          if (vuk.captured) {
            (vm.glow.material as MeshBasicMaterial).opacity = 0.5 + Math.sin(this.gameTime * 15) * 0.3;
            (vm.scoop.material as MeshStandardMaterial).emissiveIntensity = 0.5 + Math.sin(this.gameTime * 15) * 0.3;
          } else {
            (vm.glow.material as MeshBasicMaterial).opacity = 0.3 + Math.sin(this.gameTime * 2) * 0.1;
            (vm.scoop.material as MeshStandardMaterial).emissiveIntensity = 0.3;
          }
        }
      }

      ui.updateHUD();

      // Track ball alive time for achievements
      if (game.state === 'playing' && physics.ball.active) {
        this.ballAliveTimer += dt;
        achievements.checkBallAliveTime(this.ballAliveTimer);
      }

      // === Table shake on big hits ===
      if (this.tableShakeTimer > 0) {
        this.tableShakeTimer -= dt;
        const shake = this.tableShakeIntensity * (this.tableShakeTimer / 0.2);
        this.refs.tableGroup.position.x = (Math.random() - 0.5) * shake * 2;
        this.refs.tableGroup.position.z += (Math.random() - 0.5) * shake;
      } else {
        // Restore table position (Y stays at TABLE_Y)
        this.refs.tableGroup.position.x = 0;
      }

      // === Jackpot flash — briefly boost all table lights ===
      if (this.jackpotFlashTimer > 0) {
        this.jackpotFlashTimer -= dt;
        const flash = Math.sin(this.jackpotFlashTimer * 25) > 0;
        const tl = this.refs.tableLights;
        if (tl.main) tl.main.intensity = flash ? 3.0 : 1.0;
        if (tl.left) tl.left.intensity = flash ? 2.0 : 0.6;
        if (tl.right) tl.right.intensity = flash ? 2.0 : 0.4;
      }

      // === Dynamic camera tracking ===
      // Subtly follow the primary ball's position for more engaging gameplay
      if (game.state === 'playing' && !this.refs.world.xr?.session) {
        const cam = this.refs.world.camera;
        const ball = physics.ball;
        if (ball.active) {
          // Target: shift camera slightly toward ball X, and adjust Z based on ball depth
          const targetX = ball.x * 0.15; // subtle X tracking
          const targetZ = ball.z * 0.08; // subtle Z tracking
          this.cameraSmoothX += (targetX - this.cameraSmoothX) * dt * 2;
          this.cameraSmoothZ += (targetZ - this.cameraSmoothZ) * dt * 2;
          cam.position.x = this.cameraSmoothX;
          cam.position.z = this.cameraBaseZ + this.cameraSmoothZ;
        } else {
          // Return to center when ball is inactive
          this.cameraSmoothX += (0 - this.cameraSmoothX) * dt * 3;
          this.cameraSmoothZ += (0 - this.cameraSmoothZ) * dt * 3;
          cam.position.x = this.cameraSmoothX;
          cam.position.z = this.cameraBaseZ + this.cameraSmoothZ;
        }

        // === Tilt visual shake ===
        if (this.tiltFlashTimer > 0) {
          this.tiltFlashTimer -= dt;
          const shake = this.tiltShakeIntensity * (this.tiltFlashTimer / 0.8);
          cam.position.x += (Math.random() - 0.5) * shake * 2;
          cam.position.y = this.cameraBaseY + (Math.random() - 0.5) * shake;

          // Flash table lights red during tilt warning
          const tl = this.refs.tableLights;
          if (tl.main) {
            const flash = Math.sin(this.tiltFlashTimer * 30) > 0 ? 2.5 : 0.5;
            tl.main.intensity = flash;
            tl.main.color.setHex(0xff2200);
          }
        } else {
          this.tiltShakeIntensity = 0;
          // Restore normal camera Y
          cam.position.y = this.cameraBaseY;
        }
      }

      // === Lane completion indicators ===
      const { laneIndicators } = this.refs;
      if (laneIndicators && laneIndicators.length === 3) {
        for (let i = 0; i < 3; i++) {
          const lit = game.laneStates[i];
          const indicator = laneIndicators[i];
          const mat = indicator.material as MeshBasicMaterial;

          if (this.laneFlashTimers[i] > 0) {
            this.laneFlashTimers[i] -= dt;
            mat.opacity = 0.6 + Math.sin(this.laneFlashTimers[i] * 20) * 0.3;
          } else if (lit) {
            mat.opacity = 0.7 + Math.sin(this.gameTime * 3 + i) * 0.2;
          } else {
            mat.opacity = 0.15;
          }
        }
      }

      // === Ball lock indicators ===
      const { ballLockIndicators } = this.refs;
      if (ballLockIndicators && ballLockIndicators.length > 0) {
        this.lockPulsePhase += dt;
        for (let i = 0; i < ballLockIndicators.length; i++) {
          const ind = ballLockIndicators[i];
          const mat = ind.material as MeshBasicMaterial;
          if (i < game.ballsLocked) {
            // Locked: bright steady glow
            mat.opacity = 0.8;
            mat.color.setHex(0x00ff88);
          } else if (i === game.ballsLocked && game.ballsLocked < game.maxLockBalls && !game.multiballActive) {
            // Next to lock: pulsing
            mat.opacity = 0.3 + Math.sin(this.lockPulsePhase * 4) * 0.3;
            mat.color.setHex(0xffff00);
          } else {
            // Empty: dim
            mat.opacity = 0.1;
            mat.color.setHex(0x444466);
          }
        }
      }

      // === Skill shot zone animation ===
      const { skillShotZones } = this.refs;
      if (skillShotZones && skillShotZones.length > 0) {
        const inPlunger = game.state === 'plunger';
        for (let i = 0; i < skillShotZones.length; i++) {
          const zone = skillShotZones[i];
          const mat = zone.material as MeshBasicMaterial;
          if (inPlunger) {
            // Animate zones during plunger phase - wave pattern
            const wave = Math.sin(this.gameTime * 3 - i * 0.8);
            mat.opacity = 0.4 + wave * 0.3;
            const scale = 1.0 + wave * 0.15;
            zone.scale.set(scale, 1, scale);
          } else {
            mat.opacity = 0.2;
            zone.scale.set(1, 1, 1);
          }
        }
      }

      // === Backglass score display ===
      if (this.refs.backglassScoreMesh) {
        const mat = this.refs.backglassScoreMesh.material as MeshBasicMaterial;
        if (game.state === 'playing' || game.state === 'plunger') {
          // Pulse brightness based on intensity
          const baseBright = game.intensity === 'frenzy' ? 1.0 :
                             game.intensity === 'heated' ? 0.8 :
                             game.intensity === 'normal' ? 0.6 : 0.4;
          mat.opacity = baseBright + Math.sin(this.gameTime * 2) * 0.1;
        } else {
          mat.opacity = 0.3 + Math.sin(this.gameTime) * 0.1;
        }
      }

      // === Ball saver indicator ===
      if (this.refs.ballSaverBar) {
        const saverMat = this.refs.ballSaverBar.material as MeshBasicMaterial;
        if (game.ballSaverActive && game.ballSaverTimer > 0) {
          const pct = game.ballSaverTimer / game.ballSaverDuration;
          // Bright green that fades to red as timer runs out
          saverMat.opacity = 0.5 + Math.sin(this.gameTime * 6) * 0.2;
          if (pct > 0.5) {
            saverMat.color.setHex(0x00ff88);
          } else if (pct > 0.25) {
            saverMat.color.setHex(0xffff00);
          } else {
            saverMat.color.setHex(0xff4400);
            // Urgent flashing when almost out
            saverMat.opacity = Math.sin(this.gameTime * 15) > 0 ? 0.8 : 0.2;
          }
          // Scale width proportional to remaining time
          this.refs.ballSaverBar.scale.x = pct;
        } else {
          saverMat.opacity = 0;
          this.refs.ballSaverBar.scale.x = 1;
        }
      }

      // === Table leg neon ring animation ===
      const { legRings } = this.refs;
      if (legRings && legRings.length > 0) {
        const pulseSpeed = game.intensity === 'frenzy' ? 8 :
                           game.intensity === 'heated' ? 5 :
                           game.intensity === 'normal' ? 3 : 1.5;
        const baseOpacity = game.intensity === 'frenzy' ? 0.8 :
                            game.intensity === 'heated' ? 0.6 :
                            game.intensity === 'normal' ? 0.5 : 0.35;
        const theme = getTheme(game.currentThemeId);
        for (let i = 0; i < legRings.length; i++) {
          const ring = legRings[i];
          const mat = ring.material as MeshBasicMaterial;
          // Stagger phase per ring for traveling wave
          const phase = this.gameTime * pulseSpeed + i * 1.5;
          mat.opacity = baseOpacity + Math.sin(phase) * 0.25;
          mat.color.setHex(game.wizardModeActive
            ? new Color().setHSL((this.gameTime * 0.5 + i * 0.25) % 1, 1, 0.5).getHex()
            : theme.accentPrimary);
          // Subtle scale pulse
          const scale = 1.0 + Math.sin(phase) * 0.15;
          ring.scale.set(scale, 1, scale);
        }
      }

      // === Idle bumper pulse animation ===
      // Bumpers gently pulse even when not being hit, inviting attention
      for (const [id, entry] of bumperMeshes) {
        if (id.startsWith('pop-')) {
          const bMat = entry.mesh.material as MeshStandardMaterial;
          const gMat = entry.glow.material as MeshBasicMaterial;
          // Offset phase per bumper for organic feel
          const offset = id === 'pop-center' ? 0 : id === 'pop-left' ? 2.1 : 4.2;
          const pulse = 0.3 + Math.sin(this.gameTime * 1.5 + offset) * 0.1;
          const glowPulse = 0.25 + Math.sin(this.gameTime * 1.5 + offset) * 0.08;
          // Don't override if bumper was just hit (flash handles that)
          if (bMat.emissiveIntensity < 1.0) {
            bMat.emissiveIntensity = pulse;
          }
          if (gMat.opacity < 0.5) {
            gMat.opacity = glowPulse;
          }
        }
      }

      // === Drain proximity warning ===
      // When ball is in danger zone near drain, flash the table edges red
      if (game.state === 'playing') {
        let maxDrainProximity = 0;
        for (const b of physics.getActiveBalls()) {
          // Ball is in danger when Z > 0.35 and X is in drain lane
          if (b.z > 0.35 && Math.abs(b.x) < 0.15) {
            const prox = (b.z - 0.35) / 0.15; // 0 at z=0.35, 1 at z=0.50
            maxDrainProximity = Math.max(maxDrainProximity, Math.min(1, prox));
          }
        }
        this.drainWarningIntensity += (maxDrainProximity - this.drainWarningIntensity) * dt * 8;
        if (this.drainWarningIntensity > 0.05) {
          // Pulse the ball saver bar red if saver is inactive
          if (!game.ballSaverActive && this.refs.ballSaverBar) {
            const warnMat = this.refs.ballSaverBar.material as MeshBasicMaterial;
            warnMat.color.setHex(0xff0022);
            warnMat.opacity = this.drainWarningIntensity * 0.6 * (0.5 + Math.sin(this.gameTime * 12) * 0.5);
          }
        }
      }

      // === High score approach indicator ===
      if (game.state === 'playing' && game.highScore > 0) {
        const isApproaching = game.score > game.highScore * 0.8 && game.score < game.highScore;
        const justBeat = game.score >= game.highScore && !this.wasApproachingHighScore;
        if (justBeat) {
          this.highScoreFlashTimer = 1.5;
          this.wasApproachingHighScore = true;
        }
        if (this.highScoreFlashTimer > 0) {
          this.highScoreFlashTimer -= dt;
          // Golden flash on backglass when high score is beaten
          if (this.refs.backglassScoreMesh) {
            const bMat = this.refs.backglassScoreMesh.material as MeshBasicMaterial;
            const flash = Math.sin(this.highScoreFlashTimer * 15) > 0;
            bMat.color.setHex(flash ? 0xffdd00 : 0x00ffff);
            bMat.opacity = 0.8 + Math.sin(this.highScoreFlashTimer * 8) * 0.2;
          }
        } else if (isApproaching) {
          // Subtle golden tint when approaching high score
          if (this.refs.backglassScoreMesh) {
            const bMat = this.refs.backglassScoreMesh.material as MeshBasicMaterial;
            const mix = (game.score - game.highScore * 0.8) / (game.highScore * 0.2);
            const r = mix;
            const g = 0.8 + mix * 0.2;
            const b = 1.0 - mix * 0.8;
            bMat.color.setRGB(r, g, b);
          }
        }
      } else {
        this.wasApproachingHighScore = false;
      }
    }

    // Pause input
    if (xrInput.pausePressed) {
      if (game.state === 'playing' || game.state === 'plunger') {
        game.setState('paused');
      } else if (game.state === 'paused') {
        game.setState('playing');
      }
    }

    if (xrInput.magnaSaveLeftPressed && game.state === 'playing') {
      game.activateMagnaSave('left');
    }
    if (xrInput.magnaSaveRightPressed && game.state === 'playing') {
      game.activateMagnaSave('right');
    }

    effects.update(dt);
  }

  private updateIntensityVisuals(dt: number): void {
    const { game, tableLights } = this.refs;
    const intensity = game.intensity;

    if (tableLights.main) {
      const targetIntensity = intensity === 'frenzy' ? 2.5 : intensity === 'heated' ? 1.8 : intensity === 'normal' ? 1.4 : 1.2;
      tableLights.main.intensity += (targetIntensity - tableLights.main.intensity) * dt * 3;
    }

    if (game.wizardModeActive) {
      this.wizardPulseTime += dt * 4;
      const pulse = 0.5 + Math.sin(this.wizardPulseTime) * 0.5;

      if (tableLights.left) {
        tableLights.left.color.setHSL((this.gameTime * 0.3) % 1, 1, 0.5);
        tableLights.left.intensity = 1.0 + pulse * 0.5;
      }
      if (tableLights.right) {
        tableLights.right.color.setHSL(((this.gameTime * 0.3) + 0.33) % 1, 1, 0.5);
        tableLights.right.intensity = 0.8 + pulse * 0.4;
      }

      for (const bv of this.ballVisuals) {
        if (bv.mesh.visible) {
          const hue = (this.gameTime * 0.5 + bv.ballId * 0.25) % 1;
          (bv.mesh.material as MeshStandardMaterial).emissive.setHSL(hue, 1, 0.5);
          (bv.glow.material as MeshBasicMaterial).color.setHSL(hue, 1, 0.5);
        }
      }
    } else {
      this.wizardPulseTime = 0;
      if (tableLights.left) {
        tableLights.left.color.lerp(new Color(0xff00ff), dt * 2);
        tableLights.left.intensity += (0.6 - tableLights.left.intensity) * dt * 2;
      }
      if (tableLights.right) {
        tableLights.right.color.lerp(new Color(0x00ff88), dt * 2);
        tableLights.right.intensity += (0.4 - tableLights.right.intensity) * dt * 2;
      }
    }
  }

  private handleCollisionEvents(events: CollisionEvent[]): void {
    const { game, audio, effects, bumperMeshes, physics } = this.refs;

    for (const event of events) {
      switch (event.type) {
        case 'bumper':
          game.handleBumperHit(event.id || '', event.x, event.z);
          audio.playBumperHit(event.id);
          effects.spawnBumperHit(event.x, event.z, this.getBumperColor(event.id));
          effects.flashBumper(bumperMeshes, event.id || '');
          // Micro table shake on bumper hits
          if (this.tableShakeTimer <= 0) {
            this.tableShakeTimer = 0.08;
            this.tableShakeIntensity = 0.001;
          }
          break;

        case 'slingshot':
          game.handleSlingshotHit(event.id || '', event.x, event.z);
          audio.playSlingshotHit();
          effects.spawnBumperHit(event.x, event.z, 0xffff00);
          effects.flashBumper(bumperMeshes, event.id || '');
          break;

        case 'flipper':
          game.handleFlipperHit(event.x, event.z);
          audio.playFlipperClick();
          break;

        case 'wall':
          if (event.force > 0.3) audio.playWallBounce();
          break;

        case 'drain': {
          audio.playDrain();
          effects.spawnDrain(event.x, event.z);
          const result = game.handleDrain();
          if (result.saved) {
            physics.resetBall();
            this.refs.achievements.checkBallSaved();
          } else if (result.isMultiballDrain) {
            this.cleanupInactiveBalls();
          }
          // Reset ball alive timer on drain (new ball)
          this.ballAliveTimer = 0;
          break;
        }

        case 'spinner': {
          const sid = event.id || '';
          if (!this.spinnerCooldowns[sid]) {
            game.handleSpinnerHit(sid, event.x, event.z);
            audio.playSpinnerHit();
            effects.spawnBumperHit(event.x, event.z, 0xffff00);
            this.spinnerCooldowns[sid] = 0.15;
            game.advanceOrbit(2, event.x, event.z);
          }
          break;
        }

        case 'ramp_enter':
          audio.playRampEnter();
          effects.spawnRampTrail(event.x, event.z);
          break;

        case 'ramp_exit':
          audio.playRampExit();
          game.handleRampShot(event.id || '', event.x, event.z);
          effects.spawnBumperHit(event.x, event.z, event.id === 'ramp-left' ? 0xff00ff : 0x00ff88);
          if (event.id === 'ramp-left') game.advanceOrbit(1, event.x, event.z);
          else if (event.id === 'ramp-right') game.advanceOrbit(3, event.x, event.z);
          break;

        case 'kickback':
          game.handleKickback(event.id || '', event.x, event.z);
          audio.playKickback();
          effects.spawnBumperHit(event.x, event.z, 0x00ff88);
          break;

        case 'captive_ball':
          game.handleCaptiveBallHit(event.x, event.z);
          audio.playCaptiveBall();
          effects.spawnBumperHit(event.x, event.z, 0x4400ff);
          break;

        case 'vuk':
          game.handleVUKHit(event.x, event.z);
          audio.playRampEnter();
          effects.spawnBumperHit(event.x, event.z, 0xff8800);
          break;

        case 'outlane':
          break;
      }
    }
  }

  private getBumperColor(id?: string): number {
    switch (id) {
      case 'pop-center': return 0xff00ff;
      case 'pop-left': return 0xff8800;
      case 'pop-right': return 0x00ff88;
      default: return 0x00ffff;
    }
  }
}
