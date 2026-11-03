// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { CATALOGUE } from './exercises.js'
import { moveOf, propOf, drawExercise, MOVE_NAMES, sideJoints, elbowBends, kneeBends } from './carga-figure.js'

const ex = (n, extra = {}) => ({ n, bp: 'chest', eq: 'body weight', tg: 'pectorals', cat: 'strength', ...extra })

describe('carga-figure', () => {
  it('sorts the common lifts into their movements', () => {
    expect(moveOf(ex('barbell bench press', { eq: 'barbell' }))).toBe('bench')
    expect(moveOf(ex('barbell full squat', { eq: 'barbell' }))).toBe('squat')
    expect(moveOf(ex('dumbbell biceps curl', { eq: 'dumbbell' }))).toBe('curl')
    expect(moveOf(ex('lying leg curl', { eq: 'leverage machine' }))).toBe('legcurl')
    expect(moveOf(ex('cable seated row', { eq: 'cable' }))).toBe('seatrow')
    expect(moveOf(ex('barbell bent over row', { eq: 'barbell' }))).toBe('row')
    expect(moveOf(ex('lying leg raise'))).toBe('legraise')
    expect(moveOf(ex('band half kneeling chop', { tg: 'abs' }))).not.toBe('jump')
    expect(moveOf(ex('dumbbell shoulder press', { bp: 'shoulders', eq: 'dumbbell' }))).toBe('press')
  })

  it('holds a stretch in its own position, and stands still when it has none', () => {
    expect(moveOf(ex('downward dog', { cat: 'yoga' }))).toBe('downdog')
    expect(moveOf(ex('barbell bench press (with hanging band technique)', { eq: 'barbell' }))).toBe('bench')
    expect(moveOf(ex('1 2 stick drill', { tg: 'cardiovascular system' }))).toBe('steps')
    expect(moveOf(ex('finger flexor stretch', { cat: 'stretching' }))).toBe('breathe')
  })

  it('gives every built-in exercise a movement it can draw', () => {
    for (const e of CATALOGUE) expect(MOVE_NAMES).toContain(moveOf(e))
  })

  it('puts a bar in barbell hands and nothing in empty ones', () => {
    expect(propOf({ eq: 'barbell' })).toBe('bar')
    expect(propOf({ eq: 'dumbbell' })).toBe('db')
    expect(propOf({ eq: 'body weight' })).toBe(null)
  })

  it('never bends an elbow or a knee backwards', () => {
    const bad = []
    for (const move of MOVE_NAMES) {
      for (const prop of [null, 'bar', 'db', 'cable']) {
        for (let i = 0; i <= 20; i++) {
          const j = sideJoints(move, i / 20, prop)
          if (!j) continue
          j.arms.forEach(a => { if (!elbowBends(j.shoulder, a.elbow, a.hand)) bad.push(move + ' elbow ' + prop + ' ' + i) })
          j.legs.forEach(l => { if (!kneeBends(j.hip, l.knee, l.ankle)) bad.push(move + ' knee ' + prop + ' ' + i) })
        }
      }
    }
    expect([...new Set(bad.map(b => b.split(' ').slice(0, 2).join(' ')))]).toEqual([])
  })

  it('draws and poses one figure per movement', () => {
    for (const move of MOVE_NAMES) {
      const e = CATALOGUE.find(x => moveOf(x) === move)
      if (!e) continue
      const holder = document.createElement('div')
      const { set } = drawExercise(holder, e)
      expect(() => { set(0); set(0.5); set(1) }).not.toThrow()
      expect(holder.querySelector('svg')).toBeTruthy()
      expect(holder.innerHTML).not.toContain('NaN')
    }
  })
})
