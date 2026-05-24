// Neon Pinball VR - XR Controller Input
// Maps VR controller buttons to pinball actions
// Round 5: Magna-Save via thumbstick flick

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
