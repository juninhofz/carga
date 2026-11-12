// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { useRun, startRun, applyNative } from './run-recorder.js'
import { useStore } from '../store/useStore.js'

// the test browser has no GPS: an empty one (the fixes come from the phone's queue here)
Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { watchPosition: () => 1, clearWatch: () => {} } })

// a straight line north: 0.0009° of latitude is about 100 m
const fixAt = (i, t) => ({ kind: 'fix', t, lat: -23.55 + i * 0.0009, lng: -46.63, acc: 5 })

describe('the phone recording a run with the screen locked', () => {
  beforeEach(() => { useRun.setState({ track: null, fix: null, gps: 'off' }); useStore.getState().update(s => { s.runs = [] }) })

  it('rebuilds the track from the queued fixes, in order', () => {
    startRun('run')
    const t0 = useRun.getState().track.startedAt
    applyNative(Array.from({ length: 11 }, (_, i) => fixAt(i, t0 + 1000 + i * 30000)))
    const t = useRun.getState().track
    expect(t.status).toBe('running')
    expect(t.dist).toBeGreaterThan(900)
    expect(t.dist).toBeLessThan(1100)
  })

  it('a pause tapped on the panel keeps the paused stretch out, Stop saves the run', () => {
    startRun('run')
    const t0 = useRun.getState().track.startedAt
    const ev = [
      ...Array.from({ length: 6 }, (_, i) => fixAt(i, t0 + 1000 + i * 30000)),
      { kind: 'pause', t: t0 + 160000 },
      fixAt(20, t0 + 400000),               // walked away while paused: not counted
      { kind: 'resume', t: t0 + 700000 },
      ...Array.from({ length: 5 }, (_, i) => fixAt(21 + i, t0 + 701000 + i * 30000)),
      { kind: 'stop', t: t0 + 860000 },
    ]
    applyNative(ev)
    expect(useRun.getState().track).toBe(null)
    const run = useStore.getState().S.runs[0]
    expect(run).toBeTruthy()
    // ~500 m before the pause and ~400 m after it, nothing for the paused walk
    expect(run.distM).toBeGreaterThan(800)
    expect(run.distM).toBeLessThan(1000)
    // moving time leaves out the ~9 minutes paused
    expect(run.movingSec).toBeLessThan(400)
  })
})
