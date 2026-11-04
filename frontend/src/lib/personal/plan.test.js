import { describe, it, expect } from 'vitest'
import { buildPlan, toApp, splitFor, recoveryOf, excludedBy, SESSIONS } from './plan.js'
import { EXIDX } from '../exercises.js'

const juninho = {
  goal: 'hypertrophy', goal2: 'strength', priorities: ['chest', 'arms'], experience: '2y5y',
  gymDays: [1, 2, 3, 4, 5], sessionMin: 60, shortOnSport: true, sportDayMin: 45,
  sports: [{ id: 'bjj', days: [1, 3, 5], minutes: 90, intensity: 'hard' }],
  sportNeeds: ['grip'], sportRules: { noLegs: true }, equipment: 'full', warmup: true, sleep: '7-8',
}
const isLegs = s => SESSIONS[s.kind].kind === 'legs'

describe('the Personal', () => {
  it('keeps legs off the days with a sport, as asked', () => {
    const P = buildPlan(juninho)
    expect(P.sessions).toHaveLength(5)
    for (const s of P.sessions) if ([1, 3, 5].includes(s.day)) expect(isLegs(s)).toBe(false)
    expect(P.sessions.filter(isLegs).map(s => s.day).sort()).toEqual([2, 4])
  })

  it('makes the sport days shorter and puts the sport on the week as cardio', () => {
    const P = buildPlan(juninho)
    expect(P.sessions.find(s => s.day === 1).minutes).toBe(45)
    expect(P.sessions.find(s => s.day === 2).minutes).toBe(60)
    expect(P.sports.map(s => s.day)).toEqual([1, 3, 5])
    const app = toApp(P, juninho)
    expect(app.customEx[0]).toMatchObject({ bp: 'cardio', custom: true })
    expect(app.week[1]).toHaveLength(2)
  })

  it('never gives an exercise the pain or the dislike rules out', () => {
    const a = { ...juninho, pains: ['lowback', 'knee'], painLevel: 'limits', dislikes: ['pullup'] }
    const out = excludedBy(a)
    for (const s of buildPlan(a).sessions) for (const e of s.exercises) expect(out.has(e.id)).toBe(false)
  })

  it('stays within the equipment: dumbbells at home, no bar to hang from', () => {
    const a = { goal: 'fatloss', experience: 'new', gymDays: [1, 3, 5], sessionMin: 45, equipment: 'home_db', warmup: false }
    for (const s of buildPlan(a).sessions) for (const e of s.exercises) expect(['dumbbell', 'body weight', 'band', 'resistance band', 'kettlebell', 'rope', 'weighted']).toContain(EXIDX[e.id].eq)
    for (const s of buildPlan(a).sessions) for (const e of s.exercises) expect(['0652', '0472', '0251']).not.toContain(e.id)
  })

  it('trains a beginner on three days with the whole body every time', () => {
    expect(splitFor(3, false, 'hypertrophy', true)).toEqual(['fullA', 'fullB', 'fullC'])
    expect(splitFor(5, true, 'hypertrophy')).toEqual(['push', 'legsStr', 'pull', 'legsHyp', 'upperStr'])
  })

  it('puts compound lifts before isolation and fits the time', () => {
    const P = buildPlan(juninho)
    const order = { warmup: 0, main: 1, comp: 2, acc: 3, extra: 4, core: 5, finisher: 6 }
    for (const s of P.sessions) {
      const roles = s.exercises.map(e => order[e.role])
      expect(roles).toEqual([...roles].sort((x, y) => x - y))
      expect(s.exercises.filter(e => e.role !== 'warmup' && e.role !== 'finisher').length).toBeLessThanOrEqual(6)
    }
  })

  it('lowers the dose for someone who sleeps little and works hard', () => {
    expect(recoveryOf({ sleep: 'lt6', job: 'heavy', stress: 'high' })).toBeLessThan(0.9)
    expect(recoveryOf({ sleep: '8plus', stress: 'low' })).toBeGreaterThan(1)
  })

  it('explains itself', () => {
    const P = buildPlan(juninho)
    expect(P.why.join(' ')).toMatch(/perna/)
    expect(P.progression.length).toBeGreaterThan(1)
  })
})
