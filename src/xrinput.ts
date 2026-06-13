// Neon Pinball VR - XR Controller Input
// Maps VR controller buttons to pinball actions
// Round 30: Haptic feedback for VR immersion

import { InputComponent } from '@iwsdk/core';

/** Haptic pulse descriptor */
export interface HapticPulse {
  intensity: number;  // 0-1
  duration: number;   // milliseconds
}

/** Predefined haptic patterns for pinball events */
export const HAPTIC_PATTERNS = {
  flipperActivate:    { intensity: 0.3, duration: 40 } as HapticPulse,
  bumperHit:          { intensity: 0.6, duration: 60 } as HapticPulse,
  slingshotHit:       { intensity: 0.4, duration: 50 } as HapticPulse,
  ballLaunch:         { intensity: 0.5, duration: 120 } as HapticPulse,
  ballDrain:          { intensity: 0.7, duration: 200 } as HapticPulse,
  tiltWarning:        { intensity: 0.8, duration: 150 } as HapticPulse,
  tiltFull:           { intensity: 1.0, duration: 300 } as HapticPulse,
  jackpot:            { intensity: 0.9, duration: 180 } as HapticPulse,
  superJackpot:       { intensity: 1.0, duration: 250 } as HapticPulse,
  multiballStart:     { intensity: 1.0, duration: 200 } as HapticPulse,
  comboTierUp:        { intensity: 0.4, duration: 80 } as HapticPulse,
  wizardMode:         { intensity: 1.0, duration: 300 } as HapticPulse,
  magnaSave:          { intensity: 0.5, duration: 100 } as HapticPulse,
  skillShotGood:      { intensity: 0.3, duration: 60 } as HapticPulse,
  skillShotPerfect:   { intensity: 0.7, duration: 120 } as HapticPulse,
  nudge:              { intensity: 0.5, duration: 80 } as HapticPulse,
  ballSaved:          { intensity: 0.4, duration: 100 } as HapticPulse,
  missionComplete:    { intensity: 0.6, duration: 120 } as HapticPulse,
  rampShot:           { intensity: 0.25, duration: 50 } as HapticPulse,
  spinnerHit:         { intensity: 0.15, duration: 30 } as HapticPulse,
  targetHit:          { intensity: 0.2, duration: 40 } as HapticPulse,
  frenzyStart:        { intensity: 0.8, duration: 160 } as HapticPulse,
  milestone:          { intensity: 0.7, duration: 150 } as HapticPulse,
} as const;

export class XRInputHandler {
  private world: any;
  leftFlipperPressed = false;
  rightFlipperPressed = false;
  launchPressed = false;
  launchHeld = false;
  launchPower = 0;
  pausePressed = false;
  confirmPressed = false;
  menuNavUp = false;
  menuNavDown = false;
  nudgeLeft = false;
  nudgeRight = false;
  magnaSaveLeftPressed = false;
  magnaSaveRightPressed = false;

  private prevTriggerLeft = false;
  private prevTriggerRight = false;
  private prevA = false;
  private prevB = false;
  private prevThumbY = 0;
  private prevThumbX = 0;
  private prevLeftThumbX = 0;

  constructor(world: any) {
    this.world = world;
  }

  /**
   * Send haptic pulse to one or both XR controllers.
   * Falls back silently if not in XR or haptics unavailable.
   */
  hapticPulse(pulse: HapticPulse, hand: 'left' | 'right' | 'both' = 'both'): void {
    try {
      const session = this.world.renderer?.xr?.getSession?.();
      if (!session?.inputSources) return;

      for (const source of session.inputSources) {
        if (!source.gamepad?.hapticActuators?.length) continue;
        const h = source.handedness;
        if (hand === 'both' || h === hand) {
          source.gamepad.hapticActuators[0].pulse(pulse.intensity, pulse.duration);
        }
      }
    } catch {
      // Haptics not available — silently ignore
    }
  }

  /** Convenience: left controller only */
  hapticLeft(pulse: HapticPulse): void { this.hapticPulse(pulse, 'left'); }
  /** Convenience: right controller only */
  hapticRight(pulse: HapticPulse): void { this.hapticPulse(pulse, 'right'); }

  update(dt: number): void {
    // Reset per-frame flags
    this.launchPressed = false;
    this.pausePressed = false;
    this.confirmPressed = false;
    this.menuNavUp = false;
    this.menuNavDown = false;
    this.nudgeLeft = false;
    this.nudgeRight = false;
    this.magnaSaveLeftPressed = false;
    this.magnaSaveRightPressed = false;

    const xr = (this.world.input as any)?.xr;
    if (!xr) return;

    const rightGP = xr.gamepads?.right;
    const leftGP = xr.gamepads?.left;

    // Left trigger = left flipper
    if (leftGP) {
      const triggerPressed = leftGP.getButtonPressed?.(InputComponent.Trigger) ?? false;
      this.leftFlipperPressed = triggerPressed;

      // Left squeeze = nudge left
      const squeezeDown = leftGP.getButtonDown?.(InputComponent.Squeeze) ?? false;
      if (squeezeDown) this.nudgeLeft = true;

      // Left thumbstick X = magna-save (flick left for left save)
      const leftThumb = leftGP.getAxesValues?.(InputComponent.Thumbstick);
      if (leftThumb) {
        const lx = leftThumb.x ?? leftThumb[0] ?? 0;
        if (lx < -0.7 && this.prevLeftThumbX >= -0.7) this.magnaSaveLeftPressed = true;
        this.prevLeftThumbX = lx;
      }
    }

    // Right trigger = right flipper (during play) OR launch hold/release (during plunger)
    if (rightGP) {
      const triggerPressed = rightGP.getButtonPressed?.(InputComponent.Trigger) ?? false;
      this.rightFlipperPressed = triggerPressed;

      // Right squeeze = nudge right
      const squeezeDown = rightGP.getButtonDown?.(InputComponent.Squeeze) ?? false;
      if (squeezeDown) this.nudgeRight = true;

      // A button = launch / confirm
      const aDown = rightGP.getButtonDown?.(InputComponent.A_Button) ?? false;
      const aPressed = rightGP.getButtonPressed?.(InputComponent.A_Button) ?? false;
      if (aDown) {
        this.launchPressed = true;
        this.confirmPressed = true;
      }
      this.launchHeld = aPressed;

      // B button = pause
      const bDown = rightGP.getButtonDown?.(InputComponent.B_Button) ?? false;
      if (bDown) this.pausePressed = true;

      // Thumbstick = menu navigation + magna-save right
      const thumbstick = rightGP.getAxesValues?.(InputComponent.Thumbstick);
      if (thumbstick) {
        const y = thumbstick.y ?? thumbstick[1] ?? 0;
        const x = thumbstick.x ?? thumbstick[0] ?? 0;
        if (y > 0.5 && this.prevThumbY <= 0.5) this.menuNavUp = true;
        if (y < -0.5 && this.prevThumbY >= -0.5) this.menuNavDown = true;
        // Flick right for right magna-save
        if (x > 0.7 && this.prevThumbX <= 0.7) this.magnaSaveRightPressed = true;
        this.prevThumbY = y;
        this.prevThumbX = x;
      }
    }

    // Update launch power when holding A
    if (this.launchHeld) {
      this.launchPower = Math.min(1, this.launchPower + dt * 1.5);
    } else {
      if (this.launchPower > 0.1) {
        this.launchPressed = true;
      }
      this.launchPower = 0;
    }
  }
}
