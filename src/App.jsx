import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import phaserConfig from './game/config/phaserGame'
import TouchControls from './components/TouchControls'
import SkillInventory, { GamepadIcon } from './components/SkillInventory'
import usePortfolioStore from './store/usePortfolioStore'
import { SoundManager } from './game/audio/SoundManager'

// Shared shape for the header buttons so they sit as a matched pair
const HEADER_BTN =
  'pointer-events-auto inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-md border ' +
  'font-mono text-[11px] font-bold tracking-widest whitespace-nowrap transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70'

export default function App() {
  const containerRef = useRef(null)
  const gameRef = useRef(null)
  const activeScene   = usePortfolioStore((s) => s.activeScene)
  const setSkillsOpen = usePortfolioStore((s) => s.setSkillsOpen)

  useEffect(() => {
    // Guard: only mount once (avoids double-mount issues)
    if (gameRef.current) return

    gameRef.current = new Phaser.Game({
      ...phaserConfig,
      parent: containerRef.current,
    })

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  return (
    // h-dvh tracks the visible viewport on iOS Safari (100vh sits under the toolbar)
    <div
      className="relative w-full h-dvh overflow-hidden bg-[#1a1a2e]"
      onPointerDown={SoundManager.unlock}
    >
      {/* touch-none: no pinch/double-tap zoom or panning over the game canvas */}
      <div ref={containerRef} className="absolute inset-0 touch-none" />
      {/* pointer-events-none on the container so the Phaser canvas receives input
          in the surrounding padding area; pointer-events-auto on the buttons
          keeps them fully clickable/tappable. Vertically centred in the reading
          scenes' 52px nav bar. */}
      <header
        className="absolute top-0 right-0 z-30 flex items-center gap-2 pointer-events-none"
        style={{
          paddingTop:   'max(8px, env(safe-area-inset-top))',
          paddingRight: 'max(12px, env(safe-area-inset-right))',
        }}
      >
        {activeScene === 'overworld' && (
          <button
            type="button"
            onClick={() => setSkillsOpen(true)}
            className={`${HEADER_BTN} border-slate-600/70 bg-[#060b17]/80 text-slate-200 hover:border-amber-400/70 hover:text-amber-300`}
          >
            <GamepadIcon className="h-4 w-4 text-amber-400" />
            SKILLS
          </button>
        )}
        <a
          href="mailto:hello@appsarchitects.com"
          className={`${HEADER_BTN} border-amber-400 bg-amber-400 text-[#1a1a2e] hover:bg-amber-300 hover:border-amber-300`}
        >
          GET IN TOUCH
        </a>
      </header>
      <TouchControls />
      <SkillInventory />
    </div>
  )
}
