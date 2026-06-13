// Neon Pinball VR - Main Entry Point
// Round 8: Dynamic camera, lane indicators, ball lock indicators, backglass score

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

import { PinballPhysics, BALL_RADIUS, HALF_W, HALF_L, TILT_ANGLE } from './physics';
import {
  createTable, createBumperMeshes, createFlipperMeshes, createPlunger,
  createTargetBank, createSpinnerMeshes, createRampMeshes, createOutlaneMeshes,
  createCaptiveBallMesh, createSkillShotIndicator, createVUKMesh,
  createLaneIndicators, createBallLockIndicators, createBackglassScore,
  createLegNeonRings, createBallSaverBar,
  createRampEntryGlows, createOrbitCheckpoints, createMissionProgressBar,
  createPlungerLaneLights, createTableEdgeAccents,
  TABLE_Y, TABLE_TILT,
} from './table';
import { GameManager } from './game';
import { AudioManager } from './audio';
import { createEnvironment, updateEnvironment, EnvState } from './environment';
import { EffectsManager } from './effects';
import { UIManager } from './ui';
import { XRInputHandler } from './xrinput';
import { AchievementManager } from './achievements';
import { getTheme, TableTheme, THEMES } from './themes';
import { PinballGameLoopSystem } from './gameloop';

async function main() {
  const container = document.getElementById('scene-container') as HTMLDivElement;

  const world = await World.create(container, {
    xr: { offer: 'once' },
    input: { canvasPointerEvents: true },
    features: {
      grabbing: false,
      locomotion: false,
      physics: false,
      spatialUI: true,
    },
    render: {
      near: 0.01,
      far: 200,
    },
  });

  // Set initial camera position
  world.camera.position.set(0, TABLE_Y + 0.7, HALF_L + 0.5);
  world.camera.lookAt(new Vector3(0, TABLE_Y, -0.1));

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
  const captiveBallMeshes = createCaptiveBallMesh(tableGroup);
  const skillShotIndicator = createSkillShotIndicator(tableGroup);
  const vukMeshes = createVUKMesh(tableGroup);

  // New visual elements (Round 8)
  const laneIndicators = createLaneIndicators(tableGroup);
  const ballLockIndicators = createBallLockIndicators(tableGroup);
  const backglassScoreMesh = createBackglassScore(tableGroup);
  const legRings = createLegNeonRings(tableGroup);
  const ballSaverBar = createBallSaverBar(tableGroup);
  const rampEntryGlows = createRampEntryGlows(tableGroup);
  const orbitCheckpoints = createOrbitCheckpoints(tableGroup);
  const missionProgressBar = createMissionProgressBar(tableGroup);
  const plungerLaneLights = createPlungerLaneLights(tableGroup);
  const tableEdgeAccents = createTableEdgeAccents(tableGroup);

  // Initialize systems
  const physics = new PinballPhysics();
  const game = new GameManager();
  const audio = new AudioManager();
  const achievements = new AchievementManager();
  const effects = new EffectsManager(world.scene, tableGroup);
  const ui = new UIManager(world, game, audio, achievements);
  const xrInput = new XRInputHandler(world);

  await ui.init();

  // Load saved theme
  try {
    const savedTheme = localStorage.getItem('neon-pinball-theme');
    if (savedTheme) game.currentThemeId = savedTheme;
  } catch {}

  // Dynamic lighting references
  const tableLights = {
    main: world.scene.children.find((c: any) => c instanceof PointLight && Math.abs(c.position.x) < 0.01) as PointLight | undefined,
    left: world.scene.children.find((c: any) => c instanceof PointLight && c.position.x < -0.1) as PointLight | undefined,
    right: world.scene.children.find((c: any) => c instanceof PointLight && c.position.x > 0.1) as PointLight | undefined,
  };

  // Theme change handler
  function applyTheme(theme: TableTheme): void {
    const bumperIds = ['pop-center', 'pop-left', 'pop-right'];
    for (let i = 0; i < bumperIds.length; i++) {
      const meshSet = bumperMeshes.get(bumperIds[i]);
      if (meshSet && theme.bumperColors[i] !== undefined) {
        for (const mesh of Object.values(meshSet)) {
          if ((mesh as any).material?.emissive) {
            ((mesh as any).material as MeshStandardMaterial).emissive.setHex(theme.bumperColors[i]);
          }
        }
      }
    }
    (flipperMeshes.left.material as MeshStandardMaterial).color.setHex(theme.flipperColor);
    (flipperMeshes.left.material as MeshStandardMaterial).emissive.setHex(theme.flipperEmissive);
    (flipperMeshes.right.material as MeshStandardMaterial).color.setHex(theme.flipperColor);
    (flipperMeshes.right.material as MeshStandardMaterial).emissive.setHex(theme.flipperEmissive);
    if (tableLights.main) tableLights.main.color.setHex(theme.mainLightColor);
    if (tableLights.left) tableLights.left.color.setHex(theme.leftLightColor);
    if (tableLights.right) tableLights.right.color.setHex(theme.rightLightColor);
  }

  ui.onThemeChange((theme) => applyTheme(theme));
  applyTheme(getTheme(game.currentThemeId));

  // Register the proper ECS game loop system
  world.registerSystem(PinballGameLoopSystem);
  const gameLoop = world.getSystem(PinballGameLoopSystem)!;
  gameLoop.setRefs({
    physics,
    game,
    audio,
    achievements,
    effects,
    ui,
    xrInput,
    world,
    tableGroup,
    bumperMeshes,
    flipperMeshes,
    plungerMesh,
    springMesh,
    targetMeshes,
    spinnerMeshes,
    outlaneMeshes,
    captiveBallMeshes,
    vukMeshes,
    tableLights,
    envState,
    laneIndicators,
    ballLockIndicators,
    skillShotZones: skillShotIndicator.zones,
    backglassScoreMesh,
    legRings,
    ballSaverBar,
    rampEntryGlows,
    orbitCheckpoints,
    missionProgressBar,
    plungerLaneLights,
    tableEdgeAccents,
  });
}

main().catch(console.error);
