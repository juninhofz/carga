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
