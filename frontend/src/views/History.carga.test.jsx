// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { historyRows } from './History.jsx'

// CARGA: History lists every activity, each on its own row: a gym session in the morning and
// jiu-jitsu at night on the same day are two rows, the later one first.
describe('History with the runs and classes', () => {
  const day = '2026-11-05'
  const at = hm => Date.parse(day + 'T' + hm + ':00')
  const S = {
    workouts: [{ id: 'gym', d: day, start: at('07:00'), end: at('08:00'), name: 'Peito', entries: [], prs: [] }],
    runs: [
      { id: 'bjj', type: 'bjj', name: 'Jiu-jitsu', start: at('19:30'), movingSec: 3600 },
      { id: 'run', type: 'run', name: 'Corrida', start: Date.parse('2026-11-04T06:00:00'), movingSec: 1800, distM: 5000 },
    ],
    dayNotes: {},
  }
  it('keeps the gym session and the class apart, newest first', () => {
    expect(historyRows(S).map(r => r.w?.id || r.run?.id)).toEqual(['bjj', 'gym', 'run'])
  })
  it('a day with only a run is a trained day: its note stays in the day sheet', () => {
    const rows = historyRows({ ...S, dayNotes: { '2026-11-04': { text: 'cansado', _ts: 1 } } })
    expect(rows.some(r => r.note)).toBe(false)
  })
})
