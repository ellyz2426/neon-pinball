# Neon Pinball VR

A full-featured neon-themed pinball game built with [IWSDK](https://iwsdk.dev) (Immersive Web SDK). Play in your browser or in VR on Meta Quest.

**[Play Now](https://ellyz2426.github.io/neon-pinball/)**

![IWSDK](https://img.shields.io/badge/IWSDK-0.4.1-00ffff) ![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue) ![Vite](https://img.shields.io/badge/Vite-7-646cff)

## Features

### Core Gameplay
- **Full pinball physics** — Realistic ball, flipper, bumper, and wall collisions with 6-substep simulation
- **3 pop bumpers + 2 slingshots** — Neon-lit bumpers that kick the ball with particle effects
- **Dual flippers** — Responsive left/right flippers with angular momentum transfer
- **Plunger launcher** — Charge and release with skill shot zones (Good/Great/Perfect)
- **5-target bank** — Drop targets that reset after completion, triggering ball locks
- **2 ramps** — Left and right ramps with entry arches and elevated rail visuals
- **2 spinners** — Spinning gate obstacles that react to ball speed
- **Captive ball** — Spring-loaded captive ball with escalating point awards
- **VUK (Vertical Up-Kicker)** — Scoop capture with timed launch
- **Outlanes with kickback** — One-time kickback saves per ball

### Game Modes
- **Standard Mode** — 3 balls, chase the high score
- **Multiball** — Lock 3 balls via target completion → 4-ball multiball
- **Wizard Mode** — Complete all 5 mission types → 30 seconds of 3x scoring
- **Frenzy Mode** — 3 consecutive orbits → 15 seconds of 5x scoring
- **Time Attack** — 60s/90s/120s unlimited-ball score chases
- **Party Mode** — 1 ball, 2x scoring
- **Daily Challenge** — Procedurally generated daily targets with modifiers

### Scoring Systems
- **Combo system** — Chain hits up to 10x multiplier with named tiers (Warm Up → Godlike)
- **Ramp combos** — Consecutive ramp shots for escalating bonuses + Super Ramp
- **Orbit shots** — 3-checkpoint orbit completion for huge bonuses
- **Skill shots** — Good/Great/Perfect plunger zones
- **Jackpots** — Every 10 bumper hits charges a jackpot; 3 charges Super Jackpot
- **Magna-Save** — Magnetic outlane saves via thumbstick flick (one per side per ball)
- **Score milestones** — Bonuses at 100K, 250K, 500K, 1M, 2.5M, 5M
- **Bonus countdown** — End-of-ball bonus from bumpers, ramps, combos, missions, jackpots
- **Match sequence** — Random number match at game over
- **Lane completion** — Light all 3 lanes for 15,000 bonus

### Mission System
5 mission types with progressive objectives:
1. **Ramp Runner** — Hit 5 ramps (25K reward)
2. **Bumper Frenzy** — Hit bumpers 20 times (20K)
3. **Target Blitz** — Hit 8 targets (30K)
4. **Spin City** — Hit spinners 10 times (15K)
5. **Multiball Madness** — Trigger multiball (50K)

Complete all 5 → **Wizard Mode**. Complete 3 → **Extra Ball**.

### Visual & Audio
- **Neon holodeck aesthetic** — Dark playfield with glowing wireframe environment
- **Dynamic lighting** — Table lights react to game intensity (calm → frenzy)
- **Dynamic camera tracking** — Camera subtly follows the ball (browser mode)
- **Particle effects** — Bumper sparks, target hits, drain bursts, ramp trails, wizard celebration
- **Lane completion indicators** — Glowing bars showing lane states
- **Ball lock indicators** — Visual cues for multiball progress
- **Skill shot zone animations** — Pulsing zones during plunger phase
- **5 table themes** — Neon Classic, Cyber Red, Ocean Blue, Solar Flare, Toxic Green
- **Procedural audio** — 30+ synthesized SFX, no audio files
- **Dynamic intensity music** — Background layers that build with gameplay
- **34 achievements** — From "First Tilt" to "Five Million"

### Controls

| Action | Keyboard | VR Controller |
|--------|----------|---------------|
| Left Flipper | A / Left Arrow | Left Trigger |
| Right Flipper | D / Right Arrow | Right Trigger |
| Launch Ball | Space (hold & release) | A Button (hold & release) |
| Pause | Escape | B Button |
| Nudge Left | Q | Left Squeeze |
| Nudge Right | E | Right Squeeze |
| Magna-Save Left | Z | Left Thumbstick ← |
| Magna-Save Right | C | Right Thumbstick → |

## Tech Stack

- **[IWSDK](https://iwsdk.dev) 0.4.1** — WebXR + browser dual-runtime
- **Three.js** (super-three) — 3D rendering
- **PanelUI** — 21 spatial UI panels via `.uikitml` templates
- **Custom physics** — Purpose-built 2D pinball engine with substep collision
- **Web Audio API** — Procedural sound synthesis
- **TypeScript 5.5** + **Vite 7**

## Development

```bash
npm install
npm run dev        # Start dev server with IWSDK
npm run build      # Production build
npm run preview    # Preview production build
```

Requires Node.js >= 20.19.0.

## Project Structure

```
src/
  index.ts        — Entry point, world setup, system registration
  game.ts         — Game state, scoring, missions, wizard mode, modes
  gameloop.ts     — ECS game loop system (physics, visuals, camera, indicators)
  physics.ts      — Custom 2D pinball physics engine
  table.ts        — 3D table geometry, bumpers, ramps, indicators
  audio.ts        — Procedural Web Audio SFX and dynamic music
  effects.ts      — Particle effects, trails, pulse rings
  ui.ts           — PanelUI spatial panel management (21 panels)
  xrinput.ts      — VR controller input mapping
  achievements.ts — 34 achievements + persistent stats
  themes.ts       — 5 table color themes + daily challenge generation
  environment.ts  — Holodeck environment (grid, decorations, particles)
ui/
  *.uikitml       — 21 spatial UI templates
```

## License

Built with IWSDK. MIT License.
