# Neon Pinball VR

A full-featured neon-themed pinball game built with [IWSDK](https://iwsdk.dev) (Immersive Web SDK). Play in your browser or in VR on Meta Quest.

**[Play Now](https://ellyz2426.github.io/neon-pinball/)**

![IWSDK](https://img.shields.io/badge/IWSDK-0.4.1-00ffff) ![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue) ![Vite](https://img.shields.io/badge/Vite-7-646cff)

## Features

### Core Gameplay
- **Full pinball physics** -- Realistic ball, flipper, bumper, and wall collisions with 6-substep simulation
- **3 pop bumpers + 2 slingshots** -- Neon-lit bumpers that kick the ball with particle effects
- **Dual flippers** -- Responsive left/right flippers with glow effect when active
- **Plunger launcher** -- Charge and release with skill shot zones (Good/Great/Perfect)
- **5-target bank** -- Drop targets that reset after completion, triggering ball locks
- **2 ramps** -- Left and right ramps with entry glows and elevated rail visuals
- **2 spinners** -- Spinning gate obstacles with speed-reactive visuals
- **Captive ball** -- Spring-loaded captive ball with escalating point awards
- **VUK (Vertical Up-Kicker)** -- Scoop capture with timed launch
- **Outlanes with kickback** -- One-time kickback saves per ball

### Game Modes
- **Standard Mode** -- 3 balls, chase the high score
- **Multiball** -- Lock 3 balls via target completion -> 4-ball multiball with visually distinct balls
- **Wizard Mode** -- Complete all 5 mission types -> 30 seconds of 3x scoring
- **Frenzy Mode** -- 3 consecutive orbits -> 15 seconds of 5x scoring
- **Time Attack** -- 60s/90s/120s unlimited-ball score chases
- **Party Mode** -- 1 ball, 2x scoring
- **Daily Challenge** -- Procedurally generated daily targets with modifiers

### Scoring Systems
- **Combo system** -- Chain hits up to 10x multiplier with named tiers (Warm Up -> Godlike)
- **Ramp combos** -- Consecutive ramp shots for escalating bonuses + Super Ramp
- **Orbit shots** -- 3-checkpoint orbit with visual progress indicators
- **Skill shots** -- Good/Great/Perfect plunger zones with zone animations
- **Jackpots** -- Every 10 bumper hits charges a jackpot; 3 charges Super Jackpot
- **Magna-Save** -- Magnetic outlane saves via thumbstick flick (one per side per ball)
- **Score milestones** -- Bonuses at 100K, 250K, 500K, 1M, 2.5M, 5M with visual celebrations
- **Progressive difficulty** -- Gravity increases at higher milestones (levels 1-5)
- **Bonus countdown** -- End-of-ball bonus from bumpers, ramps, combos, missions, jackpots
- **Match sequence** -- Random number match at game over
- **Lane completion** -- Light all 3 lanes for 15,000 bonus
- **Mission progress bar** -- Visual bar showing current mission completion

### Mission System
5 mission types with progressive objectives:
1. **Ramp Runner** -- Hit 5 ramps (25K reward)
2. **Bumper Frenzy** -- Hit bumpers 20 times (20K)
3. **Target Blitz** -- Hit 8 targets (30K)
4. **Spin City** -- Hit spinners 10 times (15K)
5. **Multiball Madness** -- Trigger multiball (50K)

Complete all 5 -> **Wizard Mode**. Complete 3 -> **Extra Ball**.

### Visual & Audio
- **Neon holodeck aesthetic** -- Dark playfield with glowing wireframe environment
- **Dynamic lighting** -- Table lights react to game intensity (calm -> frenzy)
- **Dynamic camera tracking** -- Camera subtly follows the ball (browser mode)
- **Particle effects** -- Bumper sparks, target hits, drain bursts, ramp trails, wizard celebration
- **Particle pooling** -- Pre-allocated mesh pools for zero-allocation particle effects
- **Lane completion indicators** -- Glowing bars showing lane states
- **Ball lock indicators** -- Visual cues for multiball progress with pulse animation
- **Skill shot zone animations** -- Pulsing zones during plunger phase
- **Ramp entry glows** -- Animated floor indicators at ramp entrances (urgent when multiball ready)
- **Orbit checkpoints** -- Visual markers showing orbit shot progress
- **Multiball differentiation** -- Each extra ball gets a unique color and slight size variation
- **Spinner speed feedback** -- Gate brightness and scale proportional to spin velocity
- **Idle bumper pulse** -- Pop bumpers gently glow when not hit
- **Drain proximity warning** -- Ball saver bar flashes red when ball nears drain
- **High score approach** -- Backglass shifts gold when approaching/beating high score
- **Score popup scale-up** -- Score orbs grow as they float up
- **Table shake** -- Proportional shake on big scores and bumper hits
- **Jackpot flash** -- All table lights strobe on jackpot hits
- **Milestone celebrations** -- Wizard burst visual + table shake on score milestones
- **5 table themes** -- Neon Classic, Cyber Red, Ocean Blue, Solar Flare, Toxic Green
- **Procedural audio** -- 30+ synthesized SFX, no audio files
- **Theme-reactive ambient music** -- Different bass/pad tones per theme with harmony layer
- **Dynamic intensity music** -- Background layers that build with gameplay (pulse/harmonic/bass layers)
- **64 achievements** -- From "First Tilt" to "Fifty Million" and "Beyond Godlike"
- **Attract mode** -- Camera orbits the table with cycling rainbow lights on the title screen
- **Camera view cycling** -- Press V to switch between Standard/Close/Overhead/Side views
- **Ball saver drain gate** -- Glowing barrier appears across the drain when ball saver is active
- **New high score celebration** -- Confetti burst and haptic feedback on new records
- **Per-ball multiball trails** -- Each multiball ball leaves colored trails matching its unique color
- **Enhanced stats** -- Tracks avg score, spinner hits, orbits, jackpots, drains, longest ball
- **21 playfield inserts** -- Circular neon insert lights at scoring positions (bumpers, lanes, ramps, targets, orbits, spinners, drain)
- **Insert animations** -- Flash on hit, jackpot pulse, drain warning, wizard mode rainbow cycle, attract mode light chase
- **Playfield neon art** -- Geometric wireframe patterns: bumper diamond, flipper V-pattern, chevrons, border art
- **Star rollovers** -- 4-pointed star markers at lane positions with rotation animation
- **Combo meter bar** -- Physical side bar filling with combo tier colors (cyan through magenta)
- **Multiplier ring** -- Table surface ring that scales and shifts color with current multiplier
- **Rail glow tubes** -- Neon light tubes along inner rails pulsing with intensity
- **Apron art** -- Chevron patterns and accent shapes above the flippers
- **Theme-reactive art** -- Playfield art tints toward current theme accent color

### Controls

| Action | Keyboard | VR Controller |
|--------|----------|---------------|
| Left Flipper | A / Left Arrow | Left Trigger |
| Right Flipper | D / Right Arrow | Right Trigger |
| Launch Ball | Space (hold & release) | A Button (hold & release) |
| Pause | Escape | B Button |
| Nudge Left | Q | Left Squeeze |
| Nudge Right | E | Right Squeeze |
| Magna-Save Left | Z | Left Thumbstick Left |
| Magna-Save Right | C | Right Thumbstick Right |
| Camera View | V | -- |

## Tech Stack

- **[IWSDK](https://iwsdk.dev) 0.4.1** -- WebXR + browser dual-runtime
- **Three.js** (super-three) -- 3D rendering via @iwsdk/core
- **PanelUI** -- 21 spatial UI panels via .uikitml templates
- **Custom physics** -- Purpose-built 2D pinball engine with substep collision
- **Web Audio API** -- Procedural sound synthesis with theme-reactive ambient
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
  index.ts        -- Entry point, world setup, system registration
  game.ts         -- Game state, scoring, missions, wizard mode, progressive difficulty
  gameloop.ts     -- ECS game loop system (physics, visuals, camera, indicators)
  physics.ts      -- Custom 2D pinball physics engine with adjustable gravity
  table.ts        -- 3D table geometry, bumpers, ramps, orbit checkpoints, indicators
  audio.ts        -- Procedural Web Audio SFX and theme-reactive ambient music
  effects.ts      -- Particle effects with mesh pooling, trails, pulse rings
  ui.ts           -- PanelUI spatial panel management (21 panels)
  xrinput.ts      -- VR controller input mapping
  achievements.ts -- 64 achievements + persistent stats
  themes.ts       -- 5 table color themes + daily challenge generation
  environment.ts  -- Holodeck environment (grid, decorations, intensity-reactive particles)
ui/
  *.uikitml       -- 21 spatial UI templates
```

## License

Built with IWSDK. MIT License.
