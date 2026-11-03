// CARGA's level: experience (XP) earned by training, and the two weekly personal challenges.
//
// Pure and framework-free, and nothing is stored: like the monthly challenges' progress
// (lib/challenges.js), everything is read back from the profile's own workouts every time, so a
// phone and a synced copy show the same level, and a workout imported later still counts.
//
// WHERE XP COMES FROM
//   a finished workout            XP_WORKOUT, plus XP_SET per completed work set up to XP_SETS_MAX
//   a personal record             XP_PR each (the workout's own `prs`)
//   a weekly challenge made       XP_WEEKLY each
//   a monthly challenge made      XP_MONTHLY each (S.challenges[month].done)
//   a month with all three made   XP_GOLD on top
//
// THE LEVELS. Level n needs stepFor(n) more XP to reach n + 1, a little more every level, so the
// first ones come within days and the last ones over years. Every five levels share a TIER: what
// you can carry, from a feather to the Full Load (Carga Máxima), the brand's own word.
//
// THE WEEKLY CHALLENGES. Two a week, worked out like the monthly ones: one habit (how often you
// train) and one to vary (legs, something new, cardio, a record), sized from the last weeks and
// turning with the week, never by chance, so two devices pick the same two. A week's challenges
// are never stored either: a week done stays done because its workouts stay in the history.
import { workoutDay, doneUnits } from './history.js'
import { isWarmupRow } from './workout-model.js'
import { canonicalExId, isCardio, EXIDX } from './exercises.js'
import { musclesOf } from './muscles.js'
import { weekKey, weekStartOf } from './format.js'

export const XP_WORKOUT = 50
export const XP_SET = 2
export const XP_SETS_MAX = 30
export const XP_PR = 25
export const XP_WEEKLY = 75
export const XP_MONTHLY = 150
export const XP_GOLD = 200

/** XP from level n to n + 1. */
export const stepFor = n => 200 + 50 * (Math.max(1, n) - 1)

// What you carry, five levels each; past the last tier the levels go on under its name. The icons
// are emoji every phone and Windows 10 draws (no newer than 2018).
export const TIERS = [
  { id: 'feather', name: 'Feather', icon: '🕊️' },
  { id: 'brick', name: 'Brick', icon: '🧱' },
  { id: 'cement', name: 'Cement bag', icon: '🏗️' },
  { id: 'gas', name: 'Gas cylinder', icon: '🛢️' },
  { id: 'fridge', name: 'Fridge', icon: '❄️' },
  { id: 'piano', name: 'Grand piano', icon: '🎹' },
  { id: 'beetle', name: 'Beetle', icon: '🚗' },
  { id: 'elephant', name: 'Elephant', icon: '🐘' },
  { id: 'truck', name: 'Truck', icon: '🚚' },
  { id: 'max', name: 'Full Load', icon: '🔥' },
]
export const PER_TIER = 5
const ROMAN = ['I', 'II', 'III', 'IV', 'V']

/** The level for an amount of XP: { level, tier, sub, into, step, total }. */
export function levelFor(xp) {
  let level = 1, floor = 0
  const total = Math.max(0, Math.floor(xp || 0))
  while (total >= floor + stepFor(level)) { floor += stepFor(level); level++ }
  const t = Math.min(TIERS.length - 1, Math.floor((level - 1) / PER_TIER))
  const sub = t === TIERS.length - 1 && level > TIERS.length * PER_TIER ? null : ROMAN[(level - 1) % PER_TIER]
  return { level, tier: TIERS[t], sub, into: total - floor, step: stepFor(level), total }
}

/* ---------- reading the workouts ---------- */

const workRows = e => (Array.isArray(e?.sets) ? e.sets : []).filter(s => s && !isWarmupRow(s))
const doneSets = e => workRows(e).filter(s => doneUnits(s) > 0).length
const LEGS = ['quadriceps', 'hamstring', 'gluteal', 'calves', 'adductors']
const isLegEntry = e => {
  const ex = typeof e?.id === 'string' ? EXIDX[canonicalExId(e.id)] : null
  const m = ex ? musclesOf(ex) : {}
  return LEGS.some(k => (m[k] || 0) >= 1)
}
// a cardio row's `min`, or a timed row's `sec` on a cardio exercise (as lib/challenges.js counts it)
const cardioMin = e => workRows(e).reduce((n, s) => n + (!doneUnits(s) ? 0 : Number(s.min) > 0 ? Number(s.min) : isCardio(e?.id) && Number(s.sec) > 0 ? Number(s.sec) / 60 : 0), 0)

/** Each week's facts, in one pass: { [weekKey]: { workouts, sets, legs, cardioMin, prs, newEx } }. */
export function weekFacts(S) {
  const ws = weekStartOf(S)
  const weeks = {}
  const firstSeen = new Map()
  const list = (Array.isArray(S?.workouts) ? S.workouts : []).filter(w => w && workoutDay(w))
    .sort((a, b) => (workoutDay(a) < workoutDay(b) ? -1 : 1))
  for (const w of list) {
    const day = workoutDay(w)
    const k = weekKey(day, ws)
    const f = weeks[k] || (weeks[k] = { workouts: 0, sets: 0, legs: 0, cardioMin: 0, prs: 0, newEx: 0 })
    f.workouts++
    f.prs += new Set(Array.isArray(w.prs) ? w.prs.filter(id => typeof id === 'string') : []).size
    let legs = false
    for (const e of Array.isArray(w.entries) ? w.entries : []) {
      const n = doneSets(e)
      if (!n) continue
      f.sets += n
      f.cardioMin += cardioMin(e)
      if (!legs && isLegEntry(e)) legs = true
      const id = typeof e.id === 'string' ? canonicalExId(e.id) : null
      if (id && !firstSeen.has(id)) { firstSeen.set(id, day); f.newEx++ }
    }
    if (legs) f.legs++
  }
  // the very first week of someone's history tries everything for the first time: not a challenge made
  const first = list.length ? weekKey(workoutDay(list[0]), ws) : null
  if (first && weeks[first]) weeks[first].newEx = 0
  return weeks
}

