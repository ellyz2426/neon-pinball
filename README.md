# Neon Pinball VR

Holodeck VR pinball with physics-based ball, neon flippers, pop bumpers, and combo scoring. Built with IWSDK 0.4.1.

**[Play Live](https://ellyz2426.github.io/neon-pinball/)**

## Features

- **Custom 2D pinball physics** — Ball rolling on tilted playfield, 6-substep integration, circle-line and circle-circle collision, realistic flipper mechanics with angular velocity transfer
- **Dual runtime** — Full VR support (Meta Quest) + browser-first mode with keyboard controls
- **Neon holodeck aesthetic** — Glowing wireframe rails, luminous bumpers, energy ball with trail, floating decorations, ambient particles
- **5 drop targets** — Hit all 5 for bonus multiplier
- **3 pop bumpers + 2 slingshots** — Each with unique colors, kick physics, flash effects, and particle bursts
- **Combo multiplier system** — Chain hits for up to 10x score multiplier
- **Ball saver** — 10-second ball saver on each new ball
- **Jackpot system** — Hit 10 bumpers to charge jackpot, then trigger with flipper hit
- **Procedural Web Audio** — Distinct SFX for bumpers, slingshots, targets, flippers, drain, launch, combos, jackpots, and ambient drone
- **8 PanelUI templates** — Title, HUD, game over, pause, leaderboard, settings, message, plunger power — ALL spatial UI, zero HTML DOM
- **Head-following HUD** — Score, ball count, multiplier, and ball saver timer follow your gaze in XR
- **Persistent leaderboard** — Top 10 scores saved to localStorage
- **Table nudge** — Tilt the table slightly with Q/E or controller squeeze

## Controls

| Action | Keyboard | VR Controller |
|--------|----------|---------------|
| Left Flipper | A / Left Arrow | Left Trigger |
| Right Flipper | D / Right Arrow | Right Trigger |
| Launch Ball | Hold Space, release | Hold A, release |
| Pause | Escape | B Button |
| Nudge Left | Q | Left Squeeze |
| Nudge Right | E | Right Squeeze |

## Tech Stack

- **IWSDK 0.4.1** — WebXR framework
- **PanelUI** — Spatial UI system (`.uikitml` templates)
- **Web Audio API** — Procedural sound synthesis
- **Custom Physics** — 2D pinball physics with 6 substeps

## Build

```bash
npm install
npm run build
```

## File Structure

```
src/
  index.ts          Entry point, game loop, world creation
  physics.ts        2D pinball physics engine (ball, walls, bumpers, flippers)
  table.ts          3D table geometry with neon rails and bumpers
  game.ts           Game state, scoring, combos, jackpots, persistence
  audio.ts          Procedural Web Audio sound effects and ambient music
  environment.ts    Holodeck environment (grid, lights, decorations, particles)
  effects.ts        Particle effects, bumper flashes, ball trail
  ui.ts             PanelUI manager for all game UI panels
  xrinput.ts        XR controller input mapping
ui/
  title.uikitml     Title screen with menu buttons
  hud.uikitml       Head-following HUD (score, ball, combo, saver)
  gameover.uikitml   Game over screen with stats
  pause.uikitml     Pause menu
  leaderboard.uikitml   Top 10 scores
  settings.uikitml   Volume controls
  message.uikitml    Toast notifications
  plunger.uikitml    Launch power indicator
```

## Stats

- **9 source files** | **8 UI templates** | **~8,500 lines**
- Dual runtime: VR + browser
- Zero HTML DOM overlays
