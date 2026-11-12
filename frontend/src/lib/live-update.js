// CARGA: live updates for the Android and iPhone apps. The screens (the web build inside the app)
// update without a store release: on launch and on every return to the foreground the app reads
// the feed on CARGA's own site, downloads a newer bundle in the background, and switches to it the
// next time it goes to the background, so nothing changes under someone mid-workout. The plugin
// (@capgo/capacitor-updater, manual mode, no third-party service) rolls back on its own if a new
// bundle fails to start: notifyAppReady() below is what tells it the bundle came up fine.
//
// The feed (scripts/build-app.mjs writes it, the site serves it):
//   /app-update/latest.json  { version, url, checksum, native }
//   native: the oldest store version the bundle runs on; an older app waits for the store update
// A store build carries its own bundle id in VITE_BUNDLE_ID, so it never re-downloads itself.
import { MOBILE } from './mobile.js'

const ENV = import.meta.env || {}
const FEED = ENV.VITE_UPDATE_FEED || 'https://carga-swart.vercel.app/app-update/latest.json'
const BUILT_IN = ENV.VITE_BUNDLE_ID || ''
const EVERY_MS = 30 * 60 * 1000

/** '1.2.0' vs '1.10.0', numerically; -1, 0 or 1. */
export function compareVersions(a, b) {
  const x = String(a || '0').split('.').map(n => parseInt(n, 10) || 0), y = String(b || '0').split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1 }
  return 0
}

/** Whether `feed` is worth downloading for an app running bundle `running` on store version `native`. */
export function wants(feed, running, native) {
  if (!feed || !feed.version || !feed.url) return false
  if (feed.version === running) return false
  if (feed.native && compareVersions(native, feed.native) < 0) return false
  return compareVersions(feed.version, running) > 0
}

let last = 0, busy = false
async function check(U) {
  if (busy || Date.now() - last < EVERY_MS) return
  busy = true; last = Date.now()
  try {
    const res = await fetch(FEED + '?t=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return
    const feed = await res.json()
    const cur = await U.current()
    const running = !cur?.bundle || cur.bundle.id === 'builtin' ? BUILT_IN : cur.bundle.version
    if (!wants(feed, running, cur?.native)) return
    const b = await U.download({ url: feed.url, version: feed.version, checksum: feed.checksum })
    await U.next({ id: b.id })
  } catch { /* offline or a bad feed: the next check tries again */ } finally { busy = false }
}

/** Starts it, once, in the installed app only. */
export async function startLiveUpdates() {
  if (!MOBILE) return
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
    await CapacitorUpdater.notifyAppReady()
    check(CapacitorUpdater)
    const { App } = await import('@capacitor/app')
    App.addListener('appStateChange', s => { if (s.isActive) check(CapacitorUpdater) })
  } catch { /* the plugin is not in this build */ }
}
