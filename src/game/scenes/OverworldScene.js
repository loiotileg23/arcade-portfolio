import Phaser from 'phaser'
import usePortfolioStore, { isModalOpen } from '../../store/usePortfolioStore'
import { viewPage } from '../../lib/analytics'
import PROJECTS, { CASTLE } from '../../data/projects'
import { SoundManager } from '../audio/SoundManager'
import { touchState, isTouchDevice } from '../input/touchControls'

const WORLD_WIDTH     = 3600
const GROUND_H        = 64
const PIPE_ENTER_DIST   = 70   // px from pipe center — shows hint + enables interaction
const CASTLE_ENTER_DIST = 60   // px from door stop face — player stands in gate gap
const ZONE_ENTRY_X      = 2500 // player crosses this to trigger the zone entry flash

// Platform definitions — dy is relative to groundTop (negative = above ground).
// Intentionally spaced across the world: intro zone, mid-world, late-world.
// x values are kept clear of pipe positions (700, 1400, 2200) so nothing stacks.
const PLAT_DEFS = [
  { x: 520,  dy: -150, w: 140, h: 20 },   // intro zone — first jump challenge
  { x: 1080, dy: -190, w: 140, h: 20 },   // between pipe 1 and pipe 2
  { x: 1820, dy: -155, w: 140, h: 20 },   // between pipe 2 and pipe 3
]

