import Phaser from 'phaser'
import usePortfolioStore from '../../store/usePortfolioStore'
import PROJECTS from '../../data/projects'
import { isTouchDevice } from '../input/touchControls'
import { viewPage, trackEvent, EVENTS } from '../../lib/analytics'
import { readingColumnWidth, returnHint, enableReadingScroll, enableReturnTap } from './readingLayout'
import { ContentBlocks, META_FIELDS, THEMES } from './contentBlocks'

// ─── Layout constants ─────────────────────────────────────────────────────────
const NAV_H     = 52    // top nav strip height (px)
const BOTTOM_H  = 54    // viewport-pinned return bar height (px)
const MEDIA_H   = 100   // media placeholder panel height

// Content rendering (_drawContent, _drawEntry, _stageContentFadeIn, …) is mixed in
// from contentBlocks.js — see the Object.assign at the bottom of this file.
export default class ProjectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ProjectScene' })
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  create() {
    // Re-enable keyboard on every create() call.
    // KeyboardPlugin.enabled is set to false by _returnToOverworld() to block
    // double-fire during the fade, but Phaser does not reset it between stop()
    // and launch() — the plugin instance is reused. Without this line, every
    // visit after the first has a dead keyboard and no exit path.
    this.input.keyboard.enabled = true
    this._leaving = false
    this._theme = THEMES.tunnel
    usePortfolioStore.getState().setActiveScene('project')

    const { activeProject } = usePortfolioStore.getState()
    const project = PROJECTS.find((p) => p.slug === activeProject?.slug) ?? null

    // Guard: no active project — silently return to overworld.
    if (!project) {
      this.scene.wake('OverworldScene')
      this.scene.stop()
      return
    }

    // create() runs once per tunnel entry — one virtual page view each
    viewPage(`/tunnel/${project.slug}`)
    this._from = project.slug

    const W = this.scale.width
    const H = this.scale.height

    // Centered reading column — capped at 700px, narrower gutters on phones.
    const colW    = readingColumnWidth(W)
    const colLeft = Math.round((W - colW) / 2)

    // Draw order matters — background first so it sits behind all content.
    this._drawBackground(W, H, colLeft, colW)
    this._drawNav(W, colLeft, colW)

    let y = NAV_H + 28

    y = this._drawHeaderContent(project, y, colLeft, colW)

    let mediaObjects = []
    if (project.media) {
      const panel = this._drawMediaPanel(y, colLeft, colW, project.media)
      mediaObjects = panel.objects
      y = panel.y
    }

    const { sectionBlocks, y: contentBottom } = this._drawContent(project, y, colLeft, colW)

    this._drawReturnBar(W, H)
    this._setupExit()
    enableReadingScroll(this, contentBottom, BOTTOM_H)

    // Stage the content fade-in — all timers/tweens are scheduled here in create().
    // Phaser cleans these up automatically when the scene is stopped, so no leak risk.
    this._stageContentFadeIn(mediaObjects, sectionBlocks)

    // Camera fade-in from black — overworld faded out before launching this scene.
    this.cameras.main.fadeIn(400, 0, 0, 0)
  }

  // ─── Background ──────────────────────────────────────────────────────────────

  // All background layers are viewport-pinned so content scrolls over them.
  _drawBackground(W, H, colLeft, colW) {
    // Base fill
    this.add.rectangle(W / 2, H / 2, W, H, 0x080d1a).setScrollFactor(0)

    // Ambient glow slab — slightly lighter than base, behind the column card.
    // Creates a soft vignette that draws the eye toward the content area.
    this.add.rectangle(colLeft + colW / 2, H / 2, colW + 80, H, 0x0b1220).setScrollFactor(0)

    // Column card — the main reading panel
    this.add.rectangle(colLeft + colW / 2, H / 2, colW + 40, H - 8, 0x0d1426, 0.72).setScrollFactor(0)

    // Left-edge accent strip — visually anchors the column
    this.add.rectangle(colLeft - 1, H / 2, 3, H, 0x14532d, 0.35).setScrollFactor(0)

    // Top accent bar — echoes the pipe green from the overworld
    this.add.rectangle(W / 2, 2, W, 4, 0x16a34a, 0.85).setScrollFactor(0).setDepth(21)
    // Bottom bar — dimmer bracket
    this.add.rectangle(W / 2, H - 2, W, 4, 0x16a34a, 0.18).setScrollFactor(0).setDepth(21)
  }

  // ─── Nav strip ───────────────────────────────────────────────────────────────

  _drawNav(W, colLeft, colW) {
    const cx = Math.round(W / 2)

    // Dark strip at top — creates clear zone separation from the header content
    // Nav is viewport-pinned above scrolling content (depth 20)
    this.add.rectangle(cx, NAV_H / 2, W, NAV_H, 0x060b17).setScrollFactor(0).setDepth(20)

    // Breadcrumb — left-aligned to the reading column, vertically centred in nav bar
    this.add.text(colLeft, NAV_H / 2, '\u25C4 PORTFOLIO HUB', {
      fontSize: '11px', color: '#64748b', fontFamily: 'monospace',
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(20)

    // Key hint — right-aligned to the reading column
    // Skipped on phones \u2014 the GET IN TOUCH button occupies that corner
    if (W >= 600) {
      const hint = isTouchDevice() ? 'Swipe to read' : 'ESC / ENTER \u2014 Return'
      this.add.text(colLeft + colW, NAV_H / 2, hint, {
        fontSize: '11px', color: '#475569', fontFamily: 'monospace',
      }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(20)
    }

    // Bottom rule
    this.add.rectangle(cx, NAV_H, W, 1, 0x1a2535).setScrollFactor(0).setDepth(20)
  }

  // ─── Header content ──────────────────────────────────────────────────────────
  // Tunnel number → title → tags → metadata chips → divider rule.
  // Returns updated y cursor (where content starts).

  _drawHeaderContent(project, y, colLeft, colW) {
    // Tunnel number — small accent label above the title
    if (project.number) {
      const numText = this.add.text(colLeft, y, `TUNNEL ${project.number}`, {
        fontSize: '10px', color: '#22c55e', fontFamily: 'monospace', fontStyle: 'bold',
      })
      y += numText.height + 8
    }

    // Title — with left accent bar mirroring the IdentityScene title treatment.
    // The bar anchors the title to the column edge and establishes the scene's
    // accent colour immediately, before any section content appears.
    const titleY    = y
    const titleText = this.add.text(colLeft, y, project.title, {
      fontSize: colW < 500 ? '22px' : '28px', color: '#f1f5f9', fontFamily: 'monospace', fontStyle: 'bold',
      wordWrap: { width: colW },
    })
    this.add.rectangle(colLeft - 10, titleY + titleText.height / 2, 3, titleText.height, 0x22c55e, 0.85)
    y += titleText.height + 10

    // Tags — subdued, supports multi-line wrap
    const descText = this.add.text(colLeft, y, project.tags, {
      fontSize: '13px', color: '#64748b', fontFamily: 'monospace',
      wordWrap: { width: colW }, lineSpacing: 5,
    })
    y += descText.height + 16

    // Metadata row — only rendered when project.meta exists and has at least one field.
    // Fields absent from project.meta are silently omitted from the chip string.
    if (project.meta) {
      const parts = META_FIELDS
        .filter(({ key }) => project.meta[key] != null)
        .map(({ key, label }) => `${label}  ${project.meta[key]}`)

      if (parts.length > 0) {
        const metaText = this.add.text(colLeft, y, parts.join('   ·   '), {
          fontSize: '10px', color: '#475569', fontFamily: 'monospace',
          wordWrap: { width: colW }, lineSpacing: 4,
        })
        y += metaText.height + 10
      }
    }

    // Divider rule — separates the header identity block from the content below
    this.add.rectangle(colLeft + colW / 2, y + 4, colW, 1, 0x1e293b)
    y += 22

    return y
  }

  // ─── Media placeholder panel ─────────────────────────────────────────────────
  // Renders a clearly intentional placeholder that communicates where CMS media
  // (screenshots, video, demo links) will appear once the backend is integrated.
  //
  // Architecture note: when Supabase/Lovable is integrated, replace the panel
  // internals with real image rendering. The method signature (y, colLeft, colW,
  // media) and return shape ({ y, objects }) should remain unchanged — ProjectScene
  // will not need to know whether it's rendering a placeholder or real media.
  //
  // Returns { y: updatedCursor, objects: [ ...phaserObjects ] }
  // objects are initially at alpha 1 — they are set to alpha 0 by _stageContentFadeIn.

  _drawMediaPanel(y, colLeft, colW, media) {
    const objects = []
    const cx   = colLeft + colW / 2
    const midY = y + MEDIA_H / 2

    // Outer border — 1px via layered rectangles (no Graphics API needed)
    objects.push(this.add.rectangle(cx, midY, colW, MEDIA_H, 0x1a2535))
    // Inner fill
    objects.push(this.add.rectangle(cx, midY, colW - 2, MEDIA_H - 2, 0x09101d))

    // Corner accent squares — small green markers at the four corners.
    // These signal "this is a structured media area" and echo the overworld pipe green.
    const cSz = 4, cO = 10, cCol = 0x22c55e
    const corners = [
      [colLeft + cO,         y + cO         ],   // top-left
      [colLeft + colW - cO,  y + cO         ],   // top-right
      [colLeft + cO,         y + MEDIA_H - cO],  // bottom-left
      [colLeft + colW - cO,  y + MEDIA_H - cO],  // bottom-right
    ]
    corners.forEach(([cx2, cy2]) => {
      objects.push(this.add.rectangle(cx2, cy2, cSz, cSz, cCol, 0.55))
    })

    // Subtle 2×2 grid lines — suggest a screenshot / thumbnail grid layout.
    // Very low alpha — structural hint, not visual noise.
    objects.push(this.add.rectangle(cx,    midY, colW - 24, 1,          0x1e3a4a, 0.28))
    objects.push(this.add.rectangle(cx,    midY, 1,         MEDIA_H - 24, 0x1e3a4a, 0.28))

    // Center label stack
    objects.push(
      this.add.text(cx, midY - 18, '[ PROJECT MEDIA ]', {
        fontSize: '11px', color: '#1f3a50', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5)
    )

    // Caption — from project data or sensible fallback
    const caption = media?.caption ?? 'screenshots  ·  demo  ·  walkthrough'
    objects.push(
      this.add.text(cx, midY + 2, caption, {
        fontSize: '10px', color: '#1a3040', fontFamily: 'monospace',
      }).setOrigin(0.5)
    )

    // Integration hint — very dim, purely informational
    objects.push(
      this.add.text(cx, midY + 18, 'media loads here after CMS integration', {
        fontSize: '9px', color: '#111e2d', fontFamily: 'monospace',
      }).setOrigin(0.5)
    )

    return { y: y + MEDIA_H + 26, objects }
  }

  // ─── Return bar ──────────────────────────────────────────────────────────────
  // Viewport-pinned (setScrollFactor 0) and elevated (depth 20+) so it is always
  // visible and always sits above content that extends beyond the viewport height.

  _drawReturnBar(W, H) {
    const stripY = H - BOTTOM_H / 2

    // Bar background — also the tap target for returning on touch devices
    const bar = this.add.rectangle(W / 2, stripY, W, BOTTOM_H, 0x060b17)
      .setScrollFactor(0).setDepth(20)
    enableReturnTap(this, bar, () => this._returnToOverworld())
    // Top rule
    this.add.rectangle(W / 2, H - BOTTOM_H, W, 1, 0x1a2535)
      .setScrollFactor(0).setDepth(20)

    // Mini pipe icon — visual callback to the overworld entry pipe
    const iconX = 42
    this.add.rectangle(iconX, stripY - 6, 28, 8,  0x388e3c).setScrollFactor(0).setDepth(21)
    this.add.rectangle(iconX, stripY + 6, 18, 14, 0x2e7d32).setScrollFactor(0).setDepth(21)

    // Return label
    this.add.text(iconX + 22, stripY - 12, '\u25C4  BACK TO OVERWORLD', {
      fontSize: '12px', color: '#4ade80', fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(21)

    // Key hint
    this.add.text(iconX + 22, stripY + 6, returnHint(), {
      fontSize: '10px', color: '#475569', fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(21)
  }

  // ─── Exit ────────────────────────────────────────────────────────────────────

  _setupExit() {
    const onExit = () => this._returnToOverworld()

    // addKey() returns the same cached Key object across stop()/launch() cycles.
    // KeyboardPlugin.shutdown() resets key state but does not remove listeners
    // from the Key's own EventEmitter, so handlers stack on repeated visits.
    // removeAllListeners('down') wipes any handlers from a previous session
    // before we attach the current one — guaranteeing exactly one handler.
    const escKey   = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    const enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)

    escKey.removeAllListeners('down')
    enterKey.removeAllListeners('down')

    escKey.on('down', onExit)
    enterKey.on('down', onExit)
  }

  _returnToOverworld() {
    // Guard + disable keyboard immediately — prevents a held key or a second tap
    // from firing the exit twice
    if (this._leaving) return
    this._leaving = true
    this.input.keyboard.enabled = false
    trackEvent(EVENTS.returnHome, { from: this._from })

    this.cameras.main.fadeOut(400, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      usePortfolioStore.getState().clearActiveProject()
      // Wake the overworld before stopping this scene so its fadeIn fires correctly.
      // Player position and camera scroll are preserved (the overworld was slept).
      this.scene.wake('OverworldScene')
      this.scene.stop()
    })
  }
}

Object.assign(ProjectScene.prototype, ContentBlocks)
