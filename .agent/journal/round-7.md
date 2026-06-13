# Round 7: Fix Dead Game Loop + Deploy Fixes

**Date**: 2026-06-13 (PM cycle, sentinel pickup)
**Duration**: ~25 minutes
**Commit**: d71c321

## Problem
The game had a dead game loop across all 6 prior rounds. The original code used:
```typescript
(world as any).createSystem({
  update(delta, time) { ... }
})
```
This returns `undefined` — `world.createSystem` does not exist as a method. The correct pattern is:
```typescript
class MySystem extends createSystem({}) {
  update(delta, time) { ... }
}
world.registerSystem(MySystem);
```

Additionally:
- `init()` accessed `this.refs` before `setRefs()` was called, causing `TypeError: Cannot destructure property 'tableGroup' of 'this.refs' as it is undefined`
- 21 PanelUI config paths used root-absolute paths (`'/ui/...'`) which fail on gh-pages subdirectory deploy
- 10 uikitml files contained emoji characters causing "Missing glyph info" font warnings

## Solution
1. Created `src/gameloop.ts` (670 lines) — proper ECS system with all game logic
2. Used lazy initialization: `createBallVisual()` and `wireGameEvents()` deferred to first `update()` frame
3. `sed` replaced all 21 UI paths to relative
4. Python script replaced emojis across 10 uikitml files
5. Moved environment animation from `setInterval` into ECS update loop

## Verification
- `npx iwsdk ecs systems`: 10 systems, PinballGameLoopSystem at index 9
- `npx iwsdk browser logs`: 0 errors, 0 warnings
- `npx tsc --noEmit | grep "^src/"`: 0 errors
- `npm run build`: Success, 4.9 MB dist/
- Deployed to gh-pages, live at https://ellyz2426.github.io/neon-pinball/
