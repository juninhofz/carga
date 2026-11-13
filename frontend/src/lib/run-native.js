// CARGA: the run recorded by the phone itself in the installed app (Android RunTrackService, iOS
// RunTrackerPlugin), so the GPS keeps going with the screen locked and the lock screen shows the
// panel with Pause and Stop. The page only applies what the phone queued, in order:
//   { kind: 'fix', t, lat, lng, acc, alt }   a GPS fix
//   { kind: 'pause' | 'resume', t }          a tap on the panel
//   { kind: 'stop', t }                      Stop on the panel: the run is saved on the next drain
// The page drains when the phone says there is something (the "queued" event) and every time the
// app comes back to the screen. On the web (no plugin) none of this runs: run-recorder.js keeps
// the browser's GPS.
import { registerPlugin } from '@capacitor/core'
import { MOBILE } from './mobile.js'

let plugin = null, ready = null
/** The plugin when this app has it, else null (the web, an older app). */
export function nativeRun() {
  if (!MOBILE) return Promise.resolve(null)
  if (!ready) {
    ready = (async () => {
      try {
        const p = registerPlugin('RunTracker')
        const s = await p.status()
        if (s && s.supported) { plugin = p; return p }
      } catch { /* not in this build */ }
      return null
    })()
  }
  return ready
}
export const nativeActive = () => !!plugin

let handlers = null, draining = null
/** Hooks the page's recorder up: `apply(events)` gets each batch in order. */
export async function bindNative(apply) {
  const p = await nativeRun()
  if (!p || handlers) return !!p
  handlers = { apply }
  const drain = () => {
    if (draining) return draining
    draining = p.drain().then(r => { const ev = (r && r.events) || []; if (ev.length) handlers.apply(ev) }).catch(() => {}).finally(() => { draining = null })
    return draining
  }
  try { await p.addListener('queued', () => { drain() }) } catch { /* fine */ }
  try {
    const { App } = await import('@capacitor/app')
    App.addListener('appStateChange', s => { if (s.isActive) drain() })
  } catch { /* fine */ }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') drain() })
  setInterval(() => { if (document.visibilityState === 'visible') drain() }, 4000)
  drain()
  return true
}

export const nativeStart = (type, title) => plugin?.start({ type, title }).catch(() => null)
export const nativePause = () => plugin?.pause().catch(() => null)
export const nativeResume = () => plugin?.resume().catch(() => null)
export const nativeEnd = () => plugin?.end().catch(() => null)
