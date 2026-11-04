// CARGA: the runs (S.runs) merge entry by entry in a sync, like the workouts: signing in on a
// device must not lose the runs only it has to the cloud's copy (it did, as one whole key).
import { describe, expect, it } from 'vitest'
import { mergeStates } from './sync-merge.js'
describe('runs in a sync', () => {
  it('keeps the runs of both devices', () => {
    const phone = { _ts: 2, runs: [{ id: 'r2', start: 20, _ts: 20, name: 'Corrida b' }] }
    const cloud = { _ts: 5, runs: [{ id: 'r1', start: 10, _ts: 10, name: 'Corrida a' }] }
    const out = mergeStates(cloud, phone)
    expect(out.runs.map(r => r.id)).toEqual(['r2', 'r1'])
  })
})
