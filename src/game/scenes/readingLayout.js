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
// was the end of a scroll drag, or only stopped a momentum glide. Phaser handles
// DOM input immediately (not on the next frame), so window.open still counts as
// a user gesture on iOS Safari.
export function enableLink(scene, target, url, { onOver, onOut } = {}) {
  target.setInteractive({ useHandCursor: true })
  if (onOver) target.on('pointerover', onOver)
  if (onOut)  target.on('pointerout',  onOut)
  target.on('pointerup', () => {
    if ((scene._dragDistance ?? 0) < 10 && !scene._tapStoppedGlide) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  })
}

// Label for the return bar's secondary line.
export const returnHint = () => (isTouchDevice() ? 'TAP HERE' : 'ESC or ENTER')

// Momentum tuning — matches the feel of native touch scrolling
const FLICK_WINDOW_MS = 100    // velocity is measured over the last 100ms of a drag
const FLICK_STALE_MS  = 80     // finger held still this long before release → no glide
const FRICTION        = 0.965  // velocity multiplier per 60fps frame (~iOS Safari glide-out)
const MAX_VELOCITY    = 4      // px/ms cap so a hard flick can't skip whole sections
const MIN_VELOCITY    = 0.02   // px/ms — below this the glide stops

// Makes the scene scrollable when content runs past the return bar:
// finger / mouse drag with momentum (flick to glide, touch to stop), mouse wheel,
// and ↑ / ↓ arrow keys. A thin scroll indicator on the right edge shows position
// while scrolling and briefly on open, so readers can see there's more below.
// Anything drawn with setScrollFactor(0) (background, nav, return bar) stays pinned.
export function enableReadingScroll(scene, contentBottom, bottomBarH, topBarH = 52) {
  const cam       = scene.cameras.main
  const W         = scene.scale.width
  const H         = scene.scale.height
  const maxScroll = Math.max(0, Math.ceil(contentBottom + bottomBarH + 24 - H))
  const scrollTo  = (y) => { cam.scrollY = Phaser.Math.Clamp(y, 0, maxScroll) }

  scene._dragDistance = 0
  cam.setScroll(0, 0)
  if (maxScroll === 0) return

  // ── Drag + momentum ─────────────────────────────────────────────────────────
  let lastY    = null
  let velocity = 0     // px/ms, positive = scrolling down the page
  let samples  = []    // recent { y, t } pointer positions for flick velocity

  scene.input.on('pointerdown', (p) => {
    // Touching the page stops any glide. Like native scrolling, a tap that stops
    // a glide doesn't also press a link underneath it (see enableLink) — pinned
    // controls like the return bar still respond.
    scene._dragDistance   = 0
    scene._tapStoppedGlide = velocity !== 0
    lastY    = p.y
    velocity = 0
    samples  = [{ y: p.y, t: performance.now() }]
  })
  scene.input.on('pointermove', (p) => {
    if (!p.isDown || lastY === null) return
    const dy = p.y - lastY
    lastY = p.y
    scene._dragDistance += Math.abs(dy)
    scrollTo(cam.scrollY - dy)
    const now = performance.now()
    samples.push({ y: p.y, t: now })
    samples = samples.filter((s) => now - s.t <= FLICK_WINDOW_MS)
  })
  scene.input.on('pointerup', () => {
    lastY = null
    const now   = performance.now()
    const first = samples[0]
    const last  = samples[samples.length - 1]
    if (first && last && last.t > first.t && now - last.t < FLICK_STALE_MS) {
      velocity = Phaser.Math.Clamp((first.y - last.y) / (last.t - first.t), -MAX_VELOCITY, MAX_VELOCITY)
    }
    samples = []
  })
  scene.input.on('wheel', (_p, _over, _dx, dy) => { velocity = 0; scrollTo(cam.scrollY + dy) })

  // ── Scroll indicator ────────────────────────────────────────────────────────
  const trackTop = topBarH + 6
  const trackH   = H - topBarH - bottomBarH - 12
  const thumbH   = Math.max(28, Math.round(trackH * (H / (H + maxScroll))))
  const thumb = scene.add.rectangle(W - 6, trackTop, 4, thumbH, 0xcbd5e1)
    .setOrigin(0.5, 0).setScrollFactor(0).setDepth(22).setAlpha(0)
  let lastScroll = 0
  let activeAt   = performance.now() + 1800  // show ~2.5s on open as a "there's more" hint

  const keys = scene.input.keyboard.createCursorKeys()
  const onUpdate = (_time, delta) => {
    if (keys.down.isDown) { velocity = 0; scrollTo(cam.scrollY + 8) }
    if (keys.up.isDown)   { velocity = 0; scrollTo(cam.scrollY - 8) }

    if (velocity !== 0 && lastY === null) {
      scrollTo(cam.scrollY + velocity * delta)
      velocity *= Math.pow(FRICTION, delta / (1000 / 60))
      const atEdge = cam.scrollY <= 0 || cam.scrollY >= maxScroll
      if (atEdge || Math.abs(velocity) < MIN_VELOCITY) velocity = 0
    }

    const now = performance.now()
    if (cam.scrollY !== lastScroll) { lastScroll = cam.scrollY; activeAt = now }
    thumb.y     = trackTop + (trackH - thumbH) * (cam.scrollY / maxScroll)
    thumb.alpha = now - activeAt < 900 ? 0.7 : Math.max(0, thumb.alpha - delta / 400)
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
