import Phaser from 'phaser'
import { isTouchDevice } from '../input/touchControls'

// Shared behaviour for the two reading scenes (ProjectScene, IdentityScene).

// Reading column width — 24px gutters on phones, capped at 700px on desktop.
export const readingColumnWidth = (W) => (W < 600 ? W - 48 : Math.min(700, W - 120))

// Renders a highlights array as one bulleted line per item.
export const bulletList = (items) => items.map((item) => `▸  ${item}`).join('\n')

// 'https://outliernews.com/' → 'outliernews.com'
export const displayUrl = (url) => url.replace(/^https?:\/\//, '').replace(/\/$/, '')

// Makes a game object open `url` in a new tab on tap/click — unless the tap
// was the end of a scroll drag. Phaser handles DOM input immediately (not on the
// next frame), so window.open still counts as a user gesture on iOS Safari.
export function enableLink(scene, target, url, { onOver, onOut } = {}) {
  target.setInteractive({ useHandCursor: true })
  if (onOver) target.on('pointerover', onOver)
  if (onOut)  target.on('pointerout',  onOut)
  target.on('pointerup', () => {
    if ((scene._dragDistance ?? 0) < 10) window.open(url, '_blank', 'noopener,noreferrer')
  })
}

// Label for the return bar's secondary line.
export const returnHint = () => (isTouchDevice() ? 'TAP HERE' : 'ESC or ENTER')

// Makes the scene scrollable when content runs past the return bar:
// finger / mouse drag, mouse wheel, and ↑ / ↓ arrow keys.
// Anything drawn with setScrollFactor(0) (background, nav, return bar) stays pinned.
export function enableReadingScroll(scene, contentBottom, bottomBarH) {
  const cam       = scene.cameras.main
  const maxScroll = Math.max(0, Math.ceil(contentBottom + bottomBarH + 24 - scene.scale.height))
  const scrollTo  = (y) => { cam.scrollY = Phaser.Math.Clamp(y, 0, maxScroll) }

  scene._dragDistance = 0
  cam.setScroll(0, 0)
  if (maxScroll === 0) return

  let lastY = null
  scene.input.on('pointerdown', (p) => { lastY = p.y; scene._dragDistance = 0 })
  scene.input.on('pointerup',   ()  => { lastY = null })
  scene.input.on('pointermove', (p) => {
    if (!p.isDown || lastY === null) return
    const dy = p.y - lastY
    lastY = p.y
    scene._dragDistance += Math.abs(dy)
    scrollTo(cam.scrollY - dy)
  })
  scene.input.on('wheel', (_p, _over, _dx, dy) => scrollTo(cam.scrollY + dy))

  const keys = scene.input.keyboard.createCursorKeys()
  const onUpdate = () => {
    if (keys.down.isDown) scrollTo(cam.scrollY + 8)
    if (keys.up.isDown)   scrollTo(cam.scrollY - 8)
  }
  // scene.events outlives stop()/launch() cycles — detach so listeners don't stack
  scene.events.on('update', onUpdate)
  scene.events.once('shutdown', () => scene.events.off('update', onUpdate))
}

// Tapping / clicking the return bar exits — unless the tap was the end of a scroll drag.
export function enableReturnTap(scene, bar, onExit) {
  bar.setInteractive({ useHandCursor: true })
  bar.on('pointerup', () => {
    if ((scene._dragDistance ?? 0) < 10) onExit()
  })
}
