import { describe, it, expect } from 'vitest'
import {
  levelFor, stepFor, replay, levelCard, weekPicks, dayFacts, startPause, endPause, canPause, pauseNow,
  MISSIONS_PER_RANK, PTS, missionPts, TIERS, isFlashDay, flashOf,
} from './carga-level.js'

let seq = 0
const wo = (d, entries, extra = {}) => ({ id: 'w' + (++seq), d, start: new Date(d + 'T18:00:00').getTime(), end: new Date(d + 'T19:00:00').getTime(), entries, ...extra })
// '0043' barbell full squat (legs), '0025' barbell bench press
const sets = n => Array.from({ length: n }, () => ({ w: 60, r: 8, done: true }))
const squat = n => ({ id: '0043', sets: sets(n) })
const bench = n => ({ id: '0025', sets: sets(n) })
const at = iso => new Date(iso + 'T12:00:00')
const addDays = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10)
// four workouts a week, legs included, for `weeks` weeks from a Monday
const trained = (from, weeks) => {
  const list = []
  for (let w = 0; w < weeks; w++) for (const d of [0, 1, 3, 4]) list.push(wo(addDays(from, 7 * w + d), [squat(5), bench(5)], d === 0 ? { prs: ['0043'] } : {}))
  return list
}

describe('carga-level', () => {
  it('climbs a little slower every level and names every five', () => {
    expect(levelFor(0)).toMatchObject({ level: 1, rank: 0, into: 0, step: stepFor(1), sub: 'I' })
    expect(levelFor(stepFor(1)).level).toBe(2)
    let xp = 0
    for (let n = 1; n < 6; n++) xp += stepFor(n)
    expect(levelFor(xp)).toMatchObject({ level: 6, rank: 1, sub: 'I' })
    expect(levelFor(10_000_000).tier.id).toBe('max')
  })

  it('gives more missions as the rank climbs, always one about training often', () => {
    const { days } = dayFacts({ workouts: trained('2026-09-07', 4) })
    for (const r of [0, 3, 6]) {
      const picks = weekPicks(days, '2026-10-05', r)
      expect(picks).toHaveLength(MISSIONS_PER_RANK[r])
      expect(picks[0].id).toBe('workouts')
    }
    expect(weekPicks(days, '2026-10-05', 0)).toEqual(weekPicks(days, '2026-10-05', 0))
  })

  it('grows with training and drains slowly when it stops, from Rank C up', () => {
    // 26 weeks of training: well into Rank C, where the drain starts
    const S = { workouts: trained('2026-03-02', 26) }
    const active = replay(S, at('2026-08-30')).carga
    expect(levelFor(active).rank).toBeGreaterThanOrEqual(2)
    const later = replay(S, at('2026-10-11')).carga
    expect(later).toBeLessThan(active)
    // slowly: six idle weeks keep most of it
    expect(later).toBeGreaterThan(active * 0.75)
  })

  it('keeps the best rank ever reached even after the Carga falls', () => {
    const S = { workouts: trained('2025-01-06', 40) }
    const peak = replay(S, at('2025-10-12'))
    const long = replay(S, at('2027-06-06'))
    expect(long.carga).toBeLessThan(peak.carga)
    expect(long.best).toBeGreaterThanOrEqual(peak.best)
    expect(levelFor(long.carga).rank).toBeLessThan(long.best)
  })

  it('freezes the Carga during a pause', () => {
    const S = { workouts: trained('2026-03-02', 26) }
    // Monday: the last trained week has closed and paid its decay
    const before = replay(S, at('2026-08-31')).carga
    const paused = { ...S, cargaPauses: [{ from: '2026-08-31', to: '2026-09-06' }] }
    expect(replay(paused, at('2026-09-07')).carga).toBe(before)
    expect(replay(S, at('2026-09-07')).carga).toBeLessThan(before)
  })

  it('freezes the week it starts in, ends early, and allows one frozen week a month', () => {
    const s = {}
    startPause(s, '2026-11-03')
    expect(pauseNow(s, '2026-11-05')).toBeTruthy()
    expect(pauseNow(s, '2026-11-10')).toBe(null)
    endPause(s, '2026-11-05')
    expect(pauseNow(s, '2026-11-05')).toBe(null)
    expect(canPause(s, '2026-11-20')).toBe(false)
    expect(canPause(s, '2026-12-01')).toBe(true)
  })

  it('never drains ranks E and D', () => {
    const S = { workouts: trained('2026-08-03', 2) }
    const after = replay(S, at('2026-08-17')).carga
    expect(levelFor(after).rank).toBeLessThan(2)
    expect(replay(S, at('2026-12-28')).carga).toBe(after)
  })

  it('pays a little per mission and a lot for all of them', () => {
    const S = { workouts: trained('2026-10-05', 1) }
    const L = levelCard(S, at('2026-10-11'))
    expect(L.week.missions.length).toBe(MISSIONS_PER_RANK[L.week.rank])
    expect(L.week.missionPts).toBe(missionPts(L.week.rank))
    expect(L.week.bonus).toBeGreaterThan(L.week.missionPts * L.week.missions.length)
  })

  it('shows flash missions on some days only, the same on every device', () => {
    const days = Array.from({ length: 30 }, (_, i) => addDays('2026-11-01', i))
    const flash = days.filter(isFlashDay)
    expect(flash.length).toBeGreaterThan(3)
    expect(flash.length).toBeLessThan(20)
    const f = flashOf({}, flash[0], 2)
    expect(f).toMatchObject({ have: 0, done: false })
    expect(PTS.flash).toBeGreaterThan(PTS.daily)
  })

  it('starts someone who has not trained yet at rank E with missions to do', () => {
    const L = levelCard({ workouts: [] }, at('2026-11-03'))
    expect(L).toMatchObject({ level: 1, rank: 0, carga: 0 })
    expect(L.week.missions).toHaveLength(MISSIONS_PER_RANK[0])
    expect(L.tier).toBe(TIERS[0])
  })
})
