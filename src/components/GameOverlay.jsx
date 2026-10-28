import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import usePortfolioStore from '../store/usePortfolioStore'
import PROJECTS from '../data/projects'

const AUTO_DISMISS_MS = 3000

export default function GameOverlay() {
  const activeProject = usePortfolioStore((s) => s.activeProject)
  const clearActiveProject = usePortfolioStore((s) => s.clearActiveProject)

  // title comes directly from the store.
  // tags are not stored — resolve them from PROJECTS using the slug.
  const record = activeProject
    ? PROJECTS.find((p) => p.slug === activeProject.slug) ?? null
    : null

  useEffect(() => {
    if (!activeProject) return
    const timer = setTimeout(clearActiveProject, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [activeProject, clearActiveProject])

  return (
    <AnimatePresence>
      {activeProject && record && (
        <motion.div
          key={activeProject.slug}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
        >
          <div className="bg-black/85 border border-green-400 font-mono rounded-sm px-10 py-8 flex flex-col items-center gap-3 max-w-sm text-center">
            <span className="text-green-400 text-xs tracking-widest uppercase">
              ▶ Entering Project
            </span>
            <span className="text-white text-2xl tracking-wide">
              {activeProject.title}
            </span>
            <span className="text-gray-400 text-sm leading-relaxed">
              {record.tags}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
