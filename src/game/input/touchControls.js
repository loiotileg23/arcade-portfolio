// Shared on-screen control state.
// The React <TouchControls> buttons write to `touchState`; Phaser scenes read it
// every frame alongside the keyboard, so a held button behaves exactly like a
// held arrow key.

export const touchState = {
  left:  false,
  right: false,
  up:    false,
  down:  false,
}

export const releaseAllTouch = () => {
  touchState.left = touchState.right = touchState.up = touchState.down = false
}

// True on phones/tablets (iOS Safari, Android Chrome). Desktop with a mouse is false,
// even on a touchscreen laptop, so the keyboard HUD stays the default there.
export const isTouchDevice = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: none) and (pointer: coarse)').matches
