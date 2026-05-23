// Neon Pinball VR - Main Entry Point
// Round 2: Multiball, spinners, ramps, outlanes, missions

import {
  World,
  PanelUI,
  ScreenSpace,
  Follower,
  FollowBehavior,
  PanelDocument,
  UIKitDocument,
  InputComponent,
  Mesh,
  Group,
  BoxGeometry,
  SphereGeometry,
  CylinderGeometry,
  PlaneGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  LineBasicMaterial,
  Color,
  Vector3,
  Quaternion,
  Fog,
  AmbientLight,
  PointLight,
  DirectionalLight,
  EdgesGeometry,
  LineSegments,
  AdditiveBlending,
  Float32BufferAttribute,
  BufferGeometry,
  RingGeometry,
  TorusGeometry,
  ConeGeometry,
} from '@iwsdk/core';

import { PinballPhysics, BALL_RADIUS, HALF_W, HALF_L, TILT_ANGLE, CollisionEvent, BallState } from './physics';
import {
  createTable, createBumperMeshes, createFlipperMeshes, createPlunger,
  createTargetBank, createSpinnerMeshes, createRampMeshes, createOutlaneMeshes,
  TABLE_Y, TABLE_TILT,
} from './table';
import { GameManager, GameState } from './game';
import { AudioManager } from './audio';
import { createEnvironment, updateEnvironment, EnvState } from './environment';
import { EffectsManager } from './effects';
import { UIManager } from './ui';
import { XRInputHandler } from './xrinput';

interface BallVisual {
  mesh: Mesh;
  glow: Mesh;
  ballId: number;
}

