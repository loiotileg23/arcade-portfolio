/**
 * SoundManager — procedural Web Audio engine.
 * All sounds are synthesised; no asset files required.
 * One shared AudioContext per page load.
 */

let _ctx = null

const _getCtx = () => {
  if (!_ctx) _ctx = new AudioContext()
  return _ctx
}

// Ensure context is running (required after user gesture on some browsers).
// fn receives the live AudioContext once running.
const _play = (fn) => {
  const ctx = _getCtx()
  if (ctx.state === 'suspended') {
    ctx.resume().then(() => fn(ctx)).catch(() => {})
  } else {
    fn(ctx)
  }
}

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
   * Resume the AudioContext from inside a user gesture (tap/click).
   * iOS Safari keeps the context suspended until this happens.
   */
  unlock() {
    const ctx = _getCtx()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
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
