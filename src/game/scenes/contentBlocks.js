import { bulletList, enableLink } from './readingLayout'

// Shared content renderers for the reading scenes (ProjectScene, IdentityScene).
// Mixed into each scene's prototype with Object.assign; every method reads
// colours from this._theme, which the scene sets in create().

const BLOCK_GAP = 24    // vertical gap after each section's body text
const FADE_BASE = 460   // ms after scene create() before first section fades in
const FADE_STEP = 130   // ms stagger between successive section fade-ins

// ─── Section definitions ──────────────────────────────────────────────────────
// Each entry maps a project data key to a display label and accent colour.
// To add a section: one entry here + one matching field in projects.js.
// accent drives both the left-edge bar colour and the label text colour.
// Sections whose field is absent from a project are skipped; array fields render as bullets.
export const SECTION_DEFS = [
  { label: 'OVERVIEW',   key: 'overview',   accent: 0x22c55e },   // green
  { label: 'HIGHLIGHTS', key: 'highlights', accent: 0x4ade80 },   // light green
  { label: 'CHALLENGE',  key: 'challenge',  accent: 0xf59e0b },   // amber
  { label: 'SOLUTION',   key: 'solution',   accent: 0x3b82f6 },   // blue
  { label: 'RESULTS',    key: 'results',    accent: 0xa78bfa },   // purple
]

// ─── Metadata field definitions ───────────────────────────────────────────────
// key maps to meta[key]. Fields absent from a project are silently skipped.
// To add a metadata field: one entry here + one field in projects.js meta object.
export const META_FIELDS = [
  { key: 'category',     label: 'CATEGORY'     },
  { key: 'technology',   label: 'TECHNOLOGY'   },
  { key: 'degree',       label: 'DEGREE'       },
  { key: 'credential',   label: 'CREDENTIAL'   },
  { key: 'role',         label: 'ROLE'         },
  { key: 'industry',     label: 'INDUSTRY'     },
  { key: 'capabilities', label: 'CAPABILITIES' },
  { key: 'timeline',     label: 'TIMELINE'     },
  { key: 'stack',        label: 'STACK'        },
  { key: 'status',       label: 'STATUS'       },
]

// ─── Themes ───────────────────────────────────────────────────────────────────
// tunnel — pipe green (ProjectScene)     castle — portal purple (IdentityScene)
export const THEMES = {
  tunnel: {
    accent: 0x22c55e, accentText: '#22c55e', sub: '#4ade80',
    cta: 0x15803d, ctaHover: 0x16a34a,
    cardFill: 0x070c18, cardBorder: 0x1e293b, chipBorder: 0x334155,
    rule: 0x1e293b, itemBar: 0x3b82f6, listAccent: 0x4ade80, extraAccent: 0xa78bfa,
  },
  castle: {
    accent: 0x7c3aed, accentText: '#a78bfa', sub: '#c4b5fd',
    cta: 0x6d28d9, ctaHover: 0x7c3aed,
    cardFill: 0x0a0716, cardBorder: 0x2a1f4a, chipBorder: 0x3b2f5c,
    rule: 0x1e1535, itemBar: 0x8b5cf6, listAccent: 0xa78bfa, extraAccent: 0xa78bfa,
  },
}

// Meta fields rendered as tag chips (split on ' · ') rather than labelled lines
const CHIP_FIELDS = ['stack', 'technology', 'capabilities']

// Scoreboard palette — amber stat values on slate cards
const SCORE_PANEL = 0x0b1120
const SCORE_CARD  = 0x1e293b

const hex = (color) => '#' + color.toString(16).padStart(6, '0')

