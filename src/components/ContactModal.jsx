import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import usePortfolioStore from '../store/usePortfolioStore'
import { EMAIL, LINKEDIN_URL, RESUME_MAILTO, INQUIRY_MAILTO } from '../data/contact'
import { trackEvent, viewOverlay, EVENTS } from '../lib/analytics'

const OPTIONS = [
  {
    key: 'resume',
    title: 'REQUEST MY RESUME',
    body: 'Interested in my professional background? Request a private copy of my resume.',
    href: RESUME_MAILTO,
    note: 'Opens your email app',
    event: EVENTS.resumeRequest,
  },
  {
    key: 'inquiry',
    title: 'DISCUSS AN OPPORTUNITY',
    body: 'Connect about professional opportunities, projects, consulting, or partnerships.',
    href: INQUIRY_MAILTO,
    note: 'Opens your email app',
    event: EVENTS.inquiry,
  },
  {
    key: 'linkedin',
    title: 'CONNECT ON LINKEDIN',
    body: 'Connect with me and explore my professional network.',
    href: LINKEDIN_URL,
    note: 'Opens LinkedIn in a new tab',
    event: EVENTS.linkedIn,
    external: true,
  },
]

// Clipboard API first; the textarea + execCommand fallback covers older iOS
// Safari and non-secure contexts where navigator.clipboard is missing.
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    ta.remove()
    return ok
  }
}

const FOCUSABLE = 'a[href], button:not([disabled])'

// Contact panel opened by GET IN TOUCH. Mailto options only open the visitor's
// email app — nothing is sent from the site. Closes on backdrop tap, ✕ or
// Escape; Tab stays inside the panel; focus returns to GET IN TOUCH on close.
export default function ContactModal({ returnFocusRef }) {
  const open    = usePortfolioStore((s) => s.contactOpen)
  const setOpen = usePortfolioStore((s) => s.setContactOpen)
  const panelRef = useRef(null)
  const firstRef = useRef(null)
  const [copyStatus, setCopyStatus] = useState(null) // null | 'ok' | 'fail'

  useEffect(() => {
    if (!open) return
    const restoreView = viewOverlay('/contact')
    firstRef.current?.focus()
    const returnTo = returnFocusRef?.current

    // Window-level so Escape and the Tab trap still work after a click on
    // plain text in the panel has moved focus to <body>
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const items = [...panelRef.current.querySelectorAll(FOCUSABLE)]
      if (!items.length) return
      const first = items[0]
      const last  = items[items.length - 1]
      const inside = panelRef.current.contains(document.activeElement)
      if (e.shiftKey && (!inside || document.activeElement === first)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('keydown', onKey)
      restoreView()
      setCopyStatus(null)
      returnTo?.focus()
    }
  }, [open, setOpen, returnFocusRef])

  useEffect(() => {
    if (!copyStatus) return
    const t = setTimeout(() => setCopyStatus(null), 2400)
    return () => clearTimeout(t)
  }, [copyStatus])

  const onCopy = async () => {
    const ok = await copyText(EMAIL)
    trackEvent(EVENTS.copyEmail, { ok })
    setCopyStatus(ok ? 'ok' : 'fail')
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="contact-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[85dvh] overflow-y-auto rounded-2xl border border-slate-700/60 bg-[#0f172a] p-5 font-mono shadow-2xl select-text"
            style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="contact-title" className="text-base font-bold tracking-wide text-slate-50">
                GET IN TOUCH
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close contact options"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
              >
                ✕
              </button>
            </div>

            <ul className="flex flex-col gap-2.5">
              {OPTIONS.map((o, i) => (
                <li key={o.key}>
                  <a
                    ref={i === 0 ? firstRef : undefined}
                    href={o.href}
                    {...(o.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    onClick={() => trackEvent(o.event)}
                    className="group block rounded-lg border border-slate-700/70 bg-slate-800/60 px-4 py-3 transition-colors hover:border-amber-400/70 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-[12px] font-bold tracking-widest text-amber-400">{o.title}</span>
                      <span aria-hidden="true" className="text-slate-500 transition-colors group-hover:text-amber-300">
                        {o.external ? '↗' : '→'}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-200">{o.body}</span>
                    <span className="mt-1.5 block text-[10px] tracking-wide text-slate-500">{o.note}</span>
                  </a>
                </li>
              ))}
            </ul>

            <div className="mt-4 rounded-lg border border-dashed border-slate-700 px-4 py-3">
              <p className="text-[10px] tracking-wide text-slate-500">
                Use Gmail, Outlook or another webmail? Copy the address:
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-100">{EMAIL}</span>
                <button
                  type="button"
                  onClick={onCopy}
                  className="inline-flex h-8 items-center rounded-md border border-slate-600/70 bg-[#060b17]/80 px-3 text-[11px] font-bold tracking-widest text-slate-200 transition-colors hover:border-amber-400/70 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
                >
                  COPY EMAIL ADDRESS
                </button>
              </div>
              <p aria-live="polite" className="mt-2 min-h-[1rem] text-[11px] text-emerald-400">
                {copyStatus === 'ok' && 'Copied to clipboard.'}
                {copyStatus === 'fail' && <span className="text-rose-300">Couldn’t copy — select the address above instead.</span>}
              </p>
            </div>

            <p className="mt-3 text-center text-[10px] text-slate-500">
              <a href="/privacy.html" className="underline decoration-slate-600 underline-offset-2 hover:text-slate-300">
                Privacy
              </a>
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
