// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { stretchRoutine, ensureStretchRoutine, STRETCHES, STRETCH_ROUTINE_ID } from './guided-stretch.js'
import { EXIDX } from './exercises.js'
import { applyLiveEvents, bindLiveActions } from './live-activity.js'

describe('the guided stretch', () => {
  it('is eight stretches of the catalogue, 30 s each, that start by themselves', () => {
    const r = stretchRoutine()
    expect(r.ex).toHaveLength(8)
    for (const e of r.ex) {
      expect(EXIDX[e.id]?.cat).toBe('stretching')
      expect(e).toMatchObject({ mode: 'time', sec: 30, autoHold: true, sets: 1 })
    }
    expect(STRETCHES.reduce((n) => n + 30, 0)).toBeGreaterThanOrEqual(5 * 60 - 60)
  })
  it('goes into the profile once, and comes back to its first form', () => {
    const s = { routines: [{ id: 'x', name: 'A', ex: [] }] }
    ensureStretchRoutine(s)
    ensureStretchRoutine(s)
    expect(s.routines.filter(r => r.id === STRETCH_ROUTINE_ID)).toHaveLength(1)
    s.routines[1].ex = []
    ensureStretchRoutine(s)
    expect(s.routines[1].ex).toHaveLength(8)
  })
})

describe('the lock-screen panel’s +15s', () => {
  it('adds to the rest through the workout screen', () => {
    const added = []
    const off = bindLiveActions({ restAdd: s => added.push(s), timer: () => null })
    const state = () => ({ S: { active: { id: 'w1', entries: [{ id: '1', sets: [{}] }] } } })
    const done = applyLiveEvents([{ id: 'e-restadd-1', type: 'restAdd', wid: 'w1', sec: 15, at: Date.now() }], state)
    off()
    expect(added).toEqual([15])
    expect(done).toEqual(['e-restadd-1'])
  })
})