export const ContentBlocks = {

  // Content order: scoreboard → intro paragraph → entries (one card each) →
  // project-level sections. Each part becomes one fade-in block.
  // Entries without their own kicker are numbered "<entryLabel> // 01, 02, …".
  // Returns { sectionBlocks, y }.
  _drawContent(project, startY, colLeft, colW) {
    let y = startY
    const sectionBlocks = []   // array of arrays — one inner array per block

    const parts = []   // { draw, card } — cards carry their own spacing, no rule after
    if (project.scoreboard) {
      parts.push({ draw: (py) => this._drawScoreboard(py, project.scoreboard, colLeft, colW) })
    }
    if (project.intro) {
      parts.push({ draw: (py) => this._drawSection(py, null, project.intro, null, colLeft, colW) })
    }
    let n = 0
    ;(project.entries ?? []).forEach((entry) => {
      const kicker = entry.kicker
        ?? (project.entryLabel ? `${project.entryLabel} // ${String(++n).padStart(2, '0')}` : null)
      parts.push({ card: true, draw: (py) => this._drawEntry(py, { ...entry, kicker }, colLeft, colW) })
    })
    SECTION_DEFS.filter(({ key }) => project[key] != null).forEach(({ label, key, accent }) => {
      const value = project[key]
      const body  = Array.isArray(value) ? bulletList(value) : value
      parts.push({ draw: (py) => this._drawSection(py, label, body, accent, colLeft, colW) })
    })

    parts.forEach(({ draw, card }, i) => {
      const { objects, y: newY } = draw(y)
      y = newY

      // Separator: thin rule between plain blocks. Included in this block's objects
      // array so it fades in with the block above it.
      if (i < parts.length - 1 && !card && !parts[i + 1].card) {
        const sep = this.add.rectangle(colLeft + colW / 2, y, colW, 1, this._theme.rule, 0.35)
        objects.push(sep)
        y += 20
      }

      sectionBlocks.push(objects)
    })

    return { sectionBlocks, y }
  },

  // Scoreboard — titled panel with a two-column grid of stat cards (value + label).
  // Cards in the same row share the taller card's height. Returns { objects, y }.
  _drawScoreboard(y, { title, stats }, colLeft, colW) {
    const objects = []
    const add = (obj) => { objects.push(obj); return obj }
    const PAD = colW < 500 ? 10 : 14
    const GAP = 8
    const cardW = (colW - PAD * 2 - GAP) / 2

    const panel = add(this.add.graphics())
    const cards = add(this.add.graphics())

    const titleText = add(this.add.text(colLeft + PAD, y + PAD, title, {
      fontSize: '11px', color: '#f59e0b', fontFamily: 'monospace', fontStyle: 'bold',
      wordWrap: { width: colW - PAD * 2 },
    }))
    let rowY = y + PAD + titleText.height + 10

    for (let i = 0; i < stats.length; i += 2) {
      const row = stats.slice(i, i + 2).map(({ value, label }, col) => {
        const cx = colLeft + PAD + col * (cardW + GAP)
        const valueText = add(this.add.text(cx + 12, rowY + 12, value, {
          fontSize: colW < 500 ? '18px' : '22px', color: '#fbbf24', fontFamily: 'monospace', fontStyle: 'bold',
        }))
        const labelText = add(this.add.text(cx + 12, rowY + 12 + valueText.height + 6, label, {
          fontSize: '11px', color: '#e2e8f0', fontFamily: 'monospace',
          wordWrap: { width: cardW - 24 }, lineSpacing: 3,
        }))
        return { cx, h: valueText.height + 6 + labelText.height + 24 }
      })
      const rowH = Math.max(...row.map((c) => c.h))
      row.forEach(({ cx }) => {
        cards.fillStyle(SCORE_CARD, 1).fillRoundedRect(cx, rowY, cardW, rowH, 6)
      })
      rowY += rowH + GAP
    }

    const panelH = rowY - GAP + PAD - y
    panel.fillStyle(SCORE_PANEL, 1).fillRoundedRect(colLeft, y, colW, panelH, 10)

    return { objects, y: y + panelH + BLOCK_GAP }
  },

  // Renders one entry (venture, role, school, or company) as a case-study card:
  //   kicker → name → subtitle → tag chips → full-width website button + caption →
  //   meta lines → lead paragraphs → bulleted list → item groups → case sections →
  //   extra sections.
  // The card panel is drawn first (behind) and sized once content is measured.
  // Every field is optional except name. Returns { objects, y }.
  _drawEntry(y, entry, colLeft, colW) {
    const t = this._theme
    const objects = []
    const add = (obj) => { objects.push(obj); return obj }
    const take = ({ objects: o, y: newY }) => { objects.push(...o); y = newY }

    const PAD  = colW < 500 ? 14 : 20
    const L    = colLeft + PAD          // inner left edge
    const IW   = colW - PAD * 2         // inner width
    const top  = y
    const card = add(this.add.graphics())
    y += PAD

    if (entry.kicker) {
      const kicker = add(this.add.text(L, y, entry.kicker, {
        fontSize: '10px', color: t.accentText, fontFamily: 'monospace', fontStyle: 'bold',
      }))
      y += kicker.height + 8
    }

    const name = add(this.add.text(L, y, entry.name.toUpperCase(), {
      fontSize: colW < 500 ? '18px' : '20px', color: '#f1f5f9', fontFamily: 'monospace', fontStyle: 'bold',
      wordWrap: { width: IW },
    }))
    y += name.height + 8

    if (entry.subtitle) {
      const sub = add(this.add.text(L, y, entry.subtitle, {
        fontSize: '13px', color: '#cbd5e1', fontFamily: 'monospace', wordWrap: { width: IW }, lineSpacing: 4,
      }))
      y += sub.height + 12
    }

    // Tag chips — stack / technology / capabilities, split on ' · '
    const chips = CHIP_FIELDS.flatMap((key) => entry.meta?.[key]?.split(' · ') ?? [])
    if (chips.length) take(this._drawChips(y, chips, L, IW))

    if (entry.url) {
      const label = entry.buttonLabel ?? 'VIEW LIVE WEBSITE'
      const note  = entry.linkNote ?? 'External site · Opens project website'
      take(this._drawCtaButton(y + 4, label, note, entry.url, L, IW))
    }

    // Meta — remaining fields as labelled lines, so long values wrap cleanly on phones
    const metaLines = META_FIELDS.filter(({ key }) => !CHIP_FIELDS.includes(key) && entry.meta?.[key] != null)
    if (metaLines.length) {
      y += 4
      metaLines.forEach(({ key, label }) => {
        const line = add(this.add.text(L, y, `${label}  ${entry.meta[key]}`, {
          fontSize: '11px', color: '#64748b', fontFamily: 'monospace',
          wordWrap: { width: IW }, lineSpacing: 4,
        }))
        y += line.height + 4
      })
    }
    y += 18

    if (entry.body) take(this._drawSection(y, null, entry.body, null, L, IW))
    if (entry.list) take(this._drawSection(y, entry.list.label, bulletList(entry.list.items), t.listAccent, L, IW))
    ;(entry.groups ?? []).forEach((group) => take(this._drawGroup(y, group, L, IW)))

    SECTION_DEFS
      .filter(({ key }) => key !== 'highlights' && entry[key] != null)
      .forEach(({ label, key, accent }) => take(this._drawSection(y, label, entry[key], accent, L, IW)))

    ;(entry.sections ?? []).forEach(({ label, body }) => {
      take(this._drawSection(y, label, body, t.extraAccent, L, IW))
    })

    // Close the card — the last block left a BLOCK_GAP below it; swap that for PAD
    const h = y - BLOCK_GAP + PAD - top
    card.fillStyle(t.cardFill, 0.92).fillRoundedRect(colLeft, top, colW, h, 12)
    card.lineStyle(1, t.cardBorder, 1).strokeRoundedRect(colLeft, top, colW, h, 12)

    return { objects, y: top + h + 20 }
  },

  // Outlined tag chips that wrap across lines within width. Returns { objects, y }.
  _drawChips(y, labels, left, width) {
    const t = this._theme
    const objects = []
    const g = this.add.graphics()
    objects.push(g)
    const GAP = 6, PX = 8, CH = 20
    let x = left

    labels.forEach((label) => {
      const text = this.add.text(0, 0, label, {
        fontSize: '10px', color: '#cbd5e1', fontFamily: 'monospace',
      })
      const w = text.width + PX * 2
      if (x > left && x + w > left + width) { x = left; y += CH + GAP }
      text.setPosition(x + PX, y + (CH - text.height) / 2)
      g.lineStyle(1, t.chipBorder, 1).strokeRoundedRect(x, y, w, CH, 6)
      objects.push(text)
      x += w + GAP
    })

    return { objects, y: y + CH + 14 }
  },

  // Full-width filled button that opens url in a new tab, with a small caption
  // underneath. A transparent zone is the hit target so the rounded fill can
  // stay a Graphics object. Returns { objects, y }.
  _drawCtaButton(y, label, note, url, left, width) {
    const t = this._theme
    const H = 40
    const fill = this.add.graphics()
    const paint = (color) => fill.clear().fillStyle(color, 1).fillRoundedRect(left, y, width, H, 10)
    paint(t.cta)

    const text = this.add.text(left + width / 2, y + H / 2, `↗  ${label}`, {
      fontSize: '12px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5)

    const hit = this.add.zone(left + width / 2, y + H / 2, width, H)
    enableLink(this, hit, url, {
      onOver: () => paint(t.ctaHover),
      onOut:  () => paint(t.cta),
    })

    const caption = this.add.text(left + width / 2, y + H + 8, note, {
      fontSize: '10px', color: '#64748b', fontFamily: 'monospace',
    }).setOrigin(0.5, 0)

    return { objects: [fill, text, hit, caption], y: y + H + 8 + caption.height + 12 }
  },

  // Item group — optional section label, then items as name (bold) / role (accent) /
  // detail with one accent bar per item, then an optional closing note.
  // Returns { objects, y }.
  _drawGroup(y, { label, items, note }, colLeft, colW) {
    const t = this._theme
    const objects = []
    const add = (obj) => { objects.push(obj); return obj }

    if (label) {
      add(this.add.rectangle(colLeft - 10, y + 8, 3, 16, t.extraAccent, 0.85))
      add(this.add.text(colLeft, y, label, {
        fontSize: '10px', color: hex(t.extraAccent), fontFamily: 'monospace', fontStyle: 'bold',
        wordWrap: { width: colW },
      }))
      y += 24
    }

    items.forEach(({ name, role, detail }) => {
      const top = y
      const nameText = add(this.add.text(colLeft, y, name, {
        fontSize: '13px', color: '#e2e8f0', fontFamily: 'monospace', fontStyle: 'bold',
        wordWrap: { width: colW },
      }))
      y += nameText.height + 4
      if (role) {
        const roleText = add(this.add.text(colLeft, y, role, {
          fontSize: '11px', color: t.sub, fontFamily: 'monospace', wordWrap: { width: colW },
        }))
        y += roleText.height + 6
      }
      if (detail) {
        const detailText = add(this.add.text(colLeft, y, detail, {
          fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace',
          wordWrap: { width: colW }, lineSpacing: 6,
        }))
        y += detailText.height
      }
      add(this.add.rectangle(colLeft - 10, top, 3, y - top, t.itemBar, 0.6).setOrigin(0.5, 0))
      y += 20
    })

    if (note) {
      const noteText = add(this.add.text(colLeft, y, note, {
        fontSize: '12px', color: '#64748b', fontFamily: 'monospace', fontStyle: 'italic',
        wordWrap: { width: colW }, lineSpacing: 5,
      }))
      y += noteText.height + 20
    }

    return { objects, y: y + BLOCK_GAP - 20 }
  },

  // Renders one content section. A null label renders a plain lead paragraph
  // (no accent bar or label). Returns { objects, y }.
  // All rendered objects are returned so _stageContentFadeIn can tween them as a group.
  _drawSection(y, label, body, accent, colLeft, colW) {
    const objects = []

    if (label) {
      // Left accent bar — 3×16 bar, -10px from column edge
      objects.push(this.add.rectangle(colLeft - 10, y + 8, 3, 16, accent, 0.85))

      // Section label — inherits the section accent colour
      objects.push(this.add.text(colLeft, y, label, {
        fontSize: '10px', color: hex(accent), fontFamily: 'monospace', fontStyle: 'bold',
      }))
      y += 20
    }

    // Body text — word-wrapped to column width, consistent line height across sections
    const bodyText = this.add.text(colLeft, y, body, {
      fontSize: '13px', color: label ? '#94a3b8' : '#cbd5e1', fontFamily: 'monospace',
      wordWrap: { width: colW }, lineSpacing: 6,
    })
    objects.push(bodyText)
    y += bodyText.height + BLOCK_GAP

    return { objects, y }
  },

  // ─── Staged content fade-in ─────────────────────────────────────────────────
  // All content objects start at alpha 0. The media panel and each block are
  // tweened in with a gentle stagger after the camera fade completes.
  // Phaser cleans up all timers and tweens when the scene stops, so there is
  // no risk of stale callbacks firing after the scene is gone.
  _stageContentFadeIn(mediaObjects, sectionBlocks) {
    // Hide all targets before the camera fade completes
    mediaObjects.forEach(obj => obj.setAlpha(0))
    sectionBlocks.forEach(block => block.forEach(obj => obj.setAlpha(0)))

    // Media panel — fades in just as the camera completes its fade
    if (mediaObjects.length > 0) {
      this.time.delayedCall(FADE_BASE - 60, () => {
        this.tweens.add({ targets: mediaObjects, alpha: 1, duration: 300, ease: 'Sine.easeOut' })
      })
    }

    // Blocks — cascading stagger. Capped so long pages don't leave
    // below-the-fold content invisible for seconds.
    sectionBlocks.forEach((block, i) => {
      this.time.delayedCall(FADE_BASE + Math.min(i, 4) * FADE_STEP, () => {
        this.tweens.add({ targets: block, alpha: 1, duration: 260, ease: 'Sine.easeOut' })
      })
    })
  },
}
