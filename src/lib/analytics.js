// Vercel Web Analytics — cookieless, aggregate. Enable it in the Vercel
// dashboard (project → Analytics); no keys or env vars are needed.
//
// The whole game lives on one URL, so each scene is reported as a virtual
// page (/tunnel/the-forge, /castle, /contact …). The address bar and browser
// history are never touched — beforeSend rewrites the URL the event reports.
// Custom events (EVENTS below) are recorded on Vercel Pro; on Hobby they are
// accepted but not shown.
import { inject, pageview, track } from '@vercel/analytics'

export const EVENTS = {
  getInTouch:     'Get In Touch Click',
  resumeRequest:  'Resume Request',
  inquiry:        'Professional Inquiry',
  linkedIn:       'LinkedIn Click',
  copyEmail:      'Copy Email',
  skillsOpen:     'Skills Open',
  liveSite:       'Live Site Click',
  returnHome:     'Return To Overworld',
}

let _path = '/'
let _installed = false

const _withPath = (event) => {
  const url = new URL(event.url)
  url.pathname = _path
  url.search = ''
  url.hash = ''
  return { ...event, url: url.toString() }
}

export function installAnalytics() {
  if (_installed) return
  _installed = true
  inject({
    // Dev loads Vercel's debug script, which logs events to the console instead of sending them
    mode: import.meta.env.PROD ? 'production' : 'development',
    framework: 'react',
    beforeSend: _withPath,
  })
}

// One virtual page view per navigation. Callers fire it once per entry.
export function viewPage(path) {
  _path = path
  pageview({ route: path, path })
}

// For overlays (the contact panel): report a view, and give back a function that
// restores the underlying page for later events without counting a second view.
export function viewOverlay(path) {
  const prev = _path
  viewPage(path)
  return () => { _path = prev }
}

export function trackEvent(name, props) {
  track(name, props)
}

// '01 · Digital Ventures' style names → 'digital-ventures'
export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
