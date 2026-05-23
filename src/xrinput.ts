// Neon Pinball VR - XR Controller Input
// Maps VR controller buttons to pinball actions

import { InputComponent } from '@iwsdk/core';

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

  private prevTriggerLeft = false;
  private prevTriggerRight = false;
  private prevA = false;
  private prevB = false;
  private prevThumbY = 0;

  constructor(world: any) {
    this.world = world;
  }

  update(dt: number): void {
    // Reset per-frame flags
    this.launchPressed = false;
    this.pausePressed = false;
    this.confirmPressed = false;
    this.menuNavUp = false;
    this.menuNavDown = false;
    this.nudgeLeft = false;
    this.nudgeRight = false;

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

      // Thumbstick = menu navigation
      const thumbstick = rightGP.getAxesValues?.(InputComponent.Thumbstick);
      if (thumbstick) {
        const y = thumbstick.y ?? thumbstick[1] ?? 0;
        if (y > 0.5 && this.prevThumbY <= 0.5) this.menuNavUp = true;
        if (y < -0.5 && this.prevThumbY >= -0.5) this.menuNavDown = true;
        this.prevThumbY = y;
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
