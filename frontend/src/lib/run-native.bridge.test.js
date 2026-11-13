// @vitest-environment happy-dom
// The whole path the installed app takes: the phone's recorder (a fake RunTracker plugin here)
// queues fixes and says "queued", the page drains them into the run on screen, and Save keeps it.
import { describe, it, expect, vi } from 'vitest'

const phone = { queue: [], listeners: {}, calls: [], snapshot: null }
vi.mock('./mobile.js', async (orig) => ({ ...(await orig()), MOBILE: true }))
// A Capacitor plugin is a Proxy that answers `then` with a native call that never settles: a promise
// resolved with the bare plugin hangs for good (lib/rest-alert.js restPlugin, the Coach hang #42).
// The fake behaves the same way, so a recorder that hands the plugin out bare fails here.
vi.mock('@capacitor/core', async (orig) => ({
  ...(await orig()),
  registerPlugin: name => {
    if (name !== 'RunTracker') return {}
    const methods = {
      status: async () => ({ supported: true }),
      start: async o => { phone.calls.push(['start', o]) },
      pause: async () => { phone.calls.push(['pause']) },
      resume: async () => { phone.calls.push(['resume']) },
      end: async () => { phone.calls.push(['end']) },
      drain: async () => { const events = phone.queue; phone.queue = []; return { events } },
      snapshot: async () => phone.snapshot || null,
      addListener: async (ev, cb) => { phone.listeners[ev] = cb; return { remove() {} } },
    }
    return new Proxy({}, { get: (_, prop) => (prop === 'then' ? () => {} : methods[prop]) })
  },
}))
Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { watchPosition: () => 1, clearWatch: () => {} } })

const fixAt = (i, t) => ({ kind: 'fix', t, lat: -23.55 + i * 0.0009, lng: -46.63, acc: 5 })
const tick = () => new Promise(r => setTimeout(r, 0))

describe('the run recorded by the phone, end to end', () => {
  it('fixes the phone queued reach the run on screen, and Save keeps it', async () => {
    const rec = await import('./run-recorder.js')
    const { useStore } = await import('../store/useStore.js')
    await tick(); await tick()
    rec.startRun('run')
    await tick()
    expect(phone.calls[0]?.[0]).toBe('start')
    const t0 = rec.useRun.getState().track.startedAt
    phone.queue.push(...Array.from({ length: 11 }, (_, i) => fixAt(i, t0 + 1000 + i * 30000)))
    phone.snapshot = { running: true, distM: 1003, paceSec: 300, movingSec: 301, paused: false }
    phone.listeners.queued?.()
    await tick(); await tick(); await tick()
    const t = rec.useRun.getState().track
    expect(t.dist).toBeGreaterThan(900)
    expect(rec.useRun.getState().nat.distM).toBe(1003)
    const id = rec.finishRun()
    expect(id).toBeTruthy()
    expect(useStore.getState().S.runs[0].distM).toBeGreaterThan(900)
  }, 60000)
})