async function main() {
  const container = document.getElementById('scene-container') as HTMLDivElement;

  const world = await World.create(container, {
    xr: { offer: 'once' },
    ...({ input: { canvasPointerEvents: true } } as any),
    features: {
      grabbing: false,
      locomotion: false,
      physics: false,
      spatialUI: true,
    },
    render: {
      near: 0.01,
      far: 200,
      ...({
        camera: {
          position: [0, TABLE_Y + 0.7, HALF_L + 0.5],
          lookAt: [0, TABLE_Y, -0.1],
        },
      } as any),
    },
  });

  // Create environment and table
  const envState = createEnvironment(world.scene);
  const tableGroup = createTable(world.scene);

  // Create table elements
  const bumperMeshes = createBumperMeshes(tableGroup);
  const flipperMeshes = createFlipperMeshes(tableGroup);
  const { plungerMesh, springMesh } = createPlunger(tableGroup);
  const targetMeshes = createTargetBank(tableGroup);
  const spinnerMeshes = createSpinnerMeshes(tableGroup);
  const rampMeshes = createRampMeshes(tableGroup);
  const outlaneMeshes = createOutlaneMeshes(tableGroup);

  // Ball pool (multiball support)
  const ballVisuals: BallVisual[] = [];

  function createBallVisual(id: number): BallVisual {
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

  // Create initial ball visual
  ballVisuals.push(createBallVisual(0));

  // Initialize systems
  const physics = new PinballPhysics();
  const game = new GameManager();
  const audio = new AudioManager();
  const effects = new EffectsManager(world.scene, tableGroup);
  const ui = new UIManager(world, game, audio);
  const xrInput = new XRInputHandler(world);

  await ui.init();

  // Keyboard state
  const keys: Record<string, boolean> = {};
  let plungerPower = 0;
  let plungerCharging = false;

  document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Escape') {
      if (game.state === 'playing' || game.state === 'plunger') {
        game.setState('paused');
      } else if (game.state === 'paused') {
        game.setState('playing');
      }
    }
    if (e.code === 'Space' && (game.state === 'plunger')) {
      plungerCharging = true;
    }
    if (e.code === 'Space' && game.state === 'title') {
      audio.init();
      audio.resume();
      audio.startAmbient();
      game.startGame();
    }
  });

  document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if (e.code === 'Space' && plungerCharging) {
      plungerCharging = false;
      if (plungerPower > 0.05) {
        physics.launchBall(plungerPower);
        audio.playLaunch();
        game.setState('playing');
      }
      plungerPower = 0;
    }
  });

  // Wire game events
  game.onStateChange((state: GameState) => {
    ui.showState(state);

    if (state === 'plunger') {
      physics.resetBall();
      ensureBallVisual(physics.ball.id);
      plungerPower = 0;
      plungerCharging = false;
    } else if (state === 'gameover') {
      audio.playGameOver();
      audio.stopMultiballMusic();
      hideAllBalls();
    } else if (state === 'title') {
      hideAllBalls();
      audio.stopAmbient();
      physics.resetAllBalls();
    }
  });

  game.onScore((_points: number, label: string, _x: number, _z: number) => {
    if (label.includes('JACKPOT')) {
      audio.playJackpot();
    } else if (label.includes('BONUS')) {
      audio.playCombo();
    } else if (label.includes('LOCKED')) {
      audio.playBallLock();
    }
  });

  game.onMessage((msg: string) => {
    ui.showMessage(msg);
    if (msg.includes('SAVED')) audio.playBallSaved();
    if (msg.includes('MISSION COMPLETE')) audio.playMissionComplete();
  });

  game.onMultiball((active: boolean, count: number) => {
    if (active) {
      audio.playMultiballStart();
      // Spawn extra balls
      const positions = [
        { x: -0.15, z: -0.2, vx: 0.3, vz: 0.5 },
        { x: 0.15, z: -0.2, vx: -0.3, vz: 0.5 },
        { x: 0, z: -0.3, vx: 0.1, vz: 0.8 },
      ];
      for (let i = 0; i < count - 1 && i < positions.length; i++) {
        const p = positions[i];
        const b = physics.spawnExtraBall(p.x, p.z, p.vx, p.vz);
        ensureBallVisual(b.id);
      }
    } else {
      audio.stopMultiballMusic();
      cleanupInactiveBalls();
    }
  });

  // Target collision handling
  const targetPositions = [-0.16, -0.08, 0, 0.08, 0.16];
  const targetZ = -0.45;

  // Spinner cooldown to prevent rapid-fire scoring
  const spinnerCooldowns: Record<string, number> = {};

  // Frame timer
  let trailCounter = 0;
  let time = 0;

  function ensureBallVisual(ballId: number): BallVisual {
    let bv = ballVisuals.find(v => v.ballId === ballId);
    if (!bv) {
      bv = createBallVisual(ballId);
      ballVisuals.push(bv);
    }
    return bv;
  }

  function hideAllBalls(): void {
    for (const bv of ballVisuals) {
      bv.mesh.visible = false;
      bv.glow.visible = false;
    }
  }

  function cleanupInactiveBalls(): void {
    const activeBallIds = new Set(physics.getActiveBalls().map(b => b.id));
    for (const bv of ballVisuals) {
      if (!activeBallIds.has(bv.ballId)) {
        bv.mesh.visible = false;
        bv.glow.visible = false;
      }
    }
  }

  // Game loop
  const gameLoop = world.createSystem({
    name: 'PinballGameLoop',
    update: (_ecs: any, delta: number) => {
      const dt = Math.min(delta, 0.033);
      time += dt;

      xrInput.update(dt);
      updateEnvironment(envState, time, dt);
      game.update(dt);
      ui.update(dt);

      // Update spinner cooldowns
      for (const key of Object.keys(spinnerCooldowns)) {
        spinnerCooldowns[key] -= dt;
        if (spinnerCooldowns[key] <= 0) delete spinnerCooldowns[key];
      }

      if (game.state === 'playing' || game.state === 'plunger') {
        // Flipper input
        const leftFlip = keys['KeyA'] || keys['ArrowLeft'] || xrInput.leftFlipperPressed;
        const rightFlip = keys['KeyD'] || keys['ArrowRight'] || xrInput.rightFlipperPressed;
        physics.setFlipperActive('left', leftFlip);
        physics.setFlipperActive('right', rightFlip);

        // Plunger input
        if (game.state === 'plunger') {
          if (plungerCharging) {
            plungerPower = Math.min(1, plungerPower + dt * 1.2);
          }

          if (xrInput.launchHeld) {
            plungerPower = Math.min(1, plungerPower + dt * 1.2);
          } else if (xrInput.launchPressed && plungerPower > 0.05) {
            physics.launchBall(plungerPower);
            audio.playLaunch();
            game.setState('playing');
            plungerPower = 0;
          }

          plungerMesh.position.z = 0.47 + plungerPower * 0.03;
          springMesh.scale.z = 1 - plungerPower * 0.5;
          ui.updatePlungerPower(plungerPower);
        }

        // Nudge
        const nudgeL = keys['KeyQ'] || xrInput.nudgeLeft;
        const nudgeR = keys['KeyE'] || xrInput.nudgeRight;
        for (const b of physics.getActiveBalls()) {
          if (nudgeL) b.vx -= 0.3 * dt;
          if (nudgeR) b.vx += 0.3 * dt;
        }

        // Physics update (all balls)
        if (game.state === 'playing') {
          const events = physics.update(dt);
          handleCollisionEvents(events);
        }

        // Check target collisions for all active balls
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
          }
        }

        // Update all ball visuals
        for (const b of physics.balls) {
          const bv = ballVisuals.find(v => v.ballId === b.id);
          if (!bv) continue;

          if (b.active) {
            bv.mesh.position.set(
              b.x,
              physics.getBallY(b, 0) - TABLE_Y,
              b.z,
            );
            bv.mesh.visible = true;
            bv.glow.position.copy(bv.mesh.position);
            bv.glow.visible = true;

            // Ball trail (primary ball only)
            if (b === physics.ball) {
              trailCounter += dt;
              if (trailCounter > 0.03) {
                trailCounter = 0;
                const speed = Math.sqrt(b.vx ** 2 + b.vz ** 2);
                if (speed > 0.3) {
                  effects.addTrailPoint(b.x, physics.getBallY(b, 0) - TABLE_Y, b.z);
                }
              }
            }

            // Ball glow intensity
            const speed = Math.sqrt(b.vx ** 2 + b.vz ** 2);
            (bv.glow.material as MeshBasicMaterial).opacity = 0.2 + Math.min(0.5, speed * 0.15);

            // Multiball: tint extra balls differently
            if (b !== physics.ball && game.multiballActive) {
              (bv.mesh.material as MeshStandardMaterial).emissive.setHex(0xff00ff);
            }
          } else {
            bv.mesh.visible = false;
            bv.glow.visible = false;
          }
        }

        // Update flipper visuals
        flipperMeshes.left.rotation.y = -physics.leftFlipper.angle;
        flipperMeshes.right.rotation.y = -(physics.rightFlipper.angle - Math.PI);

        // Update spinner visuals
        for (const spinner of physics.spinners) {
          const sm = spinnerMeshes.get(spinner.id);
          if (sm) {
            sm.gate.rotation.y = spinner.spinAngle;
            // Glow when spinning fast
            const intensity = Math.min(1, Math.abs(spinner.spinVel) / 20);
            (sm.gate.material as MeshStandardMaterial).emissiveIntensity = 0.3 + intensity * 0.7;
          }
        }

        // Update outlane kickback indicators
        for (const outlane of physics.outlanes) {
          const om = outlaneMeshes.get(outlane.id);
          if (om) {
            // Green = active, red = used
            const color = outlane.kickbackActive ? 0x00ff88 : 0x440000;
            (om.indicator.material as MeshBasicMaterial).color.setHex(color);
            (om.indicator.material as MeshBasicMaterial).opacity = outlane.kickbackActive ? 0.7 : 0.2;
          }
        }

        // Update HUD
        ui.updateHUD();
      }

      // Pause input
      if (xrInput.pausePressed) {
        if (game.state === 'playing' || game.state === 'plunger') {
          game.setState('paused');
        } else if (game.state === 'paused') {
          game.setState('playing');
        }
      }

      effects.update(dt);
    },
  });
  world.registerSystem(gameLoop);

  function handleCollisionEvents(events: CollisionEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'bumper':
          game.handleBumperHit(event.id || '', event.x, event.z);
          audio.playBumperHit();
          effects.spawnBumperHit(event.x, event.z, getBumperColor(event.id));
          effects.flashBumper(bumperMeshes, event.id || '');
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
          if (event.force > 0.3) {
            audio.playWallBounce();
          }
          break;

        case 'drain': {
          audio.playDrain();
          effects.spawnDrain(event.x, event.z);
          const result = game.handleDrain();
          if (result.saved) {
            physics.resetBall();
          } else if (result.isMultiballDrain) {
            // Just remove that ball visual
            cleanupInactiveBalls();
          }
          break;
        }

        case 'spinner': {
          const sid = event.id || '';
          if (!spinnerCooldowns[sid]) {
            game.handleSpinnerHit(sid, event.x, event.z);
            audio.playSpinnerHit();
            effects.spawnBumperHit(event.x, event.z, 0xffff00);
            spinnerCooldowns[sid] = 0.15; // cooldown
          }
          break;
        }

        case 'ramp_enter':
          audio.playRampEnter();
          effects.spawnRampTrail(event.x, event.z);
          break;

        case 'ramp_exit': {
          audio.playRampExit();
          const triggeredMultiball = game.handleRampShot(event.id || '', event.x, event.z);
          effects.spawnBumperHit(event.x, event.z, event.id === 'ramp-left' ? 0xff00ff : 0x00ff88);

          if (triggeredMultiball) {
            // Multiball is handled by game.onMultiball callback
          }
          break;
        }

        case 'kickback':
          game.handleKickback(event.id || '', event.x, event.z);
          audio.playKickback();
          effects.spawnBumperHit(event.x, event.z, 0x00ff88);
          break;

        case 'outlane':
          // Ball going through used outlane — let drain handle it
          break;
      }
    }
  }

  function getBumperColor(id?: string): number {
    switch (id) {
      case 'pop-center': return 0xff00ff;
      case 'pop-left': return 0xff8800;
      case 'pop-right': return 0x00ff88;
      default: return 0x00ffff;
    }
  }
}

main().catch(console.error);
