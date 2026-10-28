import { useEffect, useState } from 'react'
import usePortfolioStore from '../store/usePortfolioStore'
import { touchState, releaseAllTouch, isTouchDevice } from '../game/input/touchControls'

// On-screen D-pad for touch devices. Each button mirrors a keyboard key:
//   ◀ ▶ — move (← → / A D)     ▲ — jump (↑ / W)     ▼ — enter (↓ / S)
// Shown only in the overworld; reading scenes use drag-to-scroll and a tap-to-return bar.

function PadButton({ dir, label, aria }) {
  const press = (e) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    touchState[dir] = true
  }
  const release = (e) => {
    e.preventDefault()
    touchState[dir] = false
  }

  return (
    <button
      type="button"
      aria-label={aria}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
      className="pointer-events-auto w-16 h-16 flex items-center justify-center font-mono text-xl text-slate-200 bg-[#060b17]/70 border border-slate-600/60 rounded-md active:bg-slate-700/80 active:border-amber-400/70 select-none touch-none"
    >
      {label}
    </button>
  )
}

export default function TouchControls() {
  const [touch] = useState(isTouchDevice)
  const activeScene = usePortfolioStore((s) => s.activeScene)
  const skillsOpen  = usePortfolioStore((s) => s.skillsOpen)
  const visible = touch && activeScene === 'overworld' && !skillsOpen

  // Hidden buttons can't fire pointerup — clear any held direction when they disappear
  useEffect(() => {
    if (!visible) releaseAllTouch()
  }, [visible])

  useEffect(() => {
    window.addEventListener('blur', releaseAllTouch)
    return () => window.removeEventListener('blur', releaseAllTouch)
  }, [])

  if (!visible) return null

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20 flex justify-between items-end px-4 pointer-events-none"
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      <div className="flex gap-3">
        <PadButton dir="left"  label="◀" aria="Move left" />
        <PadButton dir="right" label="▶" aria="Move right" />
      </div>
      <div className="flex gap-3">
        <PadButton dir="down" label="▼" aria="Enter" />
        <PadButton dir="up"   label="▲" aria="Jump" />
      </div>
    </div>
  )
}
