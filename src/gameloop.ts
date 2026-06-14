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
  Vector3,
} from '@iwsdk/core';

import { PinballPhysics, BALL_RADIUS, CollisionEvent } from './physics';
import { TABLE_Y } from './table';
import type { PlayfieldInsert, NeonArtLine } from './table';
import { GameManager, GameState, IntensityLevel, COMBO_TIERS } from './game';
import { AudioManager } from './audio';
import { EffectsManager } from './effects';
import { UIManager } from './ui';
import { XRInputHandler, HAPTIC_PATTERNS } from './xrinput';
import { AchievementManager } from './achievements';
import { EnvState, updateEnvironment, applyEnvironmentTheme } from './environment';
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
  rampEntryGlows: Mesh[];
  orbitCheckpoints: Mesh[];
  missionProgressBar: Mesh;
  plungerLaneLights: Mesh[];
  tableEdgeAccents: Mesh[];
  drainGate: Mesh;
  playfieldInserts: PlayfieldInsert[];
  playfieldArt: NeonArtLine[];
  starRollovers: Mesh[];
  comboMeter: { fill: Mesh; border: Mesh; indicator: Mesh };
  multiplierRing: Mesh;
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

  // Camera view system
  private cameraViewIndex = 0;
  private cameraTransitionTimer = 0;
  private cameraTransitionFrom = { x: 0, y: 0, z: 0, lx: 0, ly: 0, lz: 0 };
  private cameraTransitionTo = { x: 0, y: 0, z: 0, lx: 0, ly: 0, lz: 0 };

  // Attract mode (title screen camera orbit)
  private attractTime = 0;

  // New high score celebration
  private newHighScoreTimer = 0;
  private reportedHighScore = false;

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

  // Flipper trail state
  private flipperTrailTimer = 0;

  // Ball alive time tracking
  private ballAliveTimer = 0;

  // Jackpot flash state
  private jackpotFlashTimer = 0;

  // Drain proximity warning
  private drainWarningIntensity = 0;

  // High score approaching indicator
  private highScoreFlashTimer = 0;
  private wasApproachingHighScore = false;

  // Environment theme tracking
  private lastEnvThemeId = '';

  // Ball speed glow tracking
  private ballSpeedGlowIntensity = 0;

  setRefs(refs: GameLoopRefs): void {
    this.refs = refs;
  }

  init(): void {
    // Keyboard listeners -- refs accessed inside callbacks only (fired after setRefs)
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
        audio.startAmbient(game.currentThemeId);
        game.startGame();
        achievements.startGame();
        // Reset camera to standard view on game start
        this.cameraViewIndex = 0;
        const view = PinballGameLoopSystem.CAMERA_VIEWS[0];
        const cam = this.refs.world.camera;
        cam.position.set(view.x, view.y, view.z);
        cam.lookAt(new Vector3(view.lx, view.ly, view.lz));
        this.cameraBaseY = view.y;
        this.cameraBaseZ = view.z;
      }
      if (e.code === 'KeyZ' && game.state === 'playing') {
        game.activateMagnaSave('left');
      }
      if (e.code === 'KeyC' && game.state === 'playing') {
        game.activateMagnaSave('right');
      }
      // Camera view cycling
      if (e.code === 'KeyV' && (game.state === 'playing' || game.state === 'plunger')) {
        this.cycleCameraView();
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
    const { game, audio, physics, effects, achievements, xrInput } = this.refs;

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
        // New high score celebration
        if (game.score > game.highScore && !this.reportedHighScore) {
          this.reportedHighScore = true;
          this.newHighScoreTimer = 2.0;
          effects.spawnWizardBurst(0, -0.15);
          effects.spawnWizardBurst(0, 0.15);
          effects.spawnPulseRing(0, 0, 0xffd700);
          xrInput.hapticPulse({ intensity: 1.0, duration: 400 });
        }
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
        xrInput.hapticPulse(HAPTIC_PATTERNS.jackpot);
      } else if (label.includes('BONUS')) {
        audio.playCombo();
      } else if (label.includes('LOCKED')) {
        audio.playBallLock();
      }
      if (label.includes('SUPER JACKPOT')) {
        audio.playSuperJackpot();
        achievements.checkSuperJackpot();
        xrInput.hapticPulse(HAPTIC_PATTERNS.superJackpot);
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
      if (msg.includes('SAVED')) {
        audio.playBallSaved();
        xrInput.hapticPulse(HAPTIC_PATTERNS.ballSaved);
      }
      if (msg.includes('MISSION COMPLETE')) {
        audio.playMissionComplete();
        xrInput.hapticPulse(HAPTIC_PATTERNS.missionComplete);
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
        effects.spawnMultiballLaunch(0, -0.1);
        xrInput.hapticPulse(HAPTIC_PATTERNS.multiballStart);
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
        xrInput.hapticPulse(HAPTIC_PATTERNS.wizardMode);
      }
    });

    game.onMagnaSave((_side, active) => {
      if (active) {
        audio.playMagnaSave();
        achievements.checkMagnaSave();
        xrInput.hapticPulse(HAPTIC_PATTERNS.magnaSave, _side === 'left' ? 'left' : 'right');
      }
    });

    game.onSkillShot((zone) => {
      if (zone) {
        audio.playSkillShot(zone.name as 'GOOD' | 'GREAT' | 'PERFECT');
        achievements.checkSkillShot(zone.name);
        xrInput.hapticPulse(
          zone.name === 'PERFECT' ? HAPTIC_PATTERNS.skillShotPerfect : HAPTIC_PATTERNS.skillShotGood
        );
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
            xrInput.hapticPulse({ intensity: 0.7, duration: 120 });
          } else if (idx >= 2) {
            effects.spawnBumperHit(0, 0, color);
            xrInput.hapticPulse(HAPTIC_PATTERNS.comboTierUp);
          } else {
            xrInput.hapticPulse(HAPTIC_PATTERNS.comboTierUp);
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
        xrInput.hapticPulse(HAPTIC_PATTERNS.tiltFull);
      } else {
        // Warning
        audio.playTiltWarning();
        effects.spawnTiltWarning();
        this.tiltFlashTimer = 0.3;
        this.tiltShakeIntensity = 0.003;
        xrInput.hapticPulse(HAPTIC_PATTERNS.tiltWarning);
      }
    });

    game.onCaptiveBall((hits) => {
      achievements.checkCaptiveBall(hits);
    });

    game.onBonus((data) => {
      achievements.checkBonusTotal(data.totalBonus);
    });

    game.onMilestone((_milestone, _reward) => {
      // Big visual celebration: wizard burst + pulse ring
      effects.spawnWizardBurst(0, -0.15);
      this.tableShakeTimer = 0.3;
      this.tableShakeIntensity = 0.004;
      xrInput.hapticPulse(HAPTIC_PATTERNS.milestone);
      // Check difficulty achievement
      achievements.checkDifficultyLevel(game.difficultyLevel);
    });

    game.onFrenzy((active, _timer) => {
      if (active) {
        xrInput.hapticPulse(HAPTIC_PATTERNS.frenzyStart);
        achievements.checkFrenzyTriggered();
      }
    });
  }

  // The per-frame tick -- called by IWSDK's ECS loop
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

    // Apply environment theme if it changed
    if (game.currentThemeId !== this.lastEnvThemeId) {
      this.lastEnvThemeId = game.currentThemeId;
      applyEnvironmentTheme(this.refs.envState, this.refs.world.scene, game.currentThemeId);
      audio.setTheme(game.currentThemeId);
      // Apply theme to playfield art
      this.applyThemeToPlayfieldArt(game.currentThemeId);
    }

    xrInput.update(dt);
    game.update(dt);
    ui.update(dt);
    this.updateIntensityVisuals(dt);

    // Camera transition (view cycling)
    this.updateCameraTransition(dt);

    // Attract mode: orbit camera on title screen
    if (game.state === 'title') {
      this.updateAttractMode(dt);
      this.reportedHighScore = false;
    } else {
      this.attractTime = 0; // Reset for next title visit
    }

    // New high score celebration
    if (this.newHighScoreTimer > 0) {
      this.newHighScoreTimer -= dt;
    }

    // Update spinner cooldowns
    for (const key of Object.keys(this.spinnerCooldowns)) {
      this.spinnerCooldowns[key] -= dt;
      if (this.spinnerCooldowns[key] <= 0) delete this.spinnerCooldowns[key];
    }

    if (game.state === 'playing' || game.state === 'plunger') {
      // Flipper input
      const leftFlip = this.keys['KeyA'] || this.keys['ArrowLeft'] || xrInput.leftFlipperPressed;
      const rightFlip = this.keys['KeyD'] || this.keys['ArrowRight'] || xrInput.rightFlipperPressed;
      const wasLeftFlip = physics.isFlipperActive('left');
      const wasRightFlip = physics.isFlipperActive('right');
      physics.setFlipperActive('left', leftFlip);
      physics.setFlipperActive('right', rightFlip);
      // Haptic on flipper engage
      if (leftFlip && !wasLeftFlip) xrInput.hapticLeft(HAPTIC_PATTERNS.flipperActivate);
      if (rightFlip && !wasRightFlip) xrInput.hapticRight(HAPTIC_PATTERNS.flipperActivate);

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
          xrInput.hapticPulse({ intensity: 0.3 + launchPower * 0.7, duration: 80 + launchPower * 120 });
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
          if (nudgeL) xrInput.hapticLeft(HAPTIC_PATTERNS.nudge);
          if (nudgeR) xrInput.hapticRight(HAPTIC_PATTERNS.nudge);
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

      // Physics update (with progressive difficulty gravity)
      if (game.state === 'playing') {
        physics.gravityMultiplier = game.gravityMultiplier;
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
              xrInput.hapticPulse(HAPTIC_PATTERNS.targetHit);
              // Flash target insert
              this.flashInsert(this.refs.playfieldInserts, `insert-target-${i + 1}`);
              b.vz = Math.abs(b.vz) * 0.8;

              // Check target bank completion achievement
              if (game.targetBankCompletions > 0) {
                this.refs.achievements.checkTargetBankCompletions(game.targetBankCompletions);
              }

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
            this.flashInsert(this.refs.playfieldInserts, 'insert-lane-l');
          }
          if (b.x > -0.02 && b.x < 0.02 && b.z > 0.06 && b.z < 0.17 && b.vz < -0.3) {
            game.handleLaneHit(1, b.x, b.z);
            this.flashInsert(this.refs.playfieldInserts, 'insert-lane-c');
          }
          if (b.x > 0.10 && b.x < 0.15 && b.z > 0.04 && b.z < 0.20 && b.vz < -0.3) {
            game.handleLaneHit(2, b.x, b.z);
            this.flashInsert(this.refs.playfieldInserts, 'insert-lane-r');
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
                effects.addTrailPoint(b.x, physics.getBallY(b, 0) - TABLE_Y, b.z, this.trailColor, speed);
              }
            }
          } else if (b.active && game.multiballActive) {
            // Extra balls also get trails — colored to match their ball color
            this.trailCounter += dt;
            if (this.trailCounter > 0.03) {
              const speed = Math.sqrt(b.vx ** 2 + b.vz ** 2);
              if (speed > 0.3) {
                const multiballColors = [0xff00ff, 0xff8800, 0x44ff00, 0x4488ff];
                const colorIdx = (bv.ballId - 1) % multiballColors.length;
                const mbTrailColor = multiballColors[Math.max(0, colorIdx)];
                effects.addTrailPoint(b.x, physics.getBallY(b, 0) - TABLE_Y, b.z, mbTrailColor, speed * 0.7);
              }
            }
          }

          const speed = Math.sqrt(b.vx ** 2 + b.vz ** 2);
          (bv.glow.material as MeshBasicMaterial).opacity = 0.2 + Math.min(0.5, speed * 0.15);

          // Ball glows bigger and brighter at high speed
          const speedGlowScale = 1.0 + Math.min(0.4, speed * 0.1);
          bv.glow.scale.setScalar(speedGlowScale * 2);

          if (!game.wizardModeActive && b !== physics.ball && game.multiballActive) {
            // Multiball differentiation: each extra ball gets a unique color
            const multiballColors = [0xff00ff, 0xff8800, 0x44ff00, 0x4488ff];
            const colorIdx = (bv.ballId - 1) % multiballColors.length;
            const mbColor = multiballColors[Math.max(0, colorIdx)];
            (bv.mesh.material as MeshStandardMaterial).emissive.setHex(mbColor);
            (bv.glow.material as MeshBasicMaterial).color.setHex(mbColor);
            // Slight size variation per ball for visual distinction
            const sizeScale = 1.0 + (colorIdx % 2) * 0.08;
            bv.mesh.scale.setScalar(sizeScale);
            bv.glow.scale.setScalar(sizeScale);
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

      // Flipper trails: spawn particles at flipper tips when active
      this.flipperTrailTimer += dt;
      if (this.flipperTrailTimer > 0.04) {
        this.flipperTrailTimer = 0;
        const theme = getTheme(game.currentThemeId);
        if (leftActive) {
          const lAngle = physics.leftFlipper.angle;
          const tipX = physics.leftFlipper.pivotX + Math.cos(lAngle) * 0.08;
          const tipZ = physics.leftFlipper.pivotZ - Math.sin(lAngle) * 0.08;
          effects.addTrailPoint(tipX, 0.015, tipZ, theme.flipperEmissive);
        }
        if (rightActive) {
          const rAngle = physics.rightFlipper.angle;
          const tipX = physics.rightFlipper.pivotX + Math.cos(rAngle) * 0.08;
          const tipZ = physics.rightFlipper.pivotZ - Math.sin(rAngle) * 0.08;
          effects.addTrailPoint(tipX, 0.015, tipZ, theme.flipperEmissive);
        }
      }

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

      // === Combo timer visual warning ===
      // When combo is active and timer is low, pulse the table lights as warning
      if (game.comboCount >= 3 && game.comboTimer > 0 && game.comboTimer < 0.8) {
        const urgency = 1.0 - (game.comboTimer / 0.8);
        const flash = Math.sin(this.gameTime * (15 + urgency * 15)) > 0 ? 1 : 0;
        const tl = this.refs.tableLights;
        if (tl.left) tl.left.intensity += flash * urgency * 0.5;
        if (tl.right) tl.right.intensity += flash * urgency * 0.5;
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

      // === Jackpot flash -- briefly boost all table lights ===
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

      // === Drain gate visual (glowing barrier when ball saver active) ===
      if (this.refs.drainGate) {
        const gateMat = this.refs.drainGate.material as MeshBasicMaterial;
        if (game.ballSaverActive && game.ballSaverTimer > 0) {
          this.refs.drainGate.visible = true;
          const pct = game.ballSaverTimer / game.ballSaverDuration;
          gateMat.opacity = 0.3 + Math.sin(this.gameTime * 4) * 0.15;
          if (pct > 0.5) {
            gateMat.color.setHex(0x00ff88);
          } else if (pct > 0.25) {
            gateMat.color.setHex(0xffff00);
          } else {
            gateMat.color.setHex(0xff4400);
            gateMat.opacity = Math.sin(this.gameTime * 12) > 0 ? 0.5 : 0.1;
          }
          // Subtle height pulse
          this.refs.drainGate.scale.y = 1.0 + Math.sin(this.gameTime * 3) * 0.2;
        } else {
          this.refs.drainGate.visible = false;
          gateMat.opacity = 0;
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

      // === Plunger lane lights animation ===
      const { plungerLaneLights, tableEdgeAccents } = this.refs;
      if (plungerLaneLights && plungerLaneLights.length > 0) {
        const theme = getTheme(game.currentThemeId);
        const isPlungerPhase = game.state === 'plunger';
        const waveSpeed = isPlungerPhase ? 4 : 1.5;
        for (let i = 0; i < plungerLaneLights.length; i++) {
          const light = plungerLaneLights[i];
          const mat = light.material as MeshBasicMaterial;
          // Traveling wave upward through the lights
          const phase = this.gameTime * waveSpeed - i * 0.5;
          const wave = Math.max(0, Math.sin(phase));
          if (isPlungerPhase) {
            // Brighter, faster animation during plunger charging
            mat.opacity = 0.3 + wave * 0.7;
            mat.color.setHex(0x00ffff);
            const s = 1.0 + wave * 0.5;
            light.scale.set(s, s, s);
          } else if (game.state === 'playing') {
            mat.opacity = 0.15 + wave * 0.2;
            mat.color.setHex(theme.accentPrimary);
            light.scale.set(1, 1, 1);
          } else {
            mat.opacity = 0.1 + wave * 0.1;
            light.scale.set(1, 1, 1);
          }
        }
      }

      // === Table edge accent animation ===
      if (tableEdgeAccents && tableEdgeAccents.length > 0) {
        const theme = getTheme(game.currentThemeId);
        const edgePulse = 0.15 + Math.sin(this.gameTime * 1.2) * 0.08;
        const edgeColor = game.wizardModeActive
          ? new Color().setHSL((this.gameTime * 0.3) % 1, 1, 0.5).getHex()
          : game.frenzyActive
            ? 0xff6600
            : theme.accentPrimary;
        for (const accent of tableEdgeAccents) {
          const mat = accent.material as MeshBasicMaterial;
          mat.opacity = edgePulse;
          mat.color.setHex(edgeColor);
        }
      }

      // === Idle bumper pulse animation (continued) ===
      // At higher difficulty, bumpers pulse faster and with a red tinge
      const diffPulseSpeed = 1.5 + (game.difficultyLevel - 1) * 0.3;
      const diffRedShift = Math.min(1, (game.difficultyLevel - 1) * 0.15);
      for (const [id, entry] of bumperMeshes) {
        if (id.startsWith('pop-')) {
          const bMat = entry.mesh.material as MeshStandardMaterial;
          const gMat = entry.glow.material as MeshBasicMaterial;
          // Offset phase per bumper for organic feel
          const offset = id === 'pop-center' ? 0 : id === 'pop-left' ? 2.1 : 4.2;
          const pulse = 0.3 + Math.sin(this.gameTime * diffPulseSpeed + offset) * 0.1;
          const glowPulse = 0.25 + Math.sin(this.gameTime * diffPulseSpeed + offset) * 0.08;
          // Don't override if bumper was just hit (flash handles that)
          if (bMat.emissiveIntensity < 1.0) {
            bMat.emissiveIntensity = pulse;
          }
          if (gMat.opacity < 0.5) {
            gMat.opacity = glowPulse;
          }
          // Shift glow color toward red at high difficulty
          if (diffRedShift > 0 && gMat.opacity < 0.5) {
            gMat.color.lerp(new Color(0xff2200), diffRedShift * dt * 2);
          }
        }
      }

      // === Ramp entry glow indicators ===
      // Pulsing glows at ramp entrances; urgent when multiball is ready
      const { rampEntryGlows } = this.refs;
      if (rampEntryGlows && rampEntryGlows.length >= 2) {
        const multiballReady = game.ballsLocked >= game.maxLockBalls && !game.multiballActive;
        for (let i = 0; i < rampEntryGlows.length; i++) {
          const rGlow = rampEntryGlows[i];
          const rMat = rGlow.material as MeshBasicMaterial;
          if (multiballReady) {
            // Urgent flash when multiball is ready (ramp triggers it)
            rMat.opacity = 0.5 + Math.sin(this.gameTime * 10 + i * Math.PI) * 0.4;
            const scale = 1.0 + Math.sin(this.gameTime * 10 + i * Math.PI) * 0.2;
            rGlow.scale.set(scale, 1, scale);
          } else if (game.state === 'playing') {
            // Gentle pulse during play
            const phase = this.gameTime * 2 + i * 1.5;
            rMat.opacity = 0.25 + Math.sin(phase) * 0.15;
            const scale = 1.0 + Math.sin(phase) * 0.08;
            rGlow.scale.set(scale, 1, scale);
          } else {
            rMat.opacity = 0.15;
            rGlow.scale.set(1, 1, 1);
          }
        }
      }

      // === Spinner speed visual feedback ===
      // Spinner gate brightness and scale proportional to spin velocity
      for (const spinner of physics.spinners) {
        const sm = spinnerMeshes.get(spinner.id);
        if (sm) {
          const absVel = Math.abs(spinner.spinVel);
          const intensity = Math.min(1, absVel / 20);
          // Scale gate slightly wider when spinning fast
          const gateScale = 1.0 + intensity * 0.25;
          sm.gate.scale.set(gateScale, 1 + intensity * 0.1, 1);
          // Brighten post to match
          (sm.post.material as MeshStandardMaterial).emissiveIntensity = 0.3 + intensity * 0.7;
          // Flash color shifts toward white at high speed
          if (intensity > 0.7) {
            const white = intensity - 0.7;
            (sm.gate.material as MeshStandardMaterial).emissive.lerp(
              new Color(0xffffff), white * 0.5 * dt * 5
            );
          }
        }
      }

      // === Orbit progress checkpoint indicators ===
      const { orbitCheckpoints } = this.refs;
      if (orbitCheckpoints && orbitCheckpoints.length === 3) {
        for (let i = 0; i < 3; i++) {
          const cp = orbitCheckpoints[i];
          const cMat = cp.material as MeshBasicMaterial;
          if (i < game.orbitProgress) {
            // Lit checkpoint -- bright pulsing glow
            cMat.opacity = 0.6 + Math.sin(this.gameTime * 5 + i * 2) * 0.2;
            const scale = 1.2 + Math.sin(this.gameTime * 5 + i * 2) * 0.15;
            cp.scale.set(scale, 1, scale);
          } else if (i === game.orbitProgress && game.orbitProgress > 0) {
            // Next checkpoint -- subtle beckoning pulse
            cMat.opacity = 0.25 + Math.sin(this.gameTime * 3) * 0.15;
            cp.scale.set(1.1, 1, 1.1);
          } else {
            // Unlit -- dim
            cMat.opacity = 0.08;
            cp.scale.set(1, 1, 1);
          }
        }
      }

      // === Mission progress bar ===
      const { missionProgressBar } = this.refs;
      if (missionProgressBar) {
        const mMat = missionProgressBar.material as MeshBasicMaterial;
        if (game.currentMission && game.currentMission.active) {
          const progress = game.currentMission.progress / game.currentMission.target;
          mMat.opacity = 0.5 + Math.sin(this.gameTime * 4) * 0.15;
          mMat.color.setHex(parseInt(game.currentMission.color.replace('#', ''), 16));
          // Scale width proportional to progress
          missionProgressBar.scale.x = Math.max(0.05, progress);
          // Flash faster as completion nears
          if (progress > 0.8) {
            mMat.opacity = 0.6 + Math.sin(this.gameTime * 8) * 0.3;
          }
        } else {
          mMat.opacity = 0;
          missionProgressBar.scale.x = 1;
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
    this.updatePlayfieldInserts(dt);
    this.updateComboMeter(dt);
    this.updateMultiplierRing(dt);
  }

  // Camera view presets: [posX, posY, posZ, lookX, lookY, lookZ]
  private static CAMERA_VIEWS = [
    { name: 'Standard', x: 0, y: TABLE_Y + 0.7, z: 0.75, lx: 0, ly: TABLE_Y, lz: -0.1 },
    { name: 'Close',    x: 0, y: TABLE_Y + 0.4, z: 0.55, lx: 0, ly: TABLE_Y, lz: -0.05 },
    { name: 'Overhead', x: 0, y: TABLE_Y + 1.2, z: 0.15, lx: 0, ly: TABLE_Y, lz: -0.1 },
    { name: 'Side',     x: -0.5, y: TABLE_Y + 0.6, z: 0.3, lx: 0, ly: TABLE_Y, lz: -0.1 },
  ];

  private cycleCameraView(): void {
    this.cameraViewIndex = (this.cameraViewIndex + 1) % PinballGameLoopSystem.CAMERA_VIEWS.length;
    const view = PinballGameLoopSystem.CAMERA_VIEWS[this.cameraViewIndex];
    const cam = this.refs.world.camera;

    // Set up smooth transition
    this.cameraTransitionFrom = {
      x: cam.position.x, y: cam.position.y, z: cam.position.z,
      lx: 0, ly: TABLE_Y, lz: -0.1,
    };
    this.cameraTransitionTo = {
      x: view.x, y: view.y, z: view.z,
      lx: view.lx, ly: view.ly, lz: view.lz,
    };
    this.cameraTransitionTimer = 0.5; // 0.5s smooth transition

    // Update base values for tracking
    this.cameraBaseY = view.y;
    this.cameraBaseZ = view.z;

    // Show view name briefly
    this.refs.ui.showMessage(`Camera: ${view.name}`);
  }

  private updateAttractMode(dt: number): void {
    const cam = this.refs.world.camera;
    this.attractTime += dt * 0.3; // Slow orbit

    const radius = 0.9;
    const orbitX = Math.sin(this.attractTime) * radius;
    const orbitZ = Math.cos(this.attractTime) * radius * 0.5 + 0.3;
    const orbitY = TABLE_Y + 0.65 + Math.sin(this.attractTime * 0.7) * 0.08;

    cam.position.set(orbitX, orbitY, orbitZ);
    cam.lookAt(new Vector3(0, TABLE_Y + 0.02, -0.1));

    // Attract mode lighting: cycle table lights through rainbow
    const { tableLights } = this.refs;
    const hue1 = (this.attractTime * 0.15) % 1;
    const hue2 = (hue1 + 0.33) % 1;
    const hue3 = (hue1 + 0.66) % 1;
    if (tableLights.main) {
      tableLights.main.color.setHSL(hue1, 0.8, 0.5);
      tableLights.main.intensity = 1.0 + Math.sin(this.attractTime * 1.5) * 0.3;
    }
    if (tableLights.left) {
      tableLights.left.color.setHSL(hue2, 0.9, 0.5);
      tableLights.left.intensity = 0.5 + Math.sin(this.attractTime * 1.2 + 1) * 0.2;
    }
    if (tableLights.right) {
      tableLights.right.color.setHSL(hue3, 0.9, 0.5);
      tableLights.right.intensity = 0.5 + Math.sin(this.attractTime * 1.2 + 2) * 0.2;
    }

    // Pulse bumpers during attract mode
    const { bumperMeshes } = this.refs;
    const bumperIds = ['pop-center', 'pop-left', 'pop-right'];
    for (let i = 0; i < bumperIds.length; i++) {
      const entry = bumperMeshes.get(bumperIds[i]);
      if (entry) {
        const phase = this.attractTime * 2 + i * 2.1;
        (entry.glow.material as MeshBasicMaterial).opacity = 0.2 + Math.sin(phase) * 0.15;
        const h = (hue1 + i * 0.2) % 1;
        (entry.mesh.material as MeshStandardMaterial).emissive.setHSL(h, 1, 0.4);
      }
    }
  }

  private updateCameraTransition(dt: number): void {
    if (this.cameraTransitionTimer <= 0) return;
    this.cameraTransitionTimer -= dt;
    const t = Math.max(0, 1 - this.cameraTransitionTimer / 0.5);
    const ease = t * t * (3 - 2 * t); // smoothstep

    const cam = this.refs.world.camera;
    const from = this.cameraTransitionFrom;
    const to = this.cameraTransitionTo;

    cam.position.set(
      from.x + (to.x - from.x) * ease,
      from.y + (to.y - from.y) * ease,
      from.z + (to.z - from.z) * ease,
    );
    cam.lookAt(new Vector3(
      from.lx + (to.lx - from.lx) * ease,
      from.ly + (to.ly - from.ly) * ease,
      from.lz + (to.lz - from.lz) * ease,
    ));
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
    const { game, audio, effects, bumperMeshes, physics, achievements, xrInput, playfieldInserts } = this.refs;

    for (const event of events) {
      switch (event.type) {
        case 'bumper':
          game.handleBumperHit(event.id || '', event.x, event.z);
          audio.playBumperHit(event.id);
          effects.spawnBumperHit(event.x, event.z, this.getBumperColor(event.id));
          effects.flashBumper(bumperMeshes, event.id || '');
          xrInput.hapticPulse(HAPTIC_PATTERNS.bumperHit);
          // Flash corresponding insert
          this.flashInsert(playfieldInserts, event.id === 'pop-center' ? 'insert-bumper-c' : event.id === 'pop-left' ? 'insert-bumper-l' : 'insert-bumper-r');
          // Micro table shake on bumper hits
          if (this.tableShakeTimer <= 0) {
            this.tableShakeTimer = 0.08;
            this.tableShakeIntensity = 0.001;
          }
          break;

        case 'slingshot':
          game.handleSlingshotHit(event.id || '', event.x, event.z);
          audio.playSlingshotHit();
          // Directional particle spray toward center
          effects.spawnSlingshotHit(event.x, event.z, event.x < 0 ? 1 : -1);
          effects.flashBumper(bumperMeshes, event.id || '');
          xrInput.hapticPulse(HAPTIC_PATTERNS.slingshotHit);
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
          xrInput.hapticPulse(HAPTIC_PATTERNS.ballDrain);
          achievements.recordDrain();
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
            achievements.checkSpinnerCount(game.totalSpinnerHits);
            xrInput.hapticPulse(HAPTIC_PATTERNS.spinnerHit);
            // Flash spinner insert
            this.flashInsert(playfieldInserts, event.x < 0 ? 'insert-spinner-l' : 'insert-spinner-r');
          }
          break;
        }

        case 'ramp_enter':
          audio.playRampEnter();
          effects.spawnRampTrail(event.x, event.z);
          xrInput.hapticPulse(HAPTIC_PATTERNS.rampShot);
          // Flash ramp insert
          this.flashInsert(playfieldInserts, event.id === 'ramp-left' ? 'insert-ramp-l' : 'insert-ramp-r');
          break;

        case 'ramp_exit':
          audio.playRampExit();
          game.handleRampShot(event.id || '', event.x, event.z);
          effects.spawnBumperHit(event.x, event.z, event.id === 'ramp-left' ? 0xff00ff : 0x00ff88);
          if (event.id === 'ramp-left') game.advanceOrbit(1, event.x, event.z);
          else if (event.id === 'ramp-right') game.advanceOrbit(3, event.x, event.z);
          this.refs.achievements.checkRampCount(game.totalRampShots);
          this.refs.achievements.checkOrbitCount(game.totalOrbits);
          break;

        case 'kickback':
          game.handleKickback(event.id || '', event.x, event.z);
          audio.playKickback();
          effects.spawnBumperHit(event.x, event.z, 0x00ff88);
          xrInput.hapticPulse(HAPTIC_PATTERNS.bumperHit);
          break;

        case 'captive_ball':
          game.handleCaptiveBallHit(event.x, event.z);
          audio.playCaptiveBall();
          effects.spawnBumperHit(event.x, event.z, 0x4400ff);
          xrInput.hapticPulse(HAPTIC_PATTERNS.targetHit);
          break;

        case 'vuk':
          game.handleVUKHit(event.x, event.z);
          audio.playRampEnter();
          effects.spawnBumperHit(event.x, event.z, 0xff8800);
          xrInput.hapticPulse(HAPTIC_PATTERNS.rampShot);
          // VUK capture celebration — extra particles
          for (let vi = 0; vi < 6; vi++) {
            effects.spawnBumperHit(
              event.x + (Math.random() - 0.5) * 0.02,
              event.z + (Math.random() - 0.5) * 0.02,
              [0xff8800, 0xffcc00, 0xff4400][vi % 3]
            );
          }
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

  /** Flash a playfield insert by id (bright pulse then fade) */
  private flashInsert(inserts: PlayfieldInsert[], insertId: string): void {
    for (const insert of inserts) {
      if (insert.id === insertId) {
        insert.flashTimer = 0.5;
        break;
      }
    }
  }

  /** Update all playfield insert animations */
  private updatePlayfieldInserts(dt: number): void {
    const { playfieldInserts, playfieldArt, starRollovers, game } = this.refs;
    if (!playfieldInserts) return;

    // === Wizard mode: all inserts rainbow cycle ===
    if (game.wizardModeActive) {
      for (let i = 0; i < playfieldInserts.length; i++) {
        const insert = playfieldInserts[i];
        const mat = insert.mesh.material as MeshBasicMaterial;
        const glowMat = insert.glow.material as MeshBasicMaterial;
        // Rainbow hue cycling offset per insert
        const hue = ((this.gameTime * 0.5 + i * 0.05) % 1);
        const c = new Color().setHSL(hue, 1, 0.5);
        mat.color.copy(c);
        glowMat.color.copy(c);
        mat.opacity = 0.6 + Math.sin(this.gameTime * 6 + i * 0.3) * 0.3;
        glowMat.opacity = 0.4 + Math.sin(this.gameTime * 6 + i * 0.3) * 0.2;
        // Pulse scale during wizard
        const s = 1 + Math.sin(this.gameTime * 4 + i * 0.5) * 0.15;
        insert.mesh.scale.set(s, 1, s);
        insert.glow.scale.set(s, 1, s);
      }
      // Stars spin fast in wizard mode
      if (starRollovers) {
        for (let i = 0; i < starRollovers.length; i++) {
          starRollovers[i].rotation.y = this.gameTime * 3 + i * 2.094;
        }
      }
      // Art brighter in wizard mode
      if (playfieldArt) {
        for (const line of playfieldArt) {
          const mat = line.mesh.material as MeshBasicMaterial;
          mat.opacity = 0.4 + Math.sin(this.gameTime * 2 + playfieldArt.indexOf(line) * 0.3) * 0.1;
        }
      }
      return;
    }

    // === Attract mode (title screen): sequential light chase ===
    if (game.state === 'title') {
      const chaseSpeed = 3; // inserts per second
      const activeIdx = Math.floor(this.gameTime * chaseSpeed) % playfieldInserts.length;
      for (let i = 0; i < playfieldInserts.length; i++) {
        const insert = playfieldInserts[i];
        const mat = insert.mesh.material as MeshBasicMaterial;
        const glowMat = insert.glow.material as MeshBasicMaterial;
        // Restore base color
        mat.color.setHex(insert.baseColor);
        glowMat.color.setHex(insert.baseColor);
        const dist = Math.abs(i - activeIdx);
        const brightness = dist <= 2 ? (1 - dist / 3) : 0.1;
        mat.opacity = brightness * 0.7;
        glowMat.opacity = brightness * 0.4;
        insert.mesh.scale.set(1, 1, 1);
        insert.glow.scale.set(1, 1, 1);
      }
      // Stars pulse gently in attract
      if (starRollovers) {
        for (let i = 0; i < starRollovers.length; i++) {
          starRollovers[i].rotation.y = this.gameTime * 0.8 + i * 2.094;
        }
      }
      // Art dim in attract
      if (playfieldArt) {
        for (const line of playfieldArt) {
          (line.mesh.material as MeshBasicMaterial).opacity = 0.08;
        }
      }
      return;
    }

    // === Normal gameplay insert animation ===
    for (const insert of playfieldInserts) {
      // Restore base color (in case wizard mode changed it)
      (insert.mesh.material as MeshBasicMaterial).color.setHex(insert.baseColor);
      (insert.glow.material as MeshBasicMaterial).color.setHex(insert.baseColor);

      if (insert.flashTimer > 0) {
        insert.flashTimer -= dt;
        const t = Math.max(0, insert.flashTimer);
        const flash = t > 0.3 ? 1.0 : t / 0.3;
        const mat = insert.mesh.material as MeshBasicMaterial;
        const glowMat = insert.glow.material as MeshBasicMaterial;
        mat.opacity = 0.25 + flash * 0.75;
        glowMat.opacity = 0.12 + flash * 0.5;
        // Slight scale pulse
        const s = 1 + flash * 0.3;
        insert.mesh.scale.set(s, 1, s);
        insert.glow.scale.set(s, 1, s);
      } else {
        // Subtle idle pulse
        const pulse = 0.25 + Math.sin(this.gameTime * 2 + playfieldInserts.indexOf(insert) * 0.5) * 0.05;
        const mat = insert.mesh.material as MeshBasicMaterial;
        mat.opacity = pulse;
        insert.mesh.scale.set(1, 1, 1);
        insert.glow.scale.set(1, 1, 1);
      }
    }

    // Jackpot insert special handling: brighter when jackpot is ready
    const jackpotInsert = playfieldInserts.find(i => i.id === 'insert-jackpot');
    if (jackpotInsert && game.jackpotReady) {
      const mat = jackpotInsert.mesh.material as MeshBasicMaterial;
      const pulse = 0.5 + Math.sin(this.gameTime * 5) * 0.3;
      mat.opacity = pulse;
      const glowMat = jackpotInsert.glow.material as MeshBasicMaterial;
      glowMat.opacity = pulse * 0.6;
    }

    // Orbit inserts: brighter based on orbit progress
    const orbitInsertL = playfieldInserts.find(i => i.id === 'insert-orbit-l');
    const orbitInsertR = playfieldInserts.find(i => i.id === 'insert-orbit-r');
    if (orbitInsertL && orbitInsertR && game.orbitProgress > 0) {
      const orbitPulse = 0.35 + Math.sin(this.gameTime * 4) * 0.15;
      (orbitInsertL.mesh.material as MeshBasicMaterial).opacity = orbitPulse;
      (orbitInsertR.mesh.material as MeshBasicMaterial).opacity = orbitPulse;
    }

    // Outlane inserts flash when ball is near drain
    const drainInsertL = playfieldInserts.find(i => i.id === 'insert-outlane-l');
    const drainInsertR = playfieldInserts.find(i => i.id === 'insert-outlane-r');
    const centerDrain = playfieldInserts.find(i => i.id === 'insert-center-drain');
    if (game.state === 'playing' && this.ballVisuals.length > 0) {
      const ball = this.refs.physics.balls[0];
      if (ball && ball.z > 0.35) {
        const urgency = Math.min(1, (ball.z - 0.35) / 0.2);
        const flash = Math.sin(this.gameTime * 8) > 0 ? urgency : 0;
        if (drainInsertL) (drainInsertL.mesh.material as MeshBasicMaterial).opacity = 0.25 + flash * 0.6;
        if (drainInsertR) (drainInsertR.mesh.material as MeshBasicMaterial).opacity = 0.25 + flash * 0.6;
        if (centerDrain) (centerDrain.mesh.material as MeshBasicMaterial).opacity = 0.25 + flash * 0.7;
      }
    }

    // Frenzy mode: all inserts glow brighter and pulse faster
    if (game.frenzyActive) {
      for (const insert of playfieldInserts) {
        if (insert.flashTimer <= 0) {
          const mat = insert.mesh.material as MeshBasicMaterial;
          mat.opacity = 0.4 + Math.sin(this.gameTime * 5 + playfieldInserts.indexOf(insert) * 0.4) * 0.15;
        }
      }
    }

    // Animate star rollovers — gentle rotation
    if (starRollovers) {
      for (let i = 0; i < starRollovers.length; i++) {
        const star = starRollovers[i];
        star.rotation.y = this.gameTime * 0.5 + i * 2.094; // Each star offset 120 degrees
      }
    }

    // Playfield art: subtle pulse with intensity
    if (playfieldArt) {
      const intensityMul = game.intensity === 'frenzy' ? 0.35 : game.intensity === 'heated' ? 0.25 : 0.15;
      for (const line of playfieldArt) {
        const mat = line.mesh.material as MeshBasicMaterial;
        mat.opacity = intensityMul + Math.sin(this.gameTime * 1.5 + playfieldArt.indexOf(line) * 0.3) * 0.05;
      }
    }
  }

  /** Apply theme accent color to playfield art lines */
  private applyThemeToPlayfieldArt(themeId: string): void {
    const { playfieldArt } = this.refs;
    if (!playfieldArt) return;

    // Map theme id to an art tint color
    let artTint: number;
    switch (themeId) {
      case 'cyber-red':    artTint = 0x440022; break;
      case 'ocean-blue':   artTint = 0x002244; break;
      case 'solar-flare':  artTint = 0x442200; break;
      case 'toxic-green':  artTint = 0x004422; break;
      default:             artTint = 0x001144; break; // neon-classic
    }

    for (const line of playfieldArt) {
      const mat = line.mesh.material as MeshBasicMaterial;
      // Blend base color with theme tint
      const baseColor = new Color(line.baseColor);
      const tintColor = new Color(artTint);
      baseColor.lerp(tintColor, 0.4);
      mat.color.copy(baseColor);
    }
  }

  /** Update combo meter bar — fills and colors based on combo tier */
  private updateComboMeter(dt: number): void {
    const { comboMeter, game } = this.refs;
    if (!comboMeter) return;

    const { fill, border, indicator } = comboMeter;
    const maxComboForMeter = 30; // godlike tier
    const fillRatio = Math.min(1, game.comboCount / maxComboForMeter);

    // Scale fill bar
    fill.scale.z = fillRatio;

    // Determine combo tier color
    let tierColor = 0x00ffff;
    for (let i = COMBO_TIERS.length - 1; i >= 0; i--) {
      if (game.comboCount >= COMBO_TIERS[i].minCombo) {
        tierColor = parseInt(COMBO_TIERS[i].color.replace('#', ''), 16);
        break;
      }
    }

    // Apply color to fill and border
    const fillMat = fill.material as MeshBasicMaterial;
    fillMat.color.setHex(tierColor);
    fillMat.opacity = fillRatio > 0 ? 0.6 + Math.sin(this.gameTime * 4) * 0.15 : 0;

    const borderMat = border.material as MeshBasicMaterial;
    borderMat.color.setHex(tierColor);
    borderMat.opacity = game.comboCount > 0 ? 0.5 : 0.2;

    // Leading edge indicator
    const indMat = indicator.material as MeshBasicMaterial;
    if (fillRatio > 0) {
      indMat.opacity = 0.7 + Math.sin(this.gameTime * 6) * 0.3;
      indMat.color.setHex(tierColor);
      // Position indicator at top of fill
      const halfLength = 0.535 * 0.6;
      indicator.position.z = -halfLength + fillRatio * halfLength * 2;
    } else {
      indMat.opacity = 0;
    }

    // Combo timer urgency: border flashes when combo is about to expire
    if (game.comboCount >= 3 && game.comboTimer > 0 && game.comboTimer < 0.8) {
      const urgency = 1 - game.comboTimer / 0.8;
      borderMat.opacity = 0.5 + Math.sin(this.gameTime * 12) * 0.3 * urgency;
    }
  }

  /** Update multiplier ring — grows with current multiplier */
  private updateMultiplierRing(dt: number): void {
    const { multiplierRing, game } = this.refs;
    if (!multiplierRing) return;

    const mat = multiplierRing.material as MeshBasicMaterial;
    const mul = game.multiplier;

    if (mul > 1) {
      // Scale ring based on multiplier (up to 5x = full size)
      const s = 0.5 + Math.min(mul / 5, 1) * 1.5;
      multiplierRing.scale.set(s, s, s);
      mat.opacity = 0.3 + Math.sin(this.gameTime * 3) * 0.15;

      // Color shifts with multiplier level
      if (mul >= 5) {
        mat.color.setHex(0xff00ff); // Purple for 5x+
      } else if (mul >= 3) {
        mat.color.setHex(0xff4400); // Orange for 3-4x
      } else {
        mat.color.setHex(0xffff00); // Yellow for 2x
      }
    } else {
      multiplierRing.scale.set(0.5, 0.5, 0.5);
      mat.opacity = 0.1;
      mat.color.setHex(0x444444);
    }
  }
}
