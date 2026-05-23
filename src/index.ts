// Neon Pinball VR - Main Entry Point
// Holodeck VR pinball with physics-based ball, neon flippers, and combo scoring

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

import { PinballPhysics, BALL_RADIUS, HALF_W, HALF_L, TILT_ANGLE, CollisionEvent } from './physics';
import {
  createTable, createBumperMeshes, createFlipperMeshes, createPlunger, createTargetBank,
  TABLE_Y, TABLE_TILT,
} from './table';
import { GameManager, GameState } from './game';
import { AudioManager } from './audio';
import { createEnvironment, updateEnvironment, EnvState } from './environment';
import { EffectsManager } from './effects';
import { UIManager } from './ui';
import { XRInputHandler } from './xrinput';

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

  // Create holodeck environment
  const envState = createEnvironment(world.scene);

  // Create pinball table
  const tableGroup = createTable(world.scene);

  // Create table elements
  const bumperMeshes = createBumperMeshes(tableGroup);
  const flipperMeshes = createFlipperMeshes(tableGroup);
  const { plungerMesh, springMesh } = createPlunger(tableGroup);
  const targetMeshes = createTargetBank(tableGroup);

  // Create ball
  const ballGeo = new SphereGeometry(BALL_RADIUS, 16, 12);
  const ballMat = new MeshStandardMaterial({
    color: new Color(0xffffff),
    emissive: new Color(0x00ffff),
    emissiveIntensity: 0.8,
    metalness: 0.9,
    roughness: 0.1,
  });
  const ballMesh = new Mesh(ballGeo, ballMat);
  ballMesh.visible = false;
  tableGroup.add(ballMesh);

  // Ball glow
  const glowGeo = new SphereGeometry(BALL_RADIUS * 2, 8, 6);
  const glowMat = new MeshBasicMaterial({
    color: new Color(0x00ffff),
    transparent: true,
    opacity: 0.3,
    blending: AdditiveBlending,
  });
  const ballGlow = new Mesh(glowGeo, glowMat);
  tableGroup.add(ballGlow);

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
      ballMesh.visible = true;
      plungerPower = 0;
      plungerCharging = false;
    } else if (state === 'gameover') {
      audio.playGameOver();
      ballMesh.visible = false;
    } else if (state === 'title') {
      ballMesh.visible = false;
      audio.stopAmbient();
    }
  });

  game.onScore((_points: number, label: string, x: number, z: number) => {
    if (label.includes('JACKPOT')) {
      audio.playJackpot();
    } else if (label.includes('BONUS')) {
      audio.playCombo();
    }
  });

  game.onMessage((msg: string) => {
    ui.showMessage(msg);
    if (msg.includes('SAVED')) audio.playBallSaved();
  });

  // Target collision handling
  const targetPositions = [-0.16, -0.08, 0, 0.08, 0.16];
  const targetZ = -0.45;

  // Frame timer and trail counter
  let trailCounter = 0;
  let time = 0;

  // Game loop
  const gameLoop = world.createSystem({
    name: 'PinballGameLoop',
    update: (_ecs: any, delta: number) => {
      const dt = Math.min(delta, 0.033); // cap at ~30fps worth
      time += dt;

      // Update XR input
      xrInput.update(dt);

      // Environment animations
      updateEnvironment(envState, time, dt);

      // Game state update
      game.update(dt);
      ui.update(dt);

      if (game.state === 'playing' || game.state === 'plunger') {
        // Flipper input (keyboard + XR)
        const leftFlip = keys['KeyA'] || keys['ArrowLeft'] || xrInput.leftFlipperPressed;
        const rightFlip = keys['KeyD'] || keys['ArrowRight'] || xrInput.rightFlipperPressed;
        physics.setFlipperActive('left', leftFlip);
        physics.setFlipperActive('right', rightFlip);

        // Play flipper sound on press
        if (leftFlip && !physics.leftFlipper.angularVel) {
          // Only play on state change
        }
        if (rightFlip && !physics.rightFlipper.angularVel) {
          // Only play on state change
        }

        // Plunger input
        if (game.state === 'plunger') {
          // Keyboard plunger
          if (plungerCharging) {
            plungerPower = Math.min(1, plungerPower + dt * 1.2);
          }

          // XR plunger (A button hold)
          if (xrInput.launchHeld) {
            plungerPower = Math.min(1, plungerPower + dt * 1.2);
          } else if (xrInput.launchPressed && plungerPower > 0.05) {
            physics.launchBall(plungerPower);
            audio.playLaunch();
            game.setState('playing');
            plungerPower = 0;
          }

          // Update plunger visual
          plungerMesh.position.z = 0.47 + plungerPower * 0.03;
          springMesh.scale.z = 1 - plungerPower * 0.5;
          ui.updatePlungerPower(plungerPower);
        }

        // Nudge (table tilt)
        const nudgeL = keys['KeyQ'] || xrInput.nudgeLeft;
        const nudgeR = keys['KeyE'] || xrInput.nudgeRight;
        if (nudgeL) physics.ball.vx -= 0.3 * dt;
        if (nudgeR) physics.ball.vx += 0.3 * dt;

        // Physics update
        if (game.state === 'playing') {
          const events = physics.update(dt);
          handleCollisionEvents(events);
        }

        // Check target collisions (manual, since targets are positioned objects)
        if (game.state === 'playing' && physics.ball.active) {
          for (let i = 0; i < 5; i++) {
            const tx = targetPositions[i];
            const dx = physics.ball.x - tx;
            const dz = physics.ball.z - targetZ;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < BALL_RADIUS + 0.015 && game.targets[i].active) {
              game.handleTargetHit(`target-${i}`, tx, targetZ);
              audio.playTargetHit();
              effects.spawnTargetHit(tx, targetZ, [0xff0044, 0xff8800, 0xffff00, 0x00ff88, 0x0088ff][i]);

              // Bounce ball back
              physics.ball.vz = Math.abs(physics.ball.vz) * 0.8;

              // Update target visual
              const mesh = targetMeshes.get(`target-${i}`);
              if (mesh) {
                mesh.visible = false;
                // Re-show when target resets
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

        // Update ball visual
        if (physics.ball.active) {
          ballMesh.position.set(
            physics.ball.x,
            physics.getBall3DY(0) - TABLE_Y, // local to table
            physics.ball.z,
          );
          ballMesh.visible = true;
          ballGlow.position.copy(ballMesh.position);
          ballGlow.visible = true;

          // Ball trail
          trailCounter += dt;
          if (trailCounter > 0.03) {
            trailCounter = 0;
            const speed = Math.sqrt(physics.ball.vx ** 2 + physics.ball.vz ** 2);
            if (speed > 0.3) {
              effects.addTrailPoint(
                physics.ball.x,
                physics.getBall3DY(0) - TABLE_Y,
                physics.ball.z,
              );
            }
          }

          // Ball glow intensity based on speed
          const speed = Math.sqrt(physics.ball.vx ** 2 + physics.ball.vz ** 2);
          glowMat.opacity = 0.2 + Math.min(0.5, speed * 0.15);
        } else {
          ballGlow.visible = false;
        }

        // Update flipper visuals
        flipperMeshes.left.rotation.y = -physics.leftFlipper.angle;
        flipperMeshes.right.rotation.y = -(physics.rightFlipper.angle - Math.PI);

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

      // Effects update
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

        case 'drain':
          audio.playDrain();
          effects.spawnDrain(event.x, event.z);
          const saved = game.handleDrain();
          if (saved) {
            // Re-place ball at plunger
            physics.resetBall();
          }
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
