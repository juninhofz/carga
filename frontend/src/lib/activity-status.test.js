import { describe, expect, it } from 'vitest'
import { runStatus, workoutStatus } from './activity-status.js'

// A straight-line run kept like finishTrack keeps it: one point every 10 s at `speed` m/s.
import { encodeRows } from './run-track.js'
function runOf(id, start, km, paceSec, type = 'run') {
  const speed = 1000 / paceSec, n = Math.round((km * 1000) / speed / 10)
  const rows = Array.from({ length: n + 1 }, (_, i) => [Math.round(-2355000 + i * speed * 10 * 0.9), -4663000, i * 10, 760])
  return { id, type, start, distM: Math.round(km * 1000), movingSec: Math.round(km * paceSec), trk: encodeRows(rows), brk: [] }
}

describe('the status of a run', () => {
  const past = [runOf('a', 1, 5, 300), runOf('b', 2, 5, 306), runOf('c', 3, 5, 294)]
  it('is Pena well under the usual pace', () => {
    expect(runStatus(past, runOf('x', 9, 5, 360)).id).toBe('pena')
  })
  it('is Firme at the usual pace', () => {
    expect(runStatus(past, runOf('x', 9, 5, 301)).id).toBe('firme')
  })
  it('is Pesado a little quicker', () => {
    const spread = [runOf('a', 1, 5, 300), runOf('b', 2, 5, 306), runOf('c', 3, 5, 280)]
    expect(runStatus(spread, runOf('x', 9, 4.3, 285)).id).toBe('pesado')
  })
  it('is Carga Máxima on a best 5 km', () => {
    expect(runStatus(past, runOf('x', 9, 5, 270)).id).toBe('max')
  })
  it('starts at Firme with nothing to compare', () => {
    expect(runStatus([], runOf('x', 9, 5, 300)).id).toBe('firme')
  })
})

describe('the status of a class', () => {
  const bjj = (id, start, min) => ({ id, type: 'bjj', start, movingSec: min * 60, distM: 0 })
  const past = [bjj('a', 1, 60), bjj('b', 2, 62), bjj('c', 3, 58)]
  it('reads the duration against the usual', () => {
    expect(runStatus(past, bjj('x', 9, 30)).id).toBe('pena')
    expect(runStatus(past, bjj('x', 9, 60)).id).toBe('firme')
    expect(runStatus(past, bjj('x', 9, 120)).id).toBe('max')
  })
})

describe('the status of a gym workout', () => {
  const w = (id, start, vol, ids = ['0025', '0047']) => ({ id, start, vol, entries: ids.map(i => ({ id: i })) })
  const vol = x => x.vol
  const past = [w('a', 1, 5000), w('b', 2, 5200), w('c', 3, 4800), w('z', 4, 900, ['0085'])]
  it('compares with the sessions of the same exercises', () => {
    expect(workoutStatus(past, w('x', 9, 3000), vol).id).toBe('pena')
    expect(workoutStatus(past, w('x', 9, 5100), vol).id).toBe('firme')
    expect(workoutStatus(past, w('x', 9, 5700), vol).id).toBe('pesado')
    expect(workoutStatus(past, w('x', 9, 7000), vol).id).toBe('brutal')
  })
  it('is Carga Máxima with a PR', () => {
    expect(workoutStatus(past, w('x', 9, 3000), vol, ['0025']).id).toBe('max')
  })
})
