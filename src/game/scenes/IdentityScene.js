import Phaser from 'phaser'
import usePortfolioStore from '../../store/usePortfolioStore'
import { isTouchDevice } from '../input/touchControls'
import { viewPage, trackEvent, EVENTS } from '../../lib/analytics'
import { CASTLE } from '../../data/projects'
import { readingColumnWidth, returnHint, enableReadingScroll, enableReturnTap } from './readingLayout'
import { ContentBlocks, THEMES } from './contentBlocks'

// ─── Layout constants (match ProjectScene values) ─────────────────────────────
const NAV_H     = 52
const BOTTOM_H  = 54
const FADE_BASE = 460

// Castle content (CASTLE in projects.js) uses the same fields as a tunnel and is
// rendered by the shared blocks mixed in from contentBlocks.js (purple theme).
export default class IdentityScene extends Phaser.Scene {
  constructor() {
    super({ key: 'IdentityScene' })
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  create() {
    // Re-enable keyboard on every create() — same reasoning as ProjectScene.
    // KeyboardPlugin.enabled is set to false during exit transitions and is not
    // reset between stop() and launch() — the plugin instance is reused.
    this.input.keyboard.enabled = true
    this._leaving = false
    this._theme = THEMES.castle
    usePortfolioStore.getState().setActiveScene('identity')
    // create() runs once per castle entry — one virtual page view each
    viewPage('/castle')

    const W    = this.scale.width
    const H    = this.scale.height
    const colW = readingColumnWidth(W)
    const colX = Math.round(W / 2)

    this._drawBackground(W, H, colX, colW)
    this._drawNav(W, colX, colW)
    const contentBottom = this._drawPage(colX, colW)
    this._drawReturnBar(W, H)
    this._setupExit()
    enableReadingScroll(this, contentBottom, BOTTOM_H)

    // Fade in from the same purple tint used by the overworld's castle fadeOut —
    // completing the colour-matched transition into the identity layer.
    this.cameras.main.fadeIn(400, 28, 8, 56)
  }

  // ─── Layout ──────────────────────────────────────────────────────────────────

  // All background layers are viewport-pinned so content scrolls over them.
  _drawBackground(W, H, colX, colW) {
    // Base fill — slightly purple-tinted to distinguish from ProjectScene's blue-black
    this.add.rectangle(W / 2, H / 2, W, H, 0x080612).setScrollFactor(0)
    // Ambient glow slab behind column
    this.add.rectangle(colX, H / 2, colW + 80, H, 0x0d0a1a).setScrollFactor(0)
    // Main column card — colW + 40 matches ProjectScene's card breathing room
    this.add.rectangle(colX, H / 2, colW + 40, H - 8, 0x100d20, 0.72).setScrollFactor(0)
    // Top accent bar — purple, distinguishes this layer from ProjectScene (green)
    this.add.rectangle(W / 2, 2, W, 4, 0x7c3aed, 0.85).setScrollFactor(0).setDepth(21)
    // Bottom accent bracket — mirrors the top bar at low alpha; matches ProjectScene's bottom rule
    this.add.rectangle(W / 2, H - 2, W, 4, 0x7c3aed, 0.18).setScrollFactor(0).setDepth(21)
    // Left column accent strip — 3px, matching ProjectScene's strip width
    this.add.rectangle(colX - colW / 2 + 2, H / 2, 3, H, 0x4c1d95, 0.35).setScrollFactor(0)

    // Soft purple bloom in the upper scene — low-alpha atmospheric wash.
    // Gives the column area warmth without visible colour cast.
    this.add.rectangle(W / 2, H * 0.22, colW * 1.1, H * 0.44, 0x7c3aed, 0.04).setScrollFactor(0)

    // Horizontal scan lines — barely-perceptible texture that evokes a screen surface.
    // Static rectangles, no per-frame overhead. One line per 8px of scene height.
    for (let i = 0; i < Math.ceil(H / 8); i++) {
      this.add.rectangle(W / 2, i * 8 + 1, W, 1, 0xffffff, 0.025).setScrollFactor(0)
    }
  }

  _drawNav(W, colX, colW) {
    const left = colX - colW / 2

    // Nav is viewport-pinned above scrolling content (depth 20)
    this.add.rectangle(W / 2, NAV_H / 2, W, NAV_H, 0x060410).setScrollFactor(0).setDepth(20)
    this.add.rectangle(W / 2, NAV_H, W, 1, 0x1a1535).setScrollFactor(0).setDepth(20)

    // Breadcrumb — left side
    this.add.text(left, NAV_H / 2, '\u25C4 PORTFOLIO HUB', {
      fontSize: '11px', color: '#64748b', fontFamily: 'monospace',
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(20)

    // Key hint — right side
    // Skipped on phones \u2014 the GET IN TOUCH button occupies that corner
    if (W >= 600) {
      const hint = isTouchDevice() ? 'Swipe to read' : 'ESC / ENTER \u2014 Return'
      this.add.text(colX + colW / 2, NAV_H / 2, hint, {
        fontSize: '11px', color: '#475569', fontFamily: 'monospace',
      }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(20)
    }
  }

  // Castle header (number, title, tags) + shared content blocks. Returns content bottom y.
  _drawPage(colX, colW) {
    const left = colX - colW / 2

    let y = NAV_H + 28

    // ── Header — left-aligned to match ProjectScene layout ────────────────────
    const number = this.add.text(left, y, `CASTLE ${CASTLE.number}`, {
      fontSize: '10px', color: '#a78bfa', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0, 0).setAlpha(0)
    y += number.height + 8

    const titleY = y
    const title  = this.add.text(left, titleY, CASTLE.title, {
      fontSize: colW < 500 ? '22px' : '28px', color: '#f1f5f9', fontFamily: 'monospace', fontStyle: 'bold',
      wordWrap: { width: colW },
    }).setOrigin(0, 0).setAlpha(0)

    // Left accent bar for the title — same visual system as section labels.
    // Anchored at the title's vertical midpoint; height matches the title text.
    const titleBar = this.add.rectangle(
      left - 10, titleY + title.height / 2,
      3, title.height, 0x7c3aed, 0.9,
    ).setOrigin(0.5, 0.5).setAlpha(0)

    y += title.height + 10

    const desc = this.add.text(left, y, CASTLE.tags, {
      fontSize: '13px', color: '#64748b', fontFamily: 'monospace',
      wordWrap: { width: colW }, lineSpacing: 6,
    }).setOrigin(0, 0).setAlpha(0)
    y += desc.height + 16

    const divider = this.add.rectangle(left + colW / 2, y + 4, colW, 1, 0x1e1535).setAlpha(0)
    y += 22

    // Header fades in first, before the sections. titleBar included so the accent
    // marker and title emerge together as a single compositional unit.
    this.time.delayedCall(200, () => {
      this.tweens.add({ targets: [number, title, titleBar, desc, divider], alpha: 1, duration: 300 })
    })

    // ── Content — shared blocks, staggered in after the header ───────────────────
    const { sectionBlocks, y: bottom } = this._drawContent(CASTLE, y, left, colW)
    this._stageContentFadeIn([], sectionBlocks)

    return bottom
  }

  _drawReturnBar(W, H) {
    const barY = H - BOTTOM_H / 2

    // Bar background — starts invisible, fades in after the header so it doesn't
    // compete with the scene entrance. The subtle reveal makes the scene feel complete.
    const barBg = this.add.rectangle(W / 2, barY, W, BOTTOM_H, 0x060410)
      .setScrollFactor(0).setDepth(20).setAlpha(0)
    enableReturnTap(this, barBg, () => this._returnToOverworld())
    const barRule = this.add.rectangle(W / 2, H - BOTTOM_H, W, 1, 0x1a1535)
      .setScrollFactor(0).setDepth(20).setAlpha(0)

    // Mini arch icon — visual callback to the castle entry point in the overworld
    const ix = 44
    const archL = this.add.rectangle(ix - 9, barY, 3, 20, 0x7c3aed).setScrollFactor(0).setDepth(21).setAlpha(0)
    const archR = this.add.rectangle(ix + 9, barY, 3, 20, 0x7c3aed).setScrollFactor(0).setDepth(21).setAlpha(0)
    const archT = this.add.rectangle(ix,     barY - 9, 24, 3, 0x7c3aed).setScrollFactor(0).setDepth(21).setAlpha(0)

    // Return label — two lines matching ProjectScene's return bar layout
    const labelMain = this.add.text(ix + 22, barY - 9, '\u25C4  BACK TO OVERWORLD', {
      fontSize: '12px', color: '#c4b5fd', fontFamily: 'monospace',
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(21).setAlpha(0)

    const labelKey = this.add.text(ix + 22, barY + 7, returnHint(), {
      fontSize: '10px', color: '#475569', fontFamily: 'monospace',
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(21).setAlpha(0)

    // Fade the whole bar in after the header settles — timed with the first section
    this.time.delayedCall(FADE_BASE - 100, () => {
      this.tweens.add({
        targets:  [barBg, barRule, archL, archR, archT, labelMain, labelKey],
        alpha:    1,
        duration: 300,
        ease:     'Sine.easeOut',
      })
    })
  }

  // ─── Input ───────────────────────────────────────────────────────────────────

  _setupExit() {
    const escKey   = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    const enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)

    // Remove stale listeners from previous sessions — same defensive pattern as ProjectScene
    escKey.removeAllListeners('down')
    enterKey.removeAllListeners('down')

    const onExit = () => this._returnToOverworld()
    escKey.on('down', onExit)
    enterKey.on('down', onExit)
  }

  _returnToOverworld() {
    if (this._leaving) return
    this._leaving = true
    this.input.keyboard.enabled = false
    trackEvent(EVENTS.returnHome, { from: 'castle' })
    this.cameras.main.fadeOut(400, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.wake('OverworldScene')
      this.scene.stop()
    })
  }
}

Object.assign(IdentityScene.prototype, ContentBlocks)
