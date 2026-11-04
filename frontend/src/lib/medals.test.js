import { describe, expect, it } from 'vitest'
import { medalSummary } from './medals.js'

describe('the medal counts', () => {
  it('shows each place in the kind won most', () => {
    const m = [...Array(5)].map(() => ({ kind: 'run', place: 1 })).concat([{ kind: 'gym', place: 1 }, { kind: 'gym', place: 1 }, { kind: 'gym', place: 2 }])
    expect(medalSummary(m)).toEqual([{ place: 1, n: 7, kind: 'run' }, { place: 2, n: 1, kind: 'gym' }, { place: 3, n: 0, kind: 'run' }])
  })
  it('breaks a tie by the kind with more medals overall', () => {
    const m = [{ kind: 'gym', place: 1 }, { kind: 'run', place: 1 }, { kind: 'run', place: 3 }]
    expect(medalSummary(m)[0].kind).toBe('run')
  })
})
