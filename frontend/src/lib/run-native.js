// CARGA: the run recorded by the phone itself in the installed app (Android RunTrackService, iOS
// RunTrackerPlugin), so the GPS keeps going with the screen locked and the lock screen shows the
// panel with Pause and Stop. Two things come from the phone, once a second while the app is on screen:
//   - the events it queued, in order, which the page turns into the run (its map, its history):
//       { kind: 'fix', t, lat, lng, acc, alt }   a GPS fix
//       { kind: 'pause' | 'resume', t }          a tap on the panel
//       { kind: 'stop', t }                      Stop on the panel: the run is saved
//   - a snapshot of the numbers the panel shows (distance, pace, moving time), so the app and the
//     lock screen show the very same figures.
// On the web (no plugin) none of this runs: run-recorder.js keeps the browser's GPS.
import { registerPlugin } from '@capacitor/core'
import { MOBILE } from './mobile.js'

// A Capacitor plugin is a Proxy that answers `then` with a native call that never settles, so a
// promise resolved with the bare plugin hangs for good (lib/rest-alert.js restPlugin, the Coach
// hang #42). It is never returned from an async function: it travels inside `box`.
const box = { p: null }
let ready = null
/** Resolves true when this app has the phone's recorder, false on the web or in an older app. */
export function nativeRun() {
  if (!MOBILE) return Promise.resolve(false)
  if (!ready) {
    ready = (async () => {
      try {
        const p = registerPlugin('RunTracker')
        const s = await p.status()
        if (s && s.supported) { box.p = p; return true }
      } catch { /* not in this build */ }
      return false
    })()
  }
  return ready
}
export const nativeActive = () => !!box.p

let handlers = null, draining = null
/**
 * Hooks the page's recorder up: `apply(events)` gets each batch in order, `snap(snapshot)` the
 * phone's own numbers. Both run once a second while the app is on screen, and at once when the
 * phone says something is queued or the app comes back to the front.
 */
export async function bindNative(apply, snap) {
  const ok = await nativeRun()
  if (!ok || handlers) return ok
  handlers = { apply, snap }
  const drain = () => {
    if (draining) return draining
    draining = Promise.resolve()
      .then(() => box.p.drain())
      .then(r => { const ev = (r && r.events) || []; if (ev.length) handlers.apply(ev) })
      .then(() => box.p.snapshot?.())
      .then(s => { if (s && s.running) handlers.snap?.(s) })
      .catch(() => {})
      .finally(() => { draining = null })
    return draining
  }
  try { await box.p.addListener('queued', () => { drain() }) } catch { /* fine */ }
  try {
    const { App } = await import('@capacitor/app')
    App.addListener('appStateChange', s => { if (s.isActive) drain() })
  } catch { /* fine */ }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') drain() })
  setInterval(() => { if (document.visibilityState === 'visible') drain() }, 1000)
  drain()
  return true
}

/** The phone's numbers right now (distM, paceSec, movingSec, paused, running), or null. */
export const nativeSnapshot = () => Promise.resolve().then(() => box.p?.snapshot?.()).then(s => (s && s.running ? s : null)).catch(() => null)
export const nativeStart = (type, title) => Promise.resolve().then(() => box.p?.start({ type, title })).catch(() => null)
export const nativePause = () => Promise.resolve().then(() => box.p?.pause()).catch(() => null)
export const nativeResume = () => Promise.resolve().then(() => box.p?.resume()).catch(() => null)
export const nativeEnd = () => Promise.resolve().then(() => box.p?.end()).catch(() => null)
