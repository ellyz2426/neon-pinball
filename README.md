# 🎮 Neon Pinball VR

A fully-featured neon-styled pinball game built with [IWSDK](https://iwsdk.dev) (Immersive Web SDK). Play in VR on Meta Quest or in your desktop browser.

🕹️ **[Play Now](https://ellyz2426.github.io/neon-pinball/)**

![Neon Pinball](https://img.shields.io/badge/IWSDK-0.4.1-00ffff) ![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue) ![Vite](https://img.shields.io/badge/Vite-7-646cff)

## Features

### Core Gameplay
- **Custom 2D physics engine** with 6-substep integration, gravity on tilted playfield, friction, and speed caps
- **Multi-ball physics** supporting up to 4 simultaneous balls with ball-ball elastic collisions
- **Two flippers** with smooth rotation, angular velocity transfer, and pivot-based collision
- **Plunger lane** with hold-to-charge launch mechanic

### Table Elements
- **3 Pop bumpers** (center magenta, left orange, right green) with kick physics
- **2 Slingshots** (yellow, above flippers) with triangle geometry
- **5 Drop targets** with all-targets bonus and progressive reset
- **2 Spinners** (center + left orbit) with visual rotation and friction decay
- **Left & right ramps** with entry/exit teleport and combo scoring
- **Outlanes** (left + right) with one-time kickback saves

### Scoring Systems
- **Combo multiplier** (1x to 10x, 2s decay timer)
- **Jackpot system** (10 bumper hits charges, flipper triggers, escalating value)
- **Ramp combo bonus** (consecutive ramps = escalating bonus, super ramp at 3x same-ramp)
- **Lane completion bonus** (light all 3 lane arrows for 15,000 points)
- **Ball lock → Multiball** (all targets = lock, 3 locks = multiball)
- **Multiball jackpots** (hit bumpers during multiball)

### Mission System
Five mission types with progressive objectives and rewards:
1. **Ramp Runner** — Hit 5 ramps
2. **Bumper Frenzy** — Hit bumpers 20 times
3. **Target Blitz** — Hit 8 targets
4. **Spin City** — Hit spinners 10 times
5. **Multiball Madness** — Trigger multiball

### ⚡ Wizard Mode
Complete all 5 mission types in a single game to activate **Wizard Mode** — 30 seconds of **3x scoring** with:
- Rainbow neon visual effects across the entire table
- Color-cycling ball trails and table lights
- Epic procedural audio fanfare
- 100,000 point activation bonus
- Extra ball awarded when wizard mode ends

### Extra Ball Awards
- Complete 3 missions in a single game
- Survive wizard mode

### 🏆 Achievement System
16 achievements tracked with persistent localStorage:
- Score milestones (100K, 500K, 1M)
- Combo mastery (5x, max multiplier)
- First multiball, first mission complete
- Wizard Mode activation
- Ramp combos, super ramp, jackpot hunting
- Steel nerves (50K on ball 1)
- And more!

### 📊 Statistics
Persistent tracking across all games:
- Total games played, total/best score
- Best combo multiplier achieved
- Total bumper hits, ramp shots
- Multiballs triggered, missions completed
- Wizard modes activated, extra balls earned
- Total play time

### Tilt Mechanic
- Nudge the table with Q/E (keyboard) or squeeze controllers (VR)
- 3 nudge warnings = **TILT** — flippers disabled for the rest of the ball

### Audio
25+ procedural Web Audio SFX:
- Bumper hit, slingshot, target chime, flipper click
- Drain, launch, wall bounce, jackpot fanfare
- Ball saved, combo, game over
- Spinner whirr, ramp swoosh enter/exit
- Kickback spring, multiball power-up, mission complete
- Ball lock clunk, wizard mode start/end
- Extra ball sparkle, achievement unlock
- Dynamic ambient music with intensity layers
- Multiball pulsing bass music

### Visual Effects
- Particle effects (bumper sparks, target hit, drain explosion, ball trail, ramp burst)
- Bumper flash effects on hit
- Pulse ring shockwaves (wizard mode / big hits)
- Ball glow with speed-responsive intensity
- Multiball extra balls tinted magenta
- Wizard mode: rainbow ball colors, cycling table lights
- Lane arrows (left/right/center with neon colors)
- Backbox sign with neon emblem and diamond accent
- Holodeck environment (neon grid floor/ceiling, 3 table lights, 12 floating wireframe decorations, 40+ ambient particles)

### VR + Browser
- **VR controllers**: Triggers=flippers, A=launch, B=pause, Squeeze=nudge, Thumbstick=menu navigation
- **Keyboard**: A/D or arrows=flippers, Space=launch, Esc=pause, Q/E=nudge
- All UI via IWSDK PanelUI spatial panels (zero HTML DOM overlays)
- 13 `.uikitml` compiled templates

## Controls

| Action | VR Controller | Keyboard |
|--------|--------------|----------|
| Left Flipper | Left Trigger | A / Left Arrow |
| Right Flipper | Right Trigger | D / Right Arrow |
| Launch Ball | Hold A, release | Hold Space, release |
| Pause | B | Escape |
| Nudge Left | Left Squeeze | Q |
| Nudge Right | Right Squeeze | E |
| Menu Navigate | Thumbstick | (click buttons) |

## Tech Stack

- **IWSDK 0.4.1** — Immersive Web SDK for WebXR + browser 3D
- **TypeScript 5.5** — Full type safety
- **Vite 7** — Lightning-fast builds
- **PanelUI** — Spatial UI via `.uikitml` templates
- **Web Audio API** — All procedural SFX, no audio files
- **Custom physics** — Purpose-built 2D pinball engine

## Development

```bash
# Install dependencies
npm install

# Start dev server with IWSDK runtime
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Requires Node.js >= 20.19.0.

## Project Structure

```
src/
  index.ts        — Main entry, world creation, game loop
  game.ts         — Game state, scoring, missions, wizard mode
  physics.ts      — Custom 2D pinball physics engine
  table.ts        — 3D table geometry and elements
  audio.ts        — Procedural Web Audio SFX and music
  effects.ts      — Particle effects, trails, pulse rings
  ui.ts           — UI panel management (PanelUI)
  xrinput.ts      — VR controller input mapping
  achievements.ts — Achievement system and statistics
ui/
  *.uikitml       — 13 spatial UI templates
```

## License

Built with IWSDK. For educational and demonstration purposes.
