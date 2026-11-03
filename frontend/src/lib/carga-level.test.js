import { describe, it, expect } from 'vitest'
import { levelFor, stepFor, xpOf, weekFacts, weekPicks, weekProgress, levelCard, XP_WORKOUT, XP_SET, XP_PR, XP_WEEKLY, XP_MONTHLY, XP_GOLD, TIERS } from './carga-level.js'

let seq = 0
const wo = (d, entries, extra = {}) => ({ id: 'w' + (++seq), d, start: new Date(d + 'T18:00:00').getTime(), end: new Date(d + 'T19:00:00').getTime(), entries, ...extra })
// '0043' barbell full squat (legs), '0025' barbell bench press
const sets = n => Array.from({ length: n }, () => ({ w: 60, r: 8, done: true }))
const squat = n => ({ id: '0043', sets: sets(n) })
const bench = n => ({ id: '0025', sets: sets(n) })

describe('carga-level', () => {
  it('climbs a little slower every level and names every five', () => {
    expect(levelFor(0)).toMatchObject({ level: 1, into: 0, step: stepFor(1), sub: 'I' })
    expect(levelFor(stepFor(1) - 1).level).toBe(1)
    expect(levelFor(stepFor(1)).level).toBe(2)
    expect(levelFor(stepFor(1) + stepFor(2)).level).toBe(3)
    let xp = 0
    for (let n = 1; n < 6; n++) xp += stepFor(n)
    expect(levelFor(xp)).toMatchObject({ level: 6, sub: 'I' })
    expect(levelFor(xp).tier.id).toBe(TIERS[1].id)
    expect(levelFor(10_000_000).tier.id).toBe('max')
  })

  it('gives XP for each workout, its sets and its records', () => {
    const S = { workouts: [wo('2026-10-05', [bench(3)], { prs: ['0025'] })] }
    const { parts } = xpOf(S)
    expect(parts.workouts).toBe(XP_WORKOUT)
    expect(parts.sets).toBe(3 * XP_SET)
    expect(parts.prs).toBe(XP_PR)
  })

  it('caps the set bonus so one marathon session is not worth a week', () => {
    const S = { workouts: [wo('2026-10-05', [bench(100)])] }
    expect(xpOf(S).parts.sets).toBe(30)
  })

  it('counts monthly challenges and a gold month', () => {
    const S = { workouts: [], challenges: { '2026-10': { picked: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], done: ['a', 'b', 'c'] }, '2026-09': { picked: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], done: ['a'] } } }
    const { parts } = xpOf(S)
    expect(parts.monthly).toBe(4 * XP_MONTHLY)
    expect(parts.gold).toBe(XP_GOLD)
  })

  it('picks the same two weekly challenges every time, one habit and one to vary', () => {
    const S = { workouts: [wo('2026-10-05', [squat(3)]), wo('2026-10-12', [bench(3)])] }
    const f = weekFacts(S)
    const a = weekPicks(f, '2026-10-19'), b = weekPicks(f, '2026-10-19')
    expect(a).toEqual(b)
    expect(a.map(p => p.kind)).toEqual(['habit', 'vary'])
    expect(a[0].n).toBeGreaterThanOrEqual(1)
  })

  it('turns a weekly challenge done into XP', () => {
    // a week with a leg day: whichever two are picked, the legs one (if picked) is done
    const workouts = []
    for (const d of ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']) workouts.push(wo(d, [bench(3)]))
    for (const d of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']) workouts.push(wo(d, [squat(5), bench(5)]))
    const S = { workouts }
    const f = weekFacts(S)
    const done = weekProgress(f, '2026-10-05').filter(p => p.done).length
    expect(done).toBeGreaterThan(0)
    expect(xpOf(S).parts.weekly).toBeGreaterThanOrEqual(done * XP_WEEKLY)
  })

  it('shows a level card for someone who has not trained yet', () => {
    const L = levelCard({ workouts: [] }, new Date('2026-11-03T12:00:00'))
    expect(L.level).toBe(1)
    expect(L.week).toHaveLength(2)
    expect(L.week.every(p => p.have === 0 && !p.done)).toBe(true)
  })
})