export default class OverworldScene extends Phaser.Scene {
  constructor() {
    super({ key: 'OverworldScene' })
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  create() {
    this._groundTop   = this.scale.height - GROUND_H
    this._statics     = []   // all static physics bodies, for batch collider setup
    this._enterLocked = false
    this._castleNear  = false  // tracks hint proximity state so tween only fires on change
    this._castleSteps = []     // static step bodies — walked up automatically by _autoStepUp

    // Audio + movement feedback state
    this._wasOnGroundLastFrame = true
    this._stepFrame            = 0
    this._stopDoorHum          = null
    this._flickerWindows       = []   // window overlays driven by _setupBuildingFlicker

    this._createWorld()
    this._createIntroArea()  // heading, signpost, controls hint
    this._createPlayer()
    this._createPipes()
    this._createFinalZone()  // castle entry — end of the overworld
    this._setupCamera()
    this._setupInput()
    this._setupBuildingFlicker()

    // Fade in on initial load
    this.cameras.main.fadeIn(400, 0, 0, 0)

    // Wake handler — fires every time this scene is resumed from sleep.
    // Because the scene was slept (not stopped), player position, camera scroll,
    // and all physics state are perfectly preserved. We only need to re-enable
    // input and fade back in from the black state the camera was left in.
    usePortfolioStore.getState().setActiveScene('overworld')

    this.events.on('wake', () => {
      this.input.keyboard.enabled = true
      usePortfolioStore.getState().setActiveScene('overworld')
      // The first overworld view is the page load itself; each return counts once here
      viewPage('/')
      // Reset portal flash so it doesn't linger as a purple overlay on return
      if (this._portalFlash) this._portalFlash.setAlpha(0)
      // Ensure any door hum from before entry is silenced; reset proximity state
      // so _checkCastleInteraction re-evaluates cleanly next frame
      if (this._stopDoorHum) { this._stopDoorHum(); this._stopDoorHum = null }
      this._castleNear = false
      this.cameras.main.fadeIn(400, 0, 0, 0)
    })
  }

  update() {
    this._ctrl = this._readControls()
    this._autoStepUp()
    this._handleMovement()
    this._updatePlayerSprite()
    this._handleAudio()
    this._checkPipeInteractions()
    this._checkCastleInteraction()
  }

  // -------------------------------------------------------------------------
  // World geometry
  // -------------------------------------------------------------------------

  _createWorld() {
    const W  = WORLD_WIDTH
    const H  = this.scale.height
    const gt = this._groundTop

    // Background fill
    this.add.rectangle(W / 2, H / 2, W, H, 0x1a1a2e)

    // Star field — deterministic spread so the scene is identical on every load.
    // Positions are generated via simple modular arithmetic across the full world width.
    for (let i = 0; i < 80; i++) {
      const sx    = ((i * 419 + 83) % (W - 200)) + 100
      const sy    = ((i * 131 + 40) % Math.floor(gt * 0.72)) + 24
      const size  = i % 6 === 0 ? 3 : 2
      const alpha = i % 3 === 0 ? 0.65 : 0.3
      this.add.rectangle(sx, sy, size, size, 0xffffff, alpha)
    }

    // Far mountain silhouettes — scrollFactor 0.12. Each peak has a shoulder peak
    // beside it and a faint snow cap to break up the solid rectangular read.
    const FAR_MTN_DEFS = [
      { x: 150,  w: 220, h: 190 }, { x: 430,  w: 270, h: 240 },
      { x: 720,  w: 200, h: 170 }, { x: 1020, w: 260, h: 220 },
      { x: 1310, w: 240, h: 200 }, { x: 1580, w: 300, h: 250 },
      { x: 1860, w: 210, h: 175 }, { x: 2100, w: 250, h: 215 },
    ]
    FAR_MTN_DEFS.forEach(({ x, w, h }, i) => {
      const sf = 0.12
      // Main body
      this.add.rectangle(x, gt - h / 2, w, h, 0x070e1b).setScrollFactor(sf)
      // Narrow peak cap — breaks boxy top
      this.add.rectangle(x, gt - h - h * 0.18, Math.round(w * 0.36), Math.round(h * 0.34), 0x060c19).setScrollFactor(sf)
      // Shoulder peak — alternates left/right so adjacent mountains feel varied
      const sx = x + (i % 2 === 0 ? w * 0.38 : -w * 0.38)
      this.add.rectangle(sx, gt - h * 0.38, Math.round(w * 0.45), Math.round(h * 0.55), 0x070e1b).setScrollFactor(sf)
      // Faint snow cap on main peak
      this.add.rectangle(x, gt - h - h * 0.28, Math.round(w * 0.18), 7, 0xc8d8e8, 0.10).setScrollFactor(sf)
    })

    // City silhouette layer — scrollFactor 0.20, between far mountains and mid hills.
    // Clusters of different-height rectangles imply a distant skyline without any assets.
    const CITY_CLUSTERS = [
      { x: 220,  bldgs: [{ ox:-28, w:18, h:58 }, { ox: 0, w:14, h:76 }, { ox:26, w:20, h:48 }] },
      { x: 590,  bldgs: [{ ox:-22, w:16, h:52 }, { ox: 6, w:12, h:68 }, { ox:28, w:18, h:44 }] },
      { x: 950,  bldgs: [{ ox:-32, w:22, h:62 }, { ox:-4, w:16, h:84 }, { ox:24, w:14, h:54 }] },
      { x: 1320, bldgs: [{ ox:-26, w:18, h:70 }, { ox: 4, w:20, h:82 }, { ox:32, w:16, h:52 }] },
      { x: 1680, bldgs: [{ ox:-30, w:20, h:64 }, { ox: 2, w:14, h:72 }, { ox:26, w:22, h:50 }] },
    ]
    CITY_CLUSTERS.forEach(({ x, bldgs }, ci) => {
      bldgs.forEach(({ ox, w, h }, bi) => {
        const bx = x + ox
        // Building body
        this.add.rectangle(bx, gt - h / 2, w, h, 0x0b1826).setScrollFactor(0.20)
        // Tiny window slots — 2 per building, stacked near the top
        this.add.rectangle(bx - 3, gt - h + 14, 4, 4, 0x1a2f42, 0.7).setScrollFactor(0.20)
        this.add.rectangle(bx + 3, gt - h + 14, 4, 4, 0x1a2f42, 0.7).setScrollFactor(0.20)
        this.add.rectangle(bx,     gt - h + 24, 4, 4, 0x1a2f42, 0.5).setScrollFactor(0.20)
        // Light overlay for flicker — transparent by default, tweened by _setupBuildingFlicker.
        // One overlay per cluster (tallest building, bi===1 is the tallest in each set).
        if (bi === 1) {
          const fw = this.add.rectangle(bx + 3, gt - h + 14, 4, 4, 0x8ec8e0, 0).setScrollFactor(0.20)
          this._flickerWindows.push(fw)
        }
      })
    })

    // Mid hills — scrollFactor 0.30. Each has a secondary smaller hill beside it
    // and a treeline band at the base to break the solid silhouette.
    const MID_HILL_DEFS = [
      { x: 280,  w: 370, h: 100 }, { x: 700,  w: 310, h:  78 },
      { x: 1180, w: 400, h: 108 }, { x: 1680, w: 340, h:  88 },
      { x: 2080, w: 410, h: 102 }, { x: 2550, w: 350, h:  92 },
    ]
    MID_HILL_DEFS.forEach(({ x, w, h }, i) => {
      const sf = 0.30
      this.add.rectangle(x, gt - h / 2, w, h, 0x0e1d2e).setScrollFactor(sf)
      // Secondary shoulder hill
      const sh = Math.round(h * 0.62)
      const sx  = x + (i % 2 === 0 ? w * 0.42 : -w * 0.42)
      this.add.rectangle(sx, gt - sh / 2, Math.round(w * 0.5), sh, 0x0c1b2c).setScrollFactor(sf)
      // Treeline band — dark strip just above ground line suggesting tree canopy
      this.add.rectangle(x, gt - 6, w, 10, 0x0a1828, 0.7).setScrollFactor(sf)
    })

    // Distant background hills — simple layered rectangles drawn behind the ground.
    // The varying widths and heights break the horizon and add scene depth without
    // needing any image assets.
    const HILL_DEFS = [
      { x: 350,  w: 480, h: 115, c: 0x0d1c35 },
      { x: 950,  w: 420, h:  85, c: 0x111d30 },
      { x: 1620, w: 500, h: 135, c: 0x0d1c35 },
      { x: 2340, w: 400, h:  95, c: 0x111d30 },
      { x: 2920, w: 380, h: 120, c: 0x0d1c35 },
    ]
    HILL_DEFS.forEach(({ x, w, h, c }) => {
      this.add.rectangle(x, gt - h / 2, w, h, c)
    })

    // Ground
    const ground = this.add.rectangle(W / 2, gt + GROUND_H / 2, W, GROUND_H, 0x5c4033)
    this.physics.add.existing(ground, true)
    this._statics.push(ground)

    // Thin surface accent at ground top — separates sky from earth more clearly
    this.add.rectangle(W / 2, gt, W, 3, 0x7a5c40)

    // Platforms — layered for surface depth: dark base, lighter top edge, subtle shadow below
    PLAT_DEFS.forEach(({ x, dy, w, h }) => {
      this.add.rectangle(x, gt + dy + 2, w, h,     0x3d6b26)          // shadow underside
      const plat = this.add.rectangle(x, gt + dy, w, h, 0x4d7a30)    // main platform
      this.add.rectangle(x, gt + dy - h / 2 + 2, w - 2, 3, 0x7ab84a) // bright top edge
      this.add.rectangle(x, gt + dy - h / 2 + 5, w - 6, 1, 0x5ea038, 0.6) // secondary highlight
      this.physics.add.existing(plat, true)
      this._statics.push(plat)
    })
  }

  // -------------------------------------------------------------------------
  // Intro / start area  (left side of the overworld)
  // Requirements: heading, signpost, controls hint
  // -------------------------------------------------------------------------

  _createIntroArea() {
    const H  = this.scale.height
    const SW = this.scale.width    // screen dimensions for the viewport-fixed HUD
    const gt = this._groundTop

    this._createBillboard(H, gt)
    this._createSignpost(gt)
    this._createControlsHUD(H, SW)
  }

  // ── Title Billboard ────────────────────────────────────────────────────────
  // Framed world-space panel positioned above-left of player spawn (x=350).
  // Visible immediately when the scene loads — the camera at spawn shows x 0→SW,
  // so the billboard at x=210 reads as context before the player moves.
  _createBillboard(H, gt) {
    // Phones: centre over the spawn point, where the camera starts — at x=210 the
    // left half would sit off-screen on a ~390px viewport
    const bx = this.scale.width < 600 ? 350 : 210
    const bw = 318
    // Top edge sits where the original 98px board's did; the board grows downward
    // to fit the text (its height is set once the text has been measured, below)
    const top = Math.round(H * 0.20) - 49

    // Border then fill (layered rectangles — no Graphics API needed)
    const border = this.add.rectangle(bx, top, bw + 2, 2, 0x1a3d28).setOrigin(0.5, 0)  // 1px green border
    const fill   = this.add.rectangle(bx, top + 1, bw, 1, 0x07101e).setOrigin(0.5, 0)  // dark fill

    // Top accent bar
    this.add.rectangle(bx, top, bw, 2, 0x22c55e, 0.7)

    // Title
    this.add.text(bx, top + 29, 'INTERACTIVE PORTFOLIO', {
      fontSize: '19px', color: '#f1f5f9', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5)

    // Subtitle
    this.add.text(bx, top + 55, 'AA Holdings Studio', {
      fontSize: '12px', color: '#4ade80', fontFamily: 'monospace',
    }).setOrigin(0.5)

    // Positioning — who's behind the work, readable before entering a tunnel
    this.add.text(bx, top + 78, 'INDUSTRIAL ENGINEER · ENTERPRISE SALES\nTECHNOLOGY BUILDER', {
      fontSize: '10px', color: '#fbbf24', fontFamily: 'monospace', fontStyle: 'bold',
      align: 'center', lineSpacing: 2,
    }).setOrigin(0.5, 0)

    const statement = this.add.text(bx, top + 108,
      'Bridging engineering, business development, and artificial intelligence through ' +
      'technical problem-solving, commercial experience, and independent software development.', {
      fontSize: '10px', color: '#cbd5e1', fontFamily: 'monospace',
      align: 'center', lineSpacing: 2, wordWrap: { width: bw - 28 },
    }).setOrigin(0.5, 0)

    // In-world call-to-action, below however many lines the statement wrapped to
    const hint = this.add.text(bx, statement.y + statement.height + 10, 'walk right  ·  enter a pipe  ·  explore the work', {
      fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace',
    }).setOrigin(0.5, 0)

    const bh = hint.y + hint.height + 12 - top
    border.setSize(bw + 2, bh + 2).setPosition(bx, top - 1)
    fill.setSize(bw, bh).setPosition(bx, top)
  }

  // ── Signpost ───────────────────────────────────────────────────────────────
  // Two-board post planted between player spawn (x=350) and the first pipe (x=700).
  // Upper board: what the action is.  Lower board: where to go.
  // Post is 70px tall so its bottom aligns flush with groundTop.
  _createSignpost(gt) {
    const sx  = 500
    const sph = 70   // post height — bottom at gt, top at gt-70

    // Post
    this.add.rectangle(sx, gt - sph / 2, 8, sph, 0x8b5e3c)

    // Upper board — action instruction
    // Center Y gt-60: board spans gt-73 to gt-47, nailed near top of post
    this.add.rectangle(sx, gt - 60, 152, 30, 0x112211)   // outer border
    this.add.rectangle(sx, gt - 60, 148, 26, 0x1a3322)   // inner fill
    this.add.text(sx, gt - 60, 'ENTER  ↓', {
      fontSize: '11px', color: '#86efac', fontFamily: 'monospace',
    }).setOrigin(0.5)

    // Lower board — direction cue
    // Center Y gt-33: board spans gt-44 to gt-22, sits below upper with 3px gap
    this.add.rectangle(sx, gt - 33, 152, 26, 0x111a2e)   // outer border
    this.add.rectangle(sx, gt - 33, 148, 22, 0x1a2440)   // inner fill
    this.add.text(sx, gt - 33, 'PROJECTS  →', {
      fontSize: '11px', color: '#93c5fd', fontFamily: 'monospace',
    }).setOrigin(0.5)
  }

  // ── Controls HUD ──────────────────────────────────────────────────────────
  // Viewport-pinned panel (setScrollFactor 0) — always visible in the
  // bottom-right corner regardless of camera scroll position.
  // Coordinates here are screen pixels, not world pixels.
  _createControlsHUD(H, SW) {
    // Touch devices get the on-screen pad (React <TouchControls>) in this corner instead
    if (isTouchDevice()) return

    const panW  = 220
    const panH  = 88
    const panCX = SW - panW / 2 - 14   // 14px inset from right edge
    const panCY = H  - panH / 2 - 14   // 14px inset from bottom edge

    // Panel — border color under fill
    this.add.rectangle(panCX, panCY, panW + 2, panH + 2, 0x1e293b)
      .setScrollFactor(0).setDepth(10)
    this.add.rectangle(panCX, panCY, panW, panH, 0x020810, 0.90)
      .setScrollFactor(0).setDepth(10)

    // Text layout — left-aligned inside the panel
    const lx = panCX - panW / 2 + 10
    const ty = panCY - panH / 2 + 10

    // Header
    this.add.text(lx, ty, 'CONTROLS', {
      fontSize: '9px', color: '#475569', fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(11)

    // Divider line under header
    this.add.rectangle(panCX, ty + 12, panW - 20, 1, 0x1e293b)
      .setScrollFactor(0).setDepth(11)

    // Key / action rows — two columns: left=keys, right=action label
    const rows = [
      ['← → / A D', 'Move'],
      ['↑ / W',      'Jump'],
      ['↓ / S',      'Enter'],
    ]
    rows.forEach(([keys, action], i) => {
      const ry = ty + 21 + i * 17
      this.add.text(lx,      ry, keys,   { fontSize: '10px', color: '#64748b', fontFamily: 'monospace' })
        .setScrollFactor(0).setDepth(11)
      this.add.text(lx + 94, ry, action, { fontSize: '10px', color: '#e2e8f0', fontFamily: 'monospace' })
        .setScrollFactor(0).setDepth(11)
    })
  }

  // -------------------------------------------------------------------------
  // Player
  // -------------------------------------------------------------------------

  _createPlayer() {
    const gt = this._groundTop

    // Physics body — invisible; visual sprite parts track its position each frame
    this.player = this.add.rectangle(350, gt - 80, 28, 44, 0xe8c547, 0)
    this.physics.add.existing(this.player)
    this.player.body.setCollideWorldBounds(true)
    this._statics.forEach((s) => this.physics.add.collider(this.player, s))

    // Pixel-art character parts (offsets relative to physics body centre, depth 2)
    const p = (ox, oy, w, h, c, a = 1) =>
      this.add.rectangle(350 + ox, gt - 80 + oy, w, h, c, a).setDepth(2)

    this._sprite = {
      shadow: p( 0,  24, 22,  4, 0x000000, 0.25),  // ground shadow
      legL:   p(-5,  17,  8, 12, 0x1a2d4a),         // left leg — slate-blue, distinct from shirt
      legR:   p( 5,  17,  8, 12, 0x1a2d4a),         // right leg
      armL:   p(-15,  2,  6, 10, 0x1d4ed8),         // left arm
      armR:   p( 15,  2,  6, 10, 0x1d4ed8),         // right arm
      shirt:  p( 0,   2, 18, 14, 0x1d4ed8),         // body / hoodie
      stripe: p( 0,  -1, 18,  2, 0x60a5fa, 0.85),  // chest stripe — lighter blue accent
      hood:   p( 0, -15, 24, 10, 0x1d4ed8),         // hoodie hood — wider than head
      collar: p( 0,  -4, 10,  4, 0x2563eb),         // collar highlight
      head:   p( 0, -11, 20, 16, 0xf0b87d),         // head / skin
      chin:   p( 0,  -4,  16,  3, 0xd4955a, 0.55), // chin shadow
      hair:   p( 0, -20, 22,  7, 0x2d1b00),         // hair (slightly wider)
      hairHL: p(-7, -20,  5,  5, 0x4a2f0a, 0.6),   // hair highlight
      eyeL:   p(-5, -12,  3,  3, 0x1a1208),         // left eye
      eyeR:   p( 5, -12,  3,  3, 0x1a1208),         // right eye
    }

    this._walkFrame   = 0
    this._facingRight = true
    this._idleBob     = 0

    // Idle breath bob — drives a shared Y offset on upper body when standing still
    this.tweens.add({
      targets:  this,
      _idleBob: -2,
      duration: 900,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    })
  }

  _updatePlayerSprite() {
    const s  = this._sprite
    const px = this.player.x
    const py = this.player.y
    const vx = this.player.body.velocity.x
    const onGround = this.player.body.blocked.down
    const moving   = Math.abs(vx) > 10

    if (vx > 10)  this._facingRight = true
    if (vx < -10) this._facingRight = false

    if (moving && onGround) this._walkFrame++
    const legSwap   = (this._walkFrame % 16 < 8)
    const legOffset = moving ? 3 : 0
    // Sine-wave swing gives a smooth, natural arc instead of a hard toggle
    const armSwing  = moving ? Math.sin(this._walkFrame * Math.PI / 8) * 5 : 0

    // Idle bob only applies when standing still on the ground
    const bob = (onGround && !moving) ? this._idleBob : 0

    s.hair.setPosition(px,           py - 20 + bob)
    s.hairHL.setPosition(px - 7,     py - 20 + bob)
    s.hood.setPosition(px,           py - 15 + bob)
    s.head.setPosition(px,           py - 11 + bob)
    s.chin.setPosition(px,           py -  4 + bob)
    const ep = this._facingRight ? 1 : -1
    s.eyeL.setPosition(px - 5 + ep,  py - 12 + bob)
    s.eyeR.setPosition(px + 5 + ep,  py - 12 + bob)
    s.collar.setPosition(px,         py -  4 + bob)
    s.shirt.setPosition(px,          py +  2)
    s.stripe.setPosition(px,         py -  1)
    s.armL.setPosition(px - 15,      py +  2 - armSwing)
    s.armR.setPosition(px + 15,      py +  2 + armSwing)
    s.legL.setPosition(px - 5,       py + 17 - (legSwap ? legOffset : -legOffset))
    s.legR.setPosition(px + 5,       py + 17 + (legSwap ? legOffset : -legOffset))
    s.shadow.setPosition(px, py + 24)
    s.shadow.setAlpha(onGround ? 0.25 : 0.08)
  }

  // -------------------------------------------------------------------------
  // Pipes
  // -------------------------------------------------------------------------

  _createPipes() {
    const gt = this._groundTop

    this.pipeObjects = PROJECTS.map(({ id, slug, title, x, label, number }) => {
      // Shaft — layered shading: dark base, left highlight strip, right shadow strip, inner shimmer
      this.add.rectangle(x,      gt - 40, 52, 80, 0x1b5e20)           // base (darkest)
      this.add.rectangle(x - 18, gt - 40,  8, 76, 0x4caf50)           // left highlight
      this.add.rectangle(x + 20, gt - 40, 10, 80, 0x0a2e10)           // right shadow
      this.add.rectangle(x - 12, gt - 40,  2, 72, 0x388e3c, 0.55)     // inner shimmer line
      // Cap — lip with highlight on top and shadow on bottom
      this.add.rectangle(x,  gt - 90, 64, 20, 0x1b5e20)               // cap base
      this.add.rectangle(x,  gt - 98, 62,  4, 0x66bb6a)               // top highlight
      this.add.rectangle(x,  gt - 81, 62,  4, 0x0a2e10)               // bottom shadow
      this.add.rectangle(x,  gt - 79, 66,  4, 0x0d3b14)               // lip underside
      // Tunnel number stamped on the cap face
      if (number) {
        this.add.text(x, gt - 89, number, {
          fontSize: '11px', color: '#dcfce7', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5)
      }

      // Invisible collider so the player can stand on top of the pipe
      const col = this.add.rectangle(x, gt - 40, 52, 80, 0x000000, 0)
      this.physics.add.existing(col, true)
      this.physics.add.collider(this.player, col)

      // Title card above the pipe — framed plate with tunnel number + name.
      // Sits above head height (player standing on the cap tops out at gt-144),
      // so it stays readable while the player is on the pipe.
      const cardY   = gt - 180
      const numText = this.add.text(x, cardY - 8, number ? `TUNNEL ${number}` : '', {
        fontSize: '9px', color: '#4ade80', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(2)
      const nameText = this.add.text(x, cardY + 8, label, {
        fontSize: '13px', color: '#f1f5f9', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(2)
      const cardW = Math.max(numText.width, nameText.width) + 24
      this.add.rectangle(x, (cardY + 21 + gt - 100) / 2, 2, gt - 100 - cardY - 21, 0x1a3d28)
        .setDepth(1)                                                             // post down to the cap
      this.add.rectangle(x, cardY, cardW + 2, 42, 0x1a3d28).setDepth(1)        // border
      this.add.rectangle(x, cardY, cardW,     40, 0x07101e, 0.92).setDepth(1)  // fill
      this.add.rectangle(x, cardY - 20, cardW, 2, 0x22c55e, 0.7).setDepth(1)   // top accent

      // Proximity hint — hidden until player is near
      const hint = this.add.text(x, cardY - 36, '\u2193 Enter', {
        fontSize:   '12px',
        color:      '#86efac',
        fontFamily: 'monospace',
      }).setOrigin(0.5).setAlpha(0)

      return { id, slug, title, x, hint }
    })
  }

  // -------------------------------------------------------------------------
  // Camera
  // -------------------------------------------------------------------------

  _setupCamera() {
    const W = WORLD_WIDTH
    const H = this.scale.height
    this.cameras.main.setBounds(0, 0, W, H)
    this.physics.world.setBounds(0, 0, W, H)
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08)
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  _setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd    = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    })
  }

  // Merges keyboard (arrows + WASD) and the on-screen touch pad into one
  // { left, right, up, down } snapshot, read once per frame.
  _readControls() {
    // Skills or contact panel open — the player stands still until it closes
    if (isModalOpen()) {
      return { left: false, right: false, up: false, down: false }
    }
    const c = this.cursors
    const w = this.wasd
    return {
      left:  c.left.isDown  || w.left.isDown  || touchState.left,
      right: c.right.isDown || w.right.isDown || touchState.right,
      up:    c.up.isDown    || w.up.isDown    || touchState.up,
      down:  c.down.isDown  || w.down.isDown  || touchState.down,
    }
  }

  // -------------------------------------------------------------------------
  // Per-frame
  // -------------------------------------------------------------------------

  _handleMovement() {
    const body    = this.player.body
    const { left, right, up } = this._ctrl
    const onGround = body.blocked.down

    if (left) {
      body.setVelocityX(-240)
    } else if (right) {
      body.setVelocityX(240)
    } else {
      body.setVelocityX(0)
    }

    if (up && onGround) {
      body.setVelocityY(-520)
    }
  }

  // ── Castle stair climbing ─────────────────────────────────────────────────
  // Walking into a castle step's riser lifts the player onto it, so the stairs
  // climb like stairs instead of acting as a row of 16px walls to jump over.
  _autoStepUp() {
    const b = this.player.body
    if (!b.blocked.down) return
    const dir = b.blocked.right ? 1 : b.blocked.left ? -1 : 0
    if (!dir) return

    for (const step of this._castleSteps) {
      const rise     = b.bottom - step.top
      const adjacent = dir > 0
        ? Math.abs(step.left - b.right) < 2
        : Math.abs(step.right - b.left) < 2
      if (adjacent && rise > 0 && rise <= 17) {
        this.player.y -= rise + 1
        this.player.x += dir * 2
        b.updateFromGameObject()
        b.setVelocityY(0)
        return
      }
    }
  }

  // ── Audio + movement feedback ─────────────────────────────────────────────
  // Runs every frame after movement. Detects landing, jump start, and footstep
  // cadence, then delegates to SoundManager and visual feedback helpers.

  _handleAudio() {
    const onGround = this.player.body.blocked.down
    const vx       = this.player.body.velocity.x
    const vy       = this.player.body.velocity.y
    const moving   = Math.abs(vx) > 10

    // Landing — was airborne last frame, now on ground
    if (!this._wasOnGroundLastFrame && onGround) {
      SoundManager.land()
      this._spawnLandingDust()
    }

    // Jump start — was on ground last frame, now airborne and moving up
    if (this._wasOnGroundLastFrame && !onGround && vy < -80) {
      SoundManager.jump()
    }

    // Footstep — every 16 walk frames (one full leg cycle)
    if (moving && onGround) {
      if (++this._stepFrame % 16 === 0) SoundManager.footstep()
    } else if (!onGround || !moving) {
      this._stepFrame = 0
    }

    this._wasOnGroundLastFrame = onGround
  }

  // Small dust cloud at foot level on landing — 3 rectangles that spread and fade.
  _spawnLandingDust() {
    const px = this.player.x
    const py = this.player.y
    for (let i = 0; i < 3; i++) {
      const ox   = (i - 1) * 11
      const dust = this.add.rectangle(px + ox, py + 20, 5, 3, 0xb06228, 0.45).setDepth(1)
      this.tweens.add({
        targets:  dust,
        scaleX:   2.8,
        scaleY:   0.4,
        alpha:    0,
        duration: 260,
        ease:     'Power2.Out',
        onComplete: () => dust.destroy(),
      })
    }
  }

  _checkPipeInteractions() {
    const px       = this.player.x
    const onGround = this.player.body.blocked.down
    const { down } = this._ctrl

    for (const pipe of this.pipeObjects) {
      const near = Math.abs(px - pipe.x) < PIPE_ENTER_DIST && onGround
      pipe.hint.setAlpha(near ? 1 : 0)

      if (near && down && !this._enterLocked) {
        this._enterLocked = true
        usePortfolioStore.getState().setActiveProject(pipe.slug, pipe.title)
        // Disable keyboard so no input fires during the fade transition
        this.input.keyboard.enabled = false
        this.cameras.main.fadeOut(400, 0, 0, 0)
        this.cameras.main.once('camerafadeoutcomplete', () => {
          // Launch ProjectScene alongside this scene, then sleep this scene.
          // sleep() keeps the entire scene in memory — player x/y, camera scroll,
          // physics state — so the return journey lands exactly where the player left.
          this.scene.launch('ProjectScene')
          this.scene.sleep()
        })
      }
    }

    // Reset lock when down key is released — prevents re-triggering on a held key
    if (!down) {
      this._enterLocked = false
    }
  }

  // ── Ambient building flicker ──────────────────────────────────────────────
  // Drives the light overlays stored in _flickerWindows. Each window picks a
  // random interval, briefly pulses to simulate a light turning on, then waits
  // before the next pulse. Staggered start delays prevent synchronised flashing.
  _setupBuildingFlicker() {
    this._flickerWindows.forEach((win, i) => {
      const scheduleNext = () => {
        const delay = 3500 + Math.random() * 9000 + i * 1400
        this.time.delayedCall(delay, () => {
          this.tweens.add({
            targets:  win,
            alpha:    0.55,
            duration: 100,
            yoyo:     true,
            ease:     'Sine.easeInOut',
            onComplete: scheduleNext,
          })
        })
      }
      // Stagger initial fires so windows don't all wake at t=0
      this.time.delayedCall(i * 800, scheduleNext)
    })
  }

  // -------------------------------------------------------------------------
  // Final zone — identity / castle entry at the far right of the overworld
  // -------------------------------------------------------------------------

  _createFinalZone() {
    const W  = WORLD_WIDTH
    const H  = this.scale.height
    const gt = this._groundTop

    // ── Layout constants ──────────────────────────────────────────────────────
    // ax=3000: castle center, moved right from 2760 so the CTA card and castle
    // each occupy their own third of the viewport at comfortable screen widths.
    // pillarH=300: gate arch height — gate arch is 110px taller than before so the
    // structure reads as a true fortification rather than a decorative doorway.
    const ax      = 3000
    const pillarH = 300

    // Seven-tower HQ silhouette: far-outer×2 | outer×2 | inner×2 | KEEP
    // Heights graduate outward-shorter so the center keep is the dominant peak.
    // ALL towers and walls are visual-only — zero physics bodies on any castle element.
    const FOW = 38   // far outer width
    const FOH = 250  // far outer height
    const OTW = 42   // outer width
    const OTH = 285  // outer height
    const MTW = 34   // inner (gate-flanking) width
    const MTH = 255  // inner height
    const KTW = 56   // center keep width
    const KTH = 380  // center keep height — tallest, near the sky

    // X positions — symmetric about ax=3000
    const fotLX = ax - 230   // far outer left
    const otLX  = ax - 152   // outer left
    const mtLX  = ax -  76   // inner left  (flanks gate)
    const mtRX  = ax +  76   // inner right (flanks gate)
    const otRX  = ax + 152   // outer right
    const fotRX = ax + 230   // far outer right

    // ── Zone atmosphere ───────────────────────────────────────────────────────
    this.add.rectangle(ax, H * 0.45, 1200, H * 0.9, 0xd97706, 0.04)
    // Dark sky column directly behind the castle makes silhouette pop — wider for 7 towers
    this.add.rectangle(ax, H / 2, 500, H, 0x04020e, 0.22)
    // Ground accent under the entire zone
    this.add.rectangle(ax, gt, 1200, 4, 0xd97706, 0.35)
    this.add.rectangle(ax, gt,  340, 5, 0xd97706, 0.50)

    // One-shot entry flash
    this._zoneFlash   = this.add.rectangle(
      this.scale.width / 2, H / 2, this.scale.width, H, 0xd97706, 0,
    ).setScrollFactor(0).setDepth(5)
    this._zoneFlashed = false

    // Ground path leading to castle approach
    const pathL = ax - 366
    const pathR = fotLX - FOW / 2 - 10
    this.add.rectangle((pathL + pathR) / 2, gt - 1, pathR - pathL, 3, 0xd97706, 0.28)

    // ── Inner recessed wall — drawn before towers for back-plane depth cue ───────
    // Spans the inner castle width at slightly less than OTH, offset +3px right.
    const innerWW = otRX - otLX + OTW - 20
    const innerWH = OTH - 30
    this.add.rectangle(ax + 4, gt - innerWH / 2, innerWW,     innerWH,     0x4e1c05)
    this.add.rectangle(ax + 3, gt - innerWH / 2, innerWW - 4, innerWH - 2, 0x5c2208)
    for (let ibx = ax - innerWW / 2 + 9; ibx < ax + innerWW / 2 - 5; ibx += 16) {
      this.add.rectangle(ibx + 4, gt - innerWH - 7, 9, 14, 0x5c2208)
    }

    // ── Helper: draw one tower ────────────────────────────────────────────────
    // depthOx: shadow horizontal offset — larger = reads as further behind front plane.
    // NO physics body is added — the castle is fully walkable visual scenery.
    const drawTower = (tx, tw, th, merlonCount, depthOx = 2) => {
      const halfW = tw / 2
      this.add.rectangle(tx + depthOx, gt - th / 2, tw,     th, 0x7a3508)  // shadow
      this.add.rectangle(tx - 1,       gt - th / 2, tw - 5, th, 0x92400e)  // face
      this.add.rectangle(tx - halfW + 2, gt - th / 2, 4, th, 0xa8501a)     // left highlight
      for (let i = 1; i < 5; i++) {
        this.add.rectangle(tx, gt - th + i * (th / 5), tw - 4, 1, 0x5c280a, 0.45)
      }
      const winY = gt - Math.round(th * 0.60)
      this.add.rectangle(tx, winY, 8, 16, 0x1a0a2e)
      this.add.rectangle(tx, winY, 6, 14, 0x2d1050, 0.65)
      this.add.rectangle(tx, gt - th,     tw + 6, 5, 0x7a3508)
      this.add.rectangle(tx, gt - th - 2, tw + 6, 2, 0xb45309, 0.55)
      const spacing = (tw + 6) / merlonCount
      const startOX = -(tw + 6) / 2 + spacing / 2
      for (let i = 0; i < merlonCount; i++) {
        const ox = startOX + i * spacing
        this.add.rectangle(tx + ox,                          gt - th - 12, spacing - 4, 20, 0x92400e)
        this.add.rectangle(tx + ox - (spacing - 4) / 2 + 1, gt - th - 12, 3,          18, 0xa8501a)
      }
    }

    // ── Draw all seven towers ─────────────────────────────────────────────────
    // Far-outer/outer: depthOx=2 (front plane). Inner (gate-flanking): depthOx=3.
    // Center keep: depthOx=2 — tallest element commands the foreground plane.
    drawTower(fotLX, FOW, FOH, 3, 2)  // far outer left
    drawTower(otLX,  OTW, OTH, 3, 2)  // outer left
    drawTower(mtLX,  MTW, MTH, 3, 3)  // inner left  — flanks gate
    drawTower(ax,    KTW, KTH, 5, 2)  // center keep — dominant foreground
    drawTower(mtRX,  MTW, MTH, 3, 3)  // inner right — flanks gate
    drawTower(otRX,  OTW, OTH, 3, 2)  // outer right
    drawTower(fotRX, FOW, FOH, 3, 2)  // far outer right

    // ── Connecting curtain walls — 4 segments (2 per side) ───────────────────
    // Drawn AFTER towers so tower edges overlap cleanly. No physics on any wall.
    const wallH1 = Math.round(FOH * 0.82)    // outer curtain height ~205px
    const wallH2 = Math.round(pillarH * 0.55) // inner curtain height ~165px
    const drawCurtain = (leftEdge, rightEdge, wallH) => {
      const cw  = rightEdge - leftEdge
      const cCX = leftEdge + cw / 2
      const cY  = gt - wallH / 2
      this.add.rectangle(cCX, cY, cw, wallH + 2, 0x7a3508)
      this.add.rectangle(cCX, cY, cw - 2, wallH,  0x92400e)
      for (let bx = leftEdge + 8; bx < rightEdge - 6; bx += 22) {
        this.add.rectangle(bx + 5, gt - wallH - 11, 12, 20, 0x92400e)
      }
    }
    // Left side: far-outer → outer, then outer → inner
    drawCurtain(fotLX + FOW / 2, otLX  - OTW / 2, wallH1)
    drawCurtain(otLX  + OTW / 2, mtLX  - MTW / 2, wallH2)
    // Right side: inner → outer, then outer → far-outer
    drawCurtain(mtRX  + MTW / 2, otRX  - OTW / 2, wallH2)
    drawCurtain(otRX  + OTW / 2, fotRX - FOW / 2, wallH1)

    // ── Gate arch (inner span between gate-flanking inner towers) ─────────────
    const gateSpan = mtRX - mtLX + MTW   // total width of inner span
    const archH    = pillarH

    // Gate wall background (sits behind the door opening)
    this.add.rectangle(ax, gt - archH / 2, gateSpan, archH, 0x7a3508)
    this.add.rectangle(ax, gt - archH / 2, gateSpan - 4, archH - 4, 0x92400e)

    // Arch header spanning inner towers
    this.add.rectangle(ax, gt - archH - 7,  gateSpan, 16, 0x7a3508)
    this.add.rectangle(ax, gt - archH - 9,  gateSpan - 2, 14, 0x92400e)
    this.add.rectangle(ax, gt - archH - 15, gateSpan, 3, 0xb45309, 0.5)

    // Gate arch crenellations (between inner towers)
    ;[-28, -14, 0, 14, 28].forEach((ox) => {
      this.add.rectangle(ax + ox, gt - archH - 24, 10, 20, 0x92400e)
      this.add.rectangle(ax + ox - 3, gt - archH - 24, 3, 18, 0xa8501a)
    })

    // Keystone — center of arch header
    this.add.rectangle(ax, gt - archH - 7, 22, 24, 0xb45309)

    // ── Door — portal opening ─────────────────────────────────────────────────
    // 90px wide × archH tall, centered in the gate gap.
    // ZERO physics on the door. Entry is triggered by proximity distance check only.
    // Player walks freely across the entire castle frontage and stands in front of
    // the door naturally — the ground is the only collider here.
    const doorW = 90
    const doorH = archH

    // Door outer frame
    this.add.rectangle(ax, gt - doorH / 2, doorW + 6, doorH + 4, 0x5c280a)
    // Warm amber accent lines on frame edges — contrasts the purple void inside
    this.add.rectangle(ax - (doorW + 6) / 2 + 2, gt - doorH / 2, 3, doorH, 0xd97706, 0.50)
    this.add.rectangle(ax + (doorW + 6) / 2 - 2, gt - doorH / 2, 3, doorH, 0xd97706, 0.30)
    this.add.rectangle(ax, gt - doorH - 1, doorW + 6, 3, 0xd97706, 0.45)

    // Outer atmospheric halo — wide, low-alpha, different phase from inner glow
    this._doorHalo = this.add.rectangle(ax, gt - doorH / 2, doorW + 26, doorH + 26, 0x6d28d9, 0.08)
    this.tweens.add({
      targets:  this._doorHalo,
      alpha:    0.18,
      duration: 2900,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    })

    // Door glow — stored ref; _checkCastleInteraction drives proximity brightness
    this._doorGlow = this.add.rectangle(ax, gt - doorH / 2, doorW + 10, doorH + 10, 0x5b21b6, 0.18)
    this._doorGlowTween = this.tweens.add({
      targets:  this._doorGlow,
      alpha:    0.38,
      duration: 2200,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    })

    // Door fill + inner depth shadows — deep void interior
    this.add.rectangle(ax, gt - doorH / 2, doorW, doorH, 0x0e0520)
    this.add.rectangle(ax - doorW / 2 + 5, gt - doorH / 2, 10, doorH, 0x000000, 0.28)
    this.add.rectangle(ax + doorW / 2 - 5, gt - doorH / 2, 10, doorH, 0x000000, 0.18)
    this.add.rectangle(ax, gt - doorH + 10, doorW - 4, 12, 0x000000, 0.32)

    // Door shimmer — two rising lines at different phases for a living glow feel
    const shimmerStartY = gt - doorH
    const shimmer = this.add.rectangle(ax, shimmerStartY, doorW - 4, 2, 0x9333ea, 0.45).setDepth(1)
    this.tweens.add({
      targets:  shimmer,
      y:        gt,
      alpha:    0.04,
      duration: 3200,
      repeat:   -1,
      ease:     'Sine.easeIn',
      onRepeat: () => { shimmer.y = shimmerStartY; shimmer.alpha = 0.45 },
    })
    // Second shimmer — slightly narrower, offset by half duration so they alternate
    const shimmer2StartY = gt - doorH * 0.5
    const shimmer2 = this.add.rectangle(ax, shimmer2StartY, doorW - 14, 2, 0x7c3aed, 0.28).setDepth(1)
    this.tweens.add({
      targets:  shimmer2,
      y:        gt,
      alpha:    0.02,
      duration: 3200,
      repeat:   -1,
      ease:     'Sine.easeIn',
      onRepeat: () => { shimmer2.y = shimmer2StartY; shimmer2.alpha = 0.28 },
    })

    // ── Castle physics: NONE ──────────────────────────────────────────────────
    // The entire castle (towers, walls, arch, door) is visual-only scenery.
    // Ground is the sole solid collider across the full castle frontage.
    // Door entry is detected by proximity distance check in _checkCastleInteraction.

    // ── Castle entrance steps — 5 tiered interactive steps centered on gate ────
    //
    // Layout (n = step index, 0 = bottom, 4 = top):
    //   Rise per step : 16px   — each step is exactly 1 jump high, easily traversable
    //   Flare per step: 36px per side going down
    //   Top step width: 108px  — slightly wider than the 90px door
    //
    //   n  surface Y    width   center X range
    //   4  gt - 80      108px   ax ± 54
    //   3  gt - 64      180px   ax ± 90
    //   2  gt - 48      252px   ax ± 126
    //   1  gt - 32      324px   ax ± 162
    //   0  gt - 16      396px   ax ± 198
    //
    // Collision (Option A — individual static body per step):
    //   Each body height = STEP_RISE (16px). Bottom of body n aligns exactly with
    //   body n-1's top (or the ground surface for n=0). Zero gaps, zero overlap.
    //   Players jump up each step; walking past the base on open ground is unaffected
    //   because the first step only starts at ax ± 198px.
    //
    // Color: top step is lightest (0xb06228), darkening by one shade each step down.
    //
    const STEP_RISE   = 16
    const STEP_FLARE  = 36      // extra px per side per descending step
    const STEP_TOP_W  = 108     // top step width
    const STEP_COUNT  = 5
    // Index 0 = top step (lightest), index 4 = bottom step (darkest)
    const STEP_COLORS = [0xb06228, 0xa05820, 0x925018, 0x844010, 0x763208]

    // Draw bottom-first so upper steps visually overlay lower ones (correct Z)
    for (let n = 0; n < STEP_COUNT; n++) {
      const colorIdx = STEP_COUNT - 1 - n            // n=0(bottom)→4(dark), n=4(top)→0(light)
      const w        = STEP_TOP_W + colorIdx * STEP_FLARE * 2
      const surfaceY = gt - (n + 1) * STEP_RISE      // top surface of this step
      const centerY  = surfaceY + STEP_RISE / 2      // rect/body center Y

      // Visual layers
      this.add.rectangle(ax + 1, centerY + 1, w,     STEP_RISE, 0x3a1404)              // drop shadow
      this.add.rectangle(ax,     centerY,     w,     STEP_RISE, STEP_COLORS[colorIdx]) // face
      this.add.rectangle(ax,     surfaceY + 1, w - 2, 2,        0xc07030, 0.88 - colorIdx * 0.06) // top highlight
      this.add.rectangle(ax,     surfaceY + 4, w - 8, 1,        0x5c2e0a, 0.50)        // secondary seam

      // Individual static collider — exactly this step's rise height, stacks cleanly
      const stepBody = this.add.rectangle(ax, centerY, w, STEP_RISE, 0x000000, 0)
      this.physics.add.existing(stepBody, true)
      this.physics.add.collider(this.player, stepBody)
      this._castleSteps.push(stepBody.body)
    }

    // ── Labels ────────────────────────────────────────────────────────────────
    // Lintel panel on arch header
    this.add.rectangle(ax, gt - archH - 7, 110, 12, 0xb45309, 0.85)
    this.add.text(ax, gt - archH - 7, `${CASTLE.number} · ${CASTLE.title.toUpperCase()}`, {
      fontSize: '9px', color: '#fef3c7', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5)

    this.add.text(ax, gt - archH + 10, 'APPSARCHITECTS', {
      fontSize: '9px', color: '#92400e', fontFamily: 'monospace',
    }).setOrigin(0.5)

    // Proximity hint — above the center keep battlements (KTH + 22 merlon + 20 margin)
    const castleHint = this.add.text(ax, gt - KTH - 42, '\u2193 Enter HQ', {
      fontSize: '12px', color: '#c4b5fd', fontFamily: 'monospace',
    }).setOrigin(0.5).setAlpha(0)

    this._castleObject = { x: ax, hint: castleHint }

    // ── Portal activation flash ───────────────────────────────────────────────
    this._portalFlash = this.add.rectangle(
      this.scale.width / 2, H / 2, this.scale.width, H, 0x6d28d9, 0,
    ).setScrollFactor(0).setDepth(8)

    // ── Ambient motes — drift upward from door gap area ───────────────────────
    // Small (2×2) core motes inside the door, larger (3×3) accent motes near edges
    const MOTE_DEFS = [
      { ox: -30, sy: gt -  24, dur: 2100, delay:    0, a: 0.38, sz: 2 },
      { ox:  18, sy: gt -  50, dur: 2600, delay:  420, a: 0.28, sz: 2 },
      { ox: -10, sy: gt -  80, dur: 1950, delay:  840, a: 0.22, sz: 2 },
      { ox:  36, sy: gt -  18, dur: 2400, delay:  210, a: 0.32, sz: 2 },
      { ox:  -2, sy: gt -  40, dur: 2250, delay: 1080, a: 0.25, sz: 2 },
      { ox:  24, sy: gt -  62, dur: 2700, delay:  660, a: 0.20, sz: 2 },
      // Larger accent motes — drift higher, slightly warmer purple
      { ox: -22, sy: gt -  10, dur: 3100, delay:  300, a: 0.18, sz: 3 },
      { ox:   8, sy: gt -  34, dur: 2800, delay:  750, a: 0.15, sz: 3 },
      { ox:  28, sy: gt -  56, dur: 3400, delay: 1400, a: 0.14, sz: 3 },
      { ox: -38, sy: gt -  42, dur: 2950, delay:  520, a: 0.16, sz: 3 },
      { ox:   2, sy: gt -  90, dur: 3600, delay:  970, a: 0.12, sz: 3 },
    ]
    MOTE_DEFS.forEach(({ ox, sy, dur, delay, a, sz }) => {
      const mote = this.add.rectangle(ax + ox, sy, sz, sz, 0x7c3aed, a)
      this.tweens.add({
        targets:  mote,
        y:        mote.y - 70,
        alpha:    0,
        duration: dur,
        delay,
        ease:     'Sine.easeIn',
        repeat:   -1,
        onRepeat: () => { mote.y = sy; mote.alpha = a },
      })
    })

    // ── Door light spill — faint glow cast onto the top approach step ─────────
    // Sits just above the top step surface (gt-80), pulses in sync with the door.
    const spill = this.add.rectangle(ax, gt - 84, 128, 6, 0x6d28d9, 0.06)
    this.tweens.add({
      targets:  spill,
      alpha:    0.14,
      duration: 2200,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    })

    // ── Right-of-castle fade — gentle darkness vignette only, no solid blocks ──
    // A soft alpha overlay that frames the world edge without placing any
    // brown/dark rectangles that read as map artifacts.
    this.add.rectangle(W - 200, H / 2, 400, H, 0x000000, 0.15)
    this.add.rectangle(W -  60, H / 2, 120, H, 0x000000, 0.22)
  }

  // Called every frame — zone entry flash, hint visibility, and castle entry
  _checkCastleInteraction() {
    const px       = this.player.x
    const onGround = this.player.body.blocked.down
    const { down } = this._ctrl

    // Zone entry flash — fires exactly once when the player first crosses the threshold.
    // The rectangle is viewport-pinned (scrollFactor 0) and already at alpha=0;
    // the tween flashes it to 0.08 then back to 0 over 800ms.
    // Camera zoom micro-pulse (1.0 → 1.014 → 1.0, yoyo 280ms each side) runs
    // simultaneously — gives a physical "stepping into a new space" sensation
    // without any added visual element.
    if (!this._zoneFlashed && px > ZONE_ENTRY_X) {
      this._zoneFlashed = true
      this.tweens.add({
        targets:  this._zoneFlash,
        alpha:    { from: 0.08, to: 0 },
        duration: 800,
        ease:     'Cubic.Out',
      })
      this.tweens.add({
        targets:  this.cameras.main,
        zoom:     1.014,
        duration: 280,
        ease:     'Sine.easeOut',
        yoyo:     true,
      })
    }

    const castle = this._castleObject
    const near   = Math.abs(px - castle.x) < CASTLE_ENTER_DIST && onGround

    // Proximity state change: fade hint and drive door glow together.
    // On approach: kill the idle pulse, hold glow at a brighter level — the door
    // appears to "respond" to the player without any new visual element.
    // On departure: restart the normal pulse from wherever alpha currently sits.
    if (near !== this._castleNear) {
      this._castleNear = near
      this.tweens.killTweensOf(castle.hint)
      this.tweens.add({
        targets:  castle.hint,
        alpha:    near ? 1 : 0,
        duration: 180,
        ease:     'Sine.easeOut',
      })
      this.tweens.killTweensOf(this._doorGlow)
      if (near) {
        // Hold glow bright while player stands at the door
        this.tweens.add({
          targets:  this._doorGlow,
          alpha:    0.58,
          duration: 400,
          ease:     'Sine.easeOut',
        })
        // Subtle door cue tone + start ambient hum
        SoundManager.doorCue()
        this._stopDoorHum = SoundManager.startDoorHum()
      } else {
        // Smoothly re-enter idle pulse from current alpha
        this._doorGlowTween = this.tweens.add({
          targets:  this._doorGlow,
          alpha:    0.38,
          duration: 2200,
          yoyo:     true,
          repeat:   -1,
          ease:     'Sine.easeInOut',
        })
        // Fade out hum as player walks away
        if (this._stopDoorHum) { this._stopDoorHum(); this._stopDoorHum = null }
      }
    }

    if (near && down && !this._enterLocked) {
      this._enterLocked = true
      // Cut door hum immediately — the portal entry sequence takes over
      if (this._stopDoorHum) { this._stopDoorHum(); this._stopDoorHum = null }
      this.input.keyboard.enabled = false
      // Portal activation sequence:
      //   0. Micro camera shake (120ms, 3px) — physical weight of the gate responding
      //   1. Brief violet screen flash (160ms) — signals the portal opening
      //   2. Slow purple camera fade (550ms) — more deliberate than pipe entries (400ms)
      // Shake and flash start together; shake finishes before the fade begins,
      // so the three beats read as one escalating moment rather than separate events.
      this.cameras.main.shake(120, 0.003)
      this.tweens.add({
        targets:  this._portalFlash,
        alpha:    { from: 0, to: 0.32 },
        duration: 160,
        ease:     'Power2.In',
        onComplete: () => {
          this.cameras.main.fadeOut(550, 28, 8, 56)
          this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.launch('IdentityScene')
            this.scene.sleep()
          })
        },
      })
    }

    // Reset lock when down key is released — prevents re-triggering on a held key
    if (!down) {
      this._enterLocked = false
    }
  }
}
