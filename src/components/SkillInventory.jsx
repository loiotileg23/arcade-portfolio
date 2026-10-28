import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import usePortfolioStore from '../store/usePortfolioStore'
import SKILLS from '../data/skills'

export function GamepadIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <line x1="6" y1="11" x2="10" y2="11" />
      <line x1="8" y1="9" x2="8" y2="13" />
      <line x1="15" y1="12" x2="15.01" y2="12" />
      <line x1="18" y1="10" x2="18.01" y2="10" />
      <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
    </svg>
  )
}

// Skill Inventory — modal panel listing skills by category as chips.
// Closes on backdrop tap, the ✕ button, or Escape.
export default function SkillInventory() {
  const open    = usePortfolioStore((s) => s.skillsOpen)
  const setOpen = usePortfolioStore((s) => s.setSkillsOpen)
  const closeRef = useRef(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="skills-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="skills-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl max-h-[85dvh] overflow-y-auto rounded-2xl border border-slate-700/60 bg-[#0f172a] p-5 font-mono shadow-2xl select-text"
            style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 id="skills-title" className="text-base font-bold tracking-wide text-slate-50">
                SKILL INVENTORY
              </h2>
              <div className="flex items-center gap-3">
                <GamepadIcon className="h-5 w-5 text-amber-400" />
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close skill inventory"
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-100"
                >
                  ✕
                </button>
              </div>
            </div>

            {SKILLS.map(({ category, skills }) => (
              <section key={category} className="mb-4 last:mb-0">
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-amber-400">
                  {category}
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <li key={skill} className="rounded-md bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100">
                      {skill}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
