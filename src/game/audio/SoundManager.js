/**
 * SoundManager — procedural Web Audio engine.
 * All sounds are synthesised; no asset files required.
 * One shared AudioContext per page load.
 */

// webkitAudioContext: Safari before iOS 14.5
const AudioCtx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)

let _ctx    = null
let _primed = false

const _getCtx = () => {
  if (!_ctx && AudioCtx) _ctx = new AudioCtx()
  return _ctx
}

// Plays only while the context is running. Browsers keep it suspended until a
// user activation (see unlock), and iOS can re-suspend it ('interrupted') after
// backgrounding. Sounds requested meanwhile are dropped rather than queued —
// queuing would fire every pending footstep at once the moment audio unlocks.
// fn receives the live AudioContext.
const _play = (fn) => {
  const ctx = _getCtx()
  if (ctx?.state === 'running') fn(ctx)
}

// Events that count as a user activation. For touch that's when the finger
// lifts (touchend / pointerup) — pointerdown only qualifies for a mouse, which
// is why unlocking on press works on desktop but stays silent on iOS.
const UNLOCK_EVENTS = ['touchend', 'pointerup', 'click', 'keydown']

// Convenience: create a gain node connected to destination with a volume ramp-to-zero.
const _makeGain = (ctx, vol, startTime, duration) => {
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, startTime)
  g.gain.linearRampToValueAtTime(0, startTime + duration)
  g.connect(ctx.destination)
  return g
}

export const SoundManager = {

  /**
   * Resume the AudioContext from inside a user activation (tap/click/key).
   * iOS Safari keeps the context suspended until this happens. The first call
   * also plays a one-sample silent buffer, which older iOS needs to fully unlock.
   */
  unlock() {
    const ctx = _getCtx()
    if (!ctx) return
    if (ctx.state !== 'running') ctx.resume().catch(() => {})
    if (!_primed) {
      const src = ctx.createBufferSource()
      src.buffer = ctx.createBuffer(1, 1, 22050)
      src.connect(ctx.destination)
      src.start(0)
      _primed = true
    }
  },

  /**
   * Listen for user activations page-wide and unlock audio on each one.
   * Listeners stay attached so audio re-unlocks if iOS suspends it again
   * (e.g. after switching apps). Capture phase, so the game canvas and React
   * handlers calling preventDefault can't swallow the event first.
   * Returns a cleanup function.
   */
  installUnlock() {
    const onActivate = () => SoundManager.unlock()
    UNLOCK_EVENTS.forEach((type) => window.addEventListener(type, onActivate, { capture: true, passive: true }))
    return () => UNLOCK_EVENTS.forEach((type) => window.removeEventListener(type, onActivate, { capture: true }))
  },

  /**
   * Footstep — very short noise burst, low volume.
   * Sounds like a soft heel-tap on stone.
   */
  footstep() {
    _play((ctx) => {
      const t   = ctx.currentTime
      const len = Math.floor(ctx.sampleRate * 0.04)
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const d   = buf.getChannelData(0)
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.5
      }
      const src = ctx.createBufferSource()
      src.buffer = buf
      // High-pass to remove low rumble — keeps it crisp, not boomy
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 800
      const g = _makeGain(ctx, 0.055, t, 0.06)
      src.connect(hp)
      hp.connect(g)
      src.start(t)
    })
  },

  /**
   * Jump — short rising sine chirp.
   * Subtle, not arcade-y.
   */
  jump() {
    _play((ctx) => {
      const t   = ctx.currentTime
      const dur = 0.14
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(200, t)
      osc.frequency.exponentialRampToValueAtTime(420, t + dur)
      const g = _makeGain(ctx, 0.07, t, dur)
      osc.connect(g)
      osc.start(t)
      osc.stop(t + dur)
    })
  },

  /**
   * Land — short low-frequency thud.
   * Frequency drops quickly to simulate impact weight.
   */
  land() {
    _play((ctx) => {
      const t   = ctx.currentTime
      const dur = 0.13
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(90, t)
      osc.frequency.exponentialRampToValueAtTime(28, t + dur)
      const g = _makeGain(ctx, 0.09, t, dur)
      osc.connect(g)
      osc.start(t)
      osc.stop(t + dur)
    })
  },

  /**
   * Door proximity cue — brief resonant descending tone.
   * Plays once when player first approaches the HQ door.
   */
  doorCue() {
    _play((ctx) => {
      const t   = ctx.currentTime
      const dur = 0.55
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(190, t)
      osc.frequency.exponentialRampToValueAtTime(72, t + dur)
      const g = _makeGain(ctx, 0.065, t, dur)
      osc.connect(g)
      osc.start(t)
      osc.stop(t + dur)
    })
  },

  /**
   * Start a continuous low door hum (subtle ambient drone near HQ).
   * Returns a stop() function — call it to fade the hum out.
   */
  startDoorHum() {
    let osc = null
    let lfo = null
    let gainNode = null

    _play((ctx) => {
      const t = ctx.currentTime

      // Base drone oscillator
      osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = 58

      // Very slow LFO on frequency for a slightly alive quality
      lfo = ctx.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = 0.4
      const lfoDepth = ctx.createGain()
      lfoDepth.gain.value = 3
      lfo.connect(lfoDepth)
      lfoDepth.connect(osc.frequency)

      gainNode = ctx.createGain()
      gainNode.gain.setValueAtTime(0, t)
      gainNode.gain.linearRampToValueAtTime(0.038, t + 0.6)
      gainNode.connect(ctx.destination)

      osc.connect(gainNode)
      osc.start(t)
      lfo.start(t)
    })

    return () => {
      if (!gainNode) return
      const ctx = _getCtx()
      const now = ctx.currentTime
      gainNode.gain.cancelScheduledValues(now)
      gainNode.gain.setValueAtTime(gainNode.gain.value, now)
      gainNode.gain.linearRampToValueAtTime(0, now + 0.35)
      try { osc.stop(now + 0.35) } catch (_) {}
      try { lfo.stop(now + 0.35) } catch (_) {}
    }
  },
}