/* ---------- the weekly challenges ---------- */

const median = xs => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }
// weekKey(day) is the ISO date of the week's first day, so weeks are ordered as strings
const weeksBefore = (facts, key, n) => Object.keys(facts).filter(k => k < key).sort().slice(-n).map(k => facts[k])
const weekIndex = key => Math.round(Date.parse(key + 'T12:00:00Z') / 604800000)

export const WEEKLY = [
  { id: 'workouts', kind: 'habit', icon: 'dumbbell', target: P => Math.min(6, Math.max(2, Math.round(P.workouts) + (P.workouts >= 2 ? 1 : 0))), have: f => f.workouts },
  { id: 'sets', kind: 'habit', icon: 'list', target: P => Math.max(15, Math.round((P.sets * 1.1) / 5) * 5), have: f => f.sets, fits: P => P.sets > 0 },
  { id: 'legs', kind: 'vary', icon: 'figureStrength', target: () => 1, have: f => f.legs },
  { id: 'newex', kind: 'vary', icon: 'sparkles', target: () => 1, have: f => f.newEx, fits: P => !P.fresh },
  { id: 'cardio', kind: 'vary', icon: 'figureRun', target: P => Math.max(20, Math.round(P.cardioMin / 5) * 5), have: f => Math.floor(f.cardioMin), fits: P => P.cardioMin > 0 },
  { id: 'pr', kind: 'vary', icon: 'trophy', target: () => 1, have: f => f.prs, fits: P => P.prs > 0 },
]

/** The two challenges of `key`'s week, with their targets: [{ id, kind, icon, n }]. */
export function weekPicks(facts, key) {
  const past = weeksBefore(facts, key, 4)
  const P = {
    fresh: past.length === 0,
    workouts: median(past.map(f => f.workouts)),
    sets: median(past.map(f => f.sets)),
    cardioMin: median(past.map(f => f.cardioMin)),
    prs: past.reduce((n, f) => n + f.prs, 0),
  }
  const i = weekIndex(key)
  return ['habit', 'vary'].map(kind => {
    const options = WEEKLY.filter(c => c.kind === kind && (!c.fits || c.fits(P)))
    const c = options[((i % options.length) + options.length) % options.length]
    return { id: c.id, kind, icon: c.icon, n: c.target(P) }
  })
}

const BY_ID = Object.fromEntries(WEEKLY.map(c => [c.id, c]))
const EMPTY = { workouts: 0, sets: 0, legs: 0, cardioMin: 0, prs: 0, newEx: 0 }

/** A week's two challenges with how far they are: [{ id, icon, n, have, done }]. */
export function weekProgress(facts, key) {
  const f = facts[key] || EMPTY
  return weekPicks(facts, key).map(p => {
    const have = BY_ID[p.id].have(f)
    return { ...p, have, done: have >= p.n }
  })
}

/** This week's key in the profile's own week (Monday or Sunday start). */
export const thisWeek = (S, today = new Date()) => {
  const pad = n => String(n).padStart(2, '0')
  return weekKey(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`, weekStartOf(S))
}

/* ---------- XP ---------- */

/** All the XP the history holds, and where it came from. */
export function xpOf(S) {
  const parts = { workouts: 0, sets: 0, prs: 0, weekly: 0, monthly: 0, gold: 0 }
  for (const w of Array.isArray(S?.workouts) ? S.workouts : []) {
    if (!w || !workoutDay(w)) continue
    parts.workouts += XP_WORKOUT
    let sets = 0
    for (const e of Array.isArray(w.entries) ? w.entries : []) sets += doneSets(e)
    parts.sets += Math.min(XP_SETS_MAX, sets * XP_SET)
    parts.prs += XP_PR * new Set(Array.isArray(w.prs) ? w.prs.filter(id => typeof id === 'string') : []).size
  }
  const facts = weekFacts(S)
  for (const key of Object.keys(facts)) parts.weekly += XP_WEEKLY * weekProgress(facts, key).filter(p => p.done).length
  for (const m of Object.values(S?.challenges && typeof S.challenges === 'object' ? S.challenges : {})) {
    const done = Array.isArray(m?.done) ? m.done.length : 0
    const picked = Array.isArray(m?.picked) ? m.picked.length : 0
    parts.monthly += XP_MONTHLY * done
    if (picked > 0 && done >= picked) parts.gold += XP_GOLD
  }
  const total = Object.values(parts).reduce((a, b) => a + b, 0)
  return { total, parts, facts }
}

/** Everything the level card shows: the level, this week's challenges and the XP breakdown. */
export function levelCard(S, today = new Date()) {
  const { total, parts, facts } = xpOf(S)
  const key = thisWeek(S, today)
  return { ...levelFor(total), parts, week: weekProgress(facts, key), weekKey: key }
}
