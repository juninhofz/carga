import { describe, expect, it } from 'vitest'
import { leaderboard, teamScores, progressOf, checkinScore, routeOf } from './challenges-group.js'
import { encodeRows } from './run-track.js'

const ch = scoring => ({ starts: '2026-11-01', ends: '2026-11-30', scoring })
const members = [{ user_id: 'a', name: 'Ana' }, { user_id: 'b', name: 'Bia' }, { user_id: 'c', name: 'Caio' }]
const ck = (user_id, day, extra = {}) => ({ user_id, day, created_at: day + 'T10:00:00Z', kind: 'gym', minutes: 60, km: 0, ...extra })

describe('the leaderboard', () => {
  const checkins = [ck('a', '2026-11-02'), ck('a', '2026-11-02', { created_at: '2026-11-02T19:00:00Z' }), ck('a', '2026-11-03'),
    ck('b', '2026-11-02'), ck('b', '2026-11-04'), ck('b', '2026-11-05'), ck('c', '2026-10-30')]
  it('counts each day once in a days challenge', () => {
    const rows = leaderboard(ch('days'), members, checkins)
    expect(rows.map(r => [r.name, r.score, r.place])).toEqual([['Bia', 3, 1], ['Ana', 2, 2], ['Caio', 0, 3]])
  })
  it('counts every check-in in a workouts challenge, and shares a place on a tie', () => {
    const rows = leaderboard(ch('workouts'), members, checkins)
    expect(rows.map(r => [r.name, r.score, r.place])).toEqual([['Ana', 3, 1], ['Bia', 3, 1], ['Caio', 0, 3]])
  })
  it('leaves out what falls outside the dates', () => {
    expect(leaderboard(ch('workouts'), members, checkins).find(r => r.name === 'Caio').count).toBe(0)
  })
  it('sums minutes, km of the GPS sports only, and CARGA points by status', () => {
    expect(checkinScore({ kind: 'run', km: 5.2 }, 'km')).toBe(5.2)
    expect(checkinScore({ kind: 'gym', km: 0 }, 'km')).toBe(0)
    expect(checkinScore({ minutes: 45 }, 'minutes')).toBe(45)
    expect(checkinScore({ status: 'brutal' }, 'carga')).toBe(4)
    expect(checkinScore({ status: null }, 'carga')).toBe(1)
  })
  it('adds up the teams', () => {
    expect(teamScores([{ team: 0, score: 3 }, { team: 1, score: 2 }, { team: 0, score: 1 }])).toEqual([4, 2])
  })
})

describe('a check-in with only a photo', () => {
  const m2 = [{ user_id: 'a', name: 'Ana' }, { user_id: 'b', name: 'Bia' }]
  it('counts half a day, and a recorded one the same day makes it whole', () => {
    const rows = leaderboard(ch('days'), m2, [ck('a', '2026-11-02', { verified: false }), ck('b', '2026-11-02', { verified: false }), ck('b', '2026-11-02', { created_at: '2026-11-02T20:00:00Z' })])
    expect(rows.map(r => [r.name, r.score])).toEqual([['Bia', 1], ['Ana', 0.5]])
  })
  it('counts half in every other scoring', () => {
    expect(checkinScore({ verified: false }, 'workouts')).toBe(0.5)
    expect(checkinScore({ verified: false, minutes: 60 }, 'minutes')).toBe(30)
    expect(checkinScore({ verified: false, kind: 'run', km: 5 }, 'km')).toBe(2.5)
    expect(checkinScore({ verified: false }, 'carga')).toBe(1)
  })
})

describe('the rest', () => {
  it('knows the day of the challenge', () => {
    expect(progressOf({ starts: '2026-11-01', ends: '2026-11-30' }, '2026-11-04')).toMatchObject({ total: 30, day: 4, left: 26, started: true, over: false })
  })
  it('reads back a route', () => {
    const pts = [[-23.58, -46.65], [-23.581, -46.652]]
    expect(routeOf({ stats: { route: encodeRows(pts.map(([a, b]) => [Math.round(a * 1e5), Math.round(b * 1e5)])) } })).toEqual(pts)
  })
})

describe('a one-day race', () => {
  const race = { starts: '2026-11-08', ends: '2026-11-08', scoring: 'race', target_km: 10 }
  const run = (user_id, km, sec, extra = {}) => ({ user_id, day: '2026-11-08', created_at: '2026-11-08T09:00:00Z', kind: 'run', km, minutes: Math.round(sec / 60), stats: { sec }, ...extra })
  const ms = [{ user_id: 'a', name: 'Ana' }, { user_id: 'b', name: 'Bia' }, { user_id: 'c', name: 'Caio' }]
  it('puts the fastest over the distance first, and those without a time last', () => {
    const rows = leaderboard(race, ms, [run('a', 10.02, 3120), run('b', 10.1, 2890), run('c', 6, 1500)])
    expect(rows.map(r => [r.name, r.score, r.place])).toEqual([['Bia', 2890, 1], ['Ana', 3120, 2], ['Caio', 0, 3]])
  })
  it('keeps each one\'s best time', () => {
    const rows = leaderboard(race, ms.slice(0, 1), [run('a', 10, 3300), run('a', 10, 3100, { created_at: '2026-11-08T11:00:00Z' })])
    expect(rows[0].score).toBe(3100)
  })
})

import { liftsOf, liftBoards } from './challenges-group.js'
describe('a lifting duel', () => {
  const duel = { starts: '2026-11-08', ends: '2026-11-08', scoring: 'lifts', rules: { lifts: [{ id: '0025', name: 'Supino reto', pts: 3 }, { id: '0047', name: 'Supino inclinado', pts: 2 }] } }
  const ms = [{ user_id: 'a', name: 'Ana' }, { user_id: 'b', name: 'Bia' }]
  const gym = (user_id, lifts, extra = {}) => ({ user_id, day: '2026-11-08', created_at: '2026-11-08T19:00:00Z', kind: 'gym', stats: { lifts }, ...extra })
  it('reads the heaviest working set of each exercise, in kg', () => {
    const w = { entries: [{ id: '0025', sets: [{ w: 60, r: 10, done: true }, { w: 80, r: 6, done: true }, { w: 100, r: 1, done: false }] }, { id: '0047', sets: [{ w: 100, r: 5, done: true }] }] }
    expect(liftsOf(w)).toEqual({ '0025': 80, '0047': 100 })
    expect(liftsOf(w, 'lb')['0047']).toBeCloseTo(45.4, 1)
  })
  it('gives each exercise\'s points to the heaviest, and ignores photo-only posts', () => {
    const cks = [gym('a', { '0025': 80, '0047': 50 }), gym('b', { '0025': 75, '0047': 60 }), gym('b', { '0025': 120 }, { verified: false })]
    const rows = leaderboard(duel, ms, cks)
    expect(rows.map(r => [r.name, r.score])).toEqual([['Ana', 3], ['Bia', 2]])
    expect(liftBoards(duel, ms, cks)[0].rows.map(x => x.kg)).toEqual([80, 75])
  })
})
