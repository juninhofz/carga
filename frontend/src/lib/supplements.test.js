// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { buildSupplementNotifications, dueOn, newSupplement, spreadTimes } from './supplements.js'
import { useStore } from '../store/useStore.js'

const at = (y, m, d, h = 6) => new Date(y, m - 1, d, h, 0, 0)

describe('supplement reminders', () => {
  it('reminds every day at the chosen times, from now on', () => {
    const s = { ...newSupplement('creatine', 'any', '2026-11-12'), times: ['08:00'] }
    const n = buildSupplementNotifications({ supplements: [s] }, at(2026, 11, 12, 9))
    // 8:00 today has passed: tomorrow is the first of 13 reminders
    expect(n).toHaveLength(13)
    expect(n[0].title).toBe('Hora da creatina 💊')
    expect(n[0].body).toContain('Tome 5 g de creatina')
    expect(n[0].schedule.at.getDate()).toBe(13)
  })
  it('says do / da right, and keeps BCAA and Vitamina D readable', () => {
    const titles = ['whey', 'vitd', 'bcaa'].map(k => buildSupplementNotifications({ supplements: [{ ...newSupplement(k, 'any', '2026-11-12'), every: 1, times: ['23:59'] }] }, at(2026, 11, 12))[0].title)
    expect(titles).toEqual(['Hora do whey 💊', 'Hora da vitamina D 💊', 'Hora do BCAA 💊'])
  })
  it('twice a day gives two reminders a day, ten hours apart by default', () => {
    expect(spreadTimes('08:00', 2)).toEqual(['08:00', '18:00'])
    const s = { ...newSupplement('whey', 'any', '2026-11-12'), perDay: 2, times: ['09:00', '21:00'], every: 1 }
    const n = buildSupplementNotifications({ supplements: [s] }, at(2026, 11, 12))
    expect(n.filter(x => x.schedule.at.getDate() === 12).map(x => x.schedule.at.getHours())).toEqual([9, 21])
  })
  it('every other day and gym days only', () => {
    const s = { ...newSupplement('creatine'), every: 2, start: '2026-11-12' }
    expect(['2026-11-12', '2026-11-13', '2026-11-14'].map(d => dueOn(s, d))).toEqual([true, false, true])
    const g = { ...newSupplement('preworkout'), every: 'train' }
    const S = { week: { 4: ['r1'], 5: [] } }                // Thursday training, Friday not
    expect(dueOn(g, '2026-11-12', S)).toBe(true)
    expect(dueOn(g, '2026-11-13', S)).toBe(false)
  })
  it('nothing when the reminder is off', () => {
    expect(buildSupplementNotifications({ supplements: [{ ...newSupplement('omega3'), remind: false }] }, at(2026, 11, 12))).toEqual([])
  })
  it('the profile keeps the list', () => {
    useStore.getState().update(s => { s.supplements = [newSupplement('creatine')] })
    expect(useStore.getState().S.supplements[0].kind).toBe('creatine')
  })
})
