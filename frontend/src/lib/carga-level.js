// CARGA's level: the Carga (points) that rises with training and slowly drains without it, the
// rank card it puts you on, and the missions that feed it.
//
// Pure and framework-free, and almost nothing is stored: the Carga is replayed week by week from
// the profile's own workouts every time, so a phone and a synced copy agree, and a workout
// imported later is counted in its own week. The one thing stored is when the owner paused
// (S.cargaPauses, for an injury or a holiday), because no workout can say that.
//
// THE CARD SHOWS WHERE YOU ARE NOW, NOT THE BEST YOU EVER WERE
//   Every closed week the Carga loses DECAY of itself (a share of what is on the card, so it
//   always drains slowly and a bigger Carga loses more), unless the week was paused, and only from
//   Rank C (DECAY_FROM) up: E and D never lose, so a beginner is never set back. Training
//   earns more than that; stopping lets it run down until the card drops a rank. The best rank
//   ever reached is kept apart (`best`) and never falls.
//
// WHERE POINTS COME FROM
//   each workout PTS.workout, each record PTS.pr, each weekly mission missionPts(rank): a little.
//   All of the week's missions: weekAllPts(rank), times the streak multiplier: a lot.
//   Each monthly challenge (lib/challenges.js) PTS.month; all three: monthAllPts(rank) × streak.
//   The optional daily mission PTS.daily; a flash mission, on the days one shows, PTS.flash.
//   The streak multiplier grows by STREAK_STEP for every week in a row with all missions made,
//   up to STREAK_MAX, and a week left incomplete resets it.
//
// THE MISSIONS. Each rank brings more of them (MISSIONS_PER_RANK) and harder targets, always
// sized from the owner's own last weeks, so a beginner and a veteran get a fair version of the
// same mission. One is always about training often; the rest turn through strength, variety,
// cardio, mobility and the body, with the week, never by chance: two devices pick the same ones.
//
// THE LEVELS. Level n needs stepFor(n) more points to reach n + 1. Every five levels share a RANK,
// shown as the rank card, from E to the Full Load (Carga Máxima), the brand's own word.
import { workoutDay, doneUnits, sessionVolume, completedRepsOf } from './history.js'
import { isWarmupRow } from './workout-model.js'
import { canonicalExId, isCardio, EXIDX } from './exercises.js'
import { musclesOf } from './muscles.js'
import { weekKey, weekStartOf, isoOf } from './format.js'
import { GROUPS } from './challenges.js'

export const PTS = { workout: 15, pr: 20, month: 50, daily: 10, flash: 40 }
export const missionPts = r => 25 + 5 * r
export const weekAllPts = r => 200 + 100 * r
export const monthAllPts = r => 400 + 100 * r
export const STREAK_STEP = 0.1
export const STREAK_MAX = 1.5
export const DECAY = 0.02
// the first rank whose Carga drains (C); below it a card only grows
export const DECAY_FROM = 2
export const MISSIONS_PER_RANK = [2, 3, 3, 4, 4, 5, 5, 5, 5, 5]
// a freeze holds one week (the one it starts in), and one may start each calendar month
export const PAUSES_PER_MONTH = 1

/** Points from level n to n + 1. */
export const stepFor = n => 100 + 40 * (Math.max(1, n) - 1)

// The ranks of the rank card (components/RankCard.jsx), five levels each; past the last one the
// levels go on under its name. `r` is the letter on the card, `c` and `c2` the two colours of its
// frame and aura, `fx` how fine the frame is (sparks, a foil sheen, holographic, living fire).
// The names are provisional: they are i18n keys, so renaming one is a change to the locales.
export const TIERS = [
  { id: 'dormant', r: 'E', name: 'Dormant', c: '#9aa0a8', c2: '#3f4247', fx: '' },
  { id: 'spark', r: 'D', name: 'Spark', c: '#e9edf2', c2: '#7d8590', fx: 'sparks' },
  { id: 'ember', r: 'C', name: 'Ember', c: '#ffd23f', c2: '#8a6500', fx: 'sparks' },
  { id: 'flame', r: 'B', name: 'Flame', c: '#ff6b00', c2: '#7a2f00', fx: 'sparks' },
  { id: 'current', r: 'A', name: 'Surge', c: '#3fa9ff', c2: '#0b3f73', fx: 'sparks' },
  { id: 'storm', r: 'S', name: 'Storm', c: '#a66bff', c2: '#3b1580', fx: 'sparks foil' },
  { id: 'titan', r: 'SS', name: 'Titan', c: '#ff3b3b', c2: '#6e0d0d', fx: 'sparks foil' },
  { id: 'colossus', r: 'SSS', name: 'Colossus', c: '#ffc83d', c2: '#7a5300', fx: 'sparks foil holo' },
  { id: 'supernova', r: '★', name: 'Supernova', c: '#fff1c4', c2: '#b08a2a', fx: 'sparks foil holo' },
  { id: 'max', r: '∞', name: 'Full Load', c: '#ff8a1f', c2: '#7a2f00', fx: 'sparks foil fire' },
]
export const PER_TIER = 5
const ROMAN = ['I', 'II', 'III', 'IV', 'V']

/** The level for an amount of points: { level, rank, tier, sub, into, step, total }. */
export function levelFor(points) {
  let level = 1, floor = 0
  const total = Math.max(0, Math.floor(points || 0))
  while (total >= floor + stepFor(level)) { floor += stepFor(level); level++ }
  const rank = Math.min(TIERS.length - 1, Math.floor((level - 1) / PER_TIER))
  const sub = rank === TIERS.length - 1 && level > TIERS.length * PER_TIER ? null : ROMAN[(level - 1) % PER_TIER]
  return { level, rank, tier: TIERS[rank], sub, into: total - floor, step: stepFor(level), total }
}
const rankOf = points => levelFor(points).rank

/* ---------- reading the history, day by day and week by week ---------- */

const DAY = 86400000
const dayAt = iso => Date.parse(iso + 'T12:00:00Z')
const isoAt = ms => new Date(ms).toISOString().slice(0, 10)
const localIso = ms => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
const addDays = (iso, n) => isoAt(dayAt(iso) + n * DAY)
const dayIndex = iso => Math.round(dayAt(iso) / DAY)
const weekIndex = key => Math.floor(dayIndex(key) / 7)

const workRows = e => (Array.isArray(e?.sets) ? e.sets : []).filter(s => s && !isWarmupRow(s))
const doneSets = e => workRows(e).filter(s => doneUnits(s) > 0).length
const exOf = e => (typeof e?.id === 'string' ? EXIDX[canonicalExId(e.id)] : null)
const GROUP_OF = Object.fromEntries(Object.entries(GROUPS).flatMap(([g, ms]) => ms.map(m => [m, g])))
const mainMuscles = e => { const ex = exOf(e); let m = {}; try { m = ex ? musclesOf(ex) : {} } catch { m = {} } return Object.keys(m).filter(k => m[k] >= 1) }
const QUIET = new Set(['stretching', 'mobility', 'yoga'])
const PUSHUP = /push-?\s?ups?\b|press-?\s?ups?\b/
const cardioMin = e => workRows(e).reduce((n, s) => n + (!doneUnits(s) ? 0 : Number(s.min) > 0 ? Number(s.min) : isCardio(e?.id) && Number(s.sec) > 0 ? Number(s.sec) / 60 : 0), 0)
const prsOf = w => new Set(Array.isArray(w?.prs) ? w.prs.filter(id => typeof id === 'string') : []).size

const emptyDay = () => ({ workouts: 0, sets: 0, prs: 0, pushups: 0, cardioMin: 0, legs: 0, core: 0, mobility: 0, weigh: 0, volumeKg: 0, newEx: 0, groups: new Set(), walkMin: 0, stretchMin: 0, checks: new Set() })

/** Everything the missions read, per day: { [iso]: facts }, and the first day anything happened. */
export function dayFacts(S) {
  const days = {}
  const at = iso => days[iso] || (days[iso] = emptyDay())
  const firstSeen = new Set()
  const list = (Array.isArray(S?.workouts) ? S.workouts : []).filter(w => w && workoutDay(w))
    .sort((a, b) => (workoutDay(a) < workoutDay(b) ? -1 : 1))
  const first = list.length ? workoutDay(list[0]) : null
  for (const w of list) {
    const d = at(workoutDay(w))
    d.workouts++
    d.prs += prsOf(w)
    try { d.volumeKg += sessionVolume(w, S) || 0 } catch { /* a malformed old session adds nothing */ }
    let legs = false, core = false
    for (const e of Array.isArray(w.entries) ? w.entries : []) {
      const n = doneSets(e)
      if (!n) continue
      d.sets += n
      d.cardioMin += cardioMin(e)
      const ex = exOf(e)
      if (ex && QUIET.has(ex.cat)) d.mobility++
      if (ex && PUSHUP.test(String(ex.n || '').toLowerCase())) d.pushups += workRows(e).reduce((r, s) => r + completedRepsOf(s), 0)
      for (const m of mainMuscles(e)) {
        const g = GROUP_OF[m]
        if (g) d.groups.add(g)
        if (g === 'legs') legs = true
        if (g === 'core') core = true
      }
      const id = typeof e.id === 'string' ? canonicalExId(e.id) : null
      if (id && !firstSeen.has(id)) { firstSeen.add(id); if (workoutDay(w) !== first) d.newEx++ }
    }
    if (legs) d.legs++
    if (core) d.core++
  }
  for (const b of Array.isArray(S?.bodyweight) ? S.bodyweight : []) {
    if (b && typeof b.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.d) && Number(b.w) > 0) at(b.d).weigh = 1
  }
  // CARGA runs (views/Run.jsx): a run, ride or class counts as a workout and as its cardio minutes; a
  // walk only from 20 minutes (a short one is the daily mission, not a workout); a stretch is mobility
  for (const r of Array.isArray(S?.runs) ? S.runs : []) {
    if (!r || !Number.isFinite(r.start)) continue
    const d = at(localIso(r.start))
    const min = (Number(r.movingSec) || 0) / 60
    if (r.type === 'stretch') { d.stretchMin += min; if (min >= 3) d.mobility++; continue }
    if (r.type === 'walk' || r.type === 'run') d.walkMin += min
    if (!(r.movingSec >= 300 || r.distM >= 1000) || (r.type === 'walk' && min < 20)) continue
    d.workouts++
    d.cardioMin += min
  }
  // the daily missions ticked by hand ("Fiz!"): S.dailyDone = { [iso]: [mission ids] }
  for (const [iso, ids] of Object.entries(S?.dailyDone && typeof S.dailyDone === 'object' ? S.dailyDone : {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !Array.isArray(ids)) continue
    const d = at(iso)
    for (const id of ids) if (typeof id === 'string') d.checks.add(id)
  }
  const all = Object.keys(days).sort()
  return { days, first: all[0] || null }
}

/** A week's facts from its days. */
function weekOf(days, key) {
  const f = emptyDay()
  for (let i = 0; i < 7; i++) {
    const d = days[addDays(key, i)]
    if (!d) continue
    for (const k of ['workouts', 'sets', 'prs', 'pushups', 'cardioMin', 'legs', 'core', 'mobility', 'weigh', 'volumeKg', 'newEx']) f[k] += d[k]
    d.groups.forEach(g => f.groups.add(g))
  }
  return { ...f, groups: f.groups.size }
}

/* ---------- the missions ---------- */

const round5 = n => Math.round(n / 5) * 5
const round500 = n => Math.round(n / 500) * 500
const median = xs => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }

// One mission is always about training often; the others turn through these categories.
export const CATEGORIES = ['strength', 'variety', 'cardio', 'mobility', 'body']
export const WEEKLY = [
  { id: 'workouts', cat: 'habit', icon: 'dumbbell', n: (P, r) => [2, 3, 3, 4, 4, 4, 5, 5, 5, 5][r], have: f => f.workouts },
  { id: 'sets', cat: 'strength', icon: 'list', n: (P, r) => Math.max(15, round5(P.sets * (1 + 0.05 * r))), have: f => f.sets, fits: P => P.sets > 0 },
  { id: 'volume', cat: 'strength', icon: 'plate', n: (P, r) => Math.max(1000, round500(P.volumeKg * (1 + 0.05 * r))), have: f => Math.floor(f.volumeKg), fits: P => P.volumeKg > 0 },
  { id: 'pr', cat: 'strength', icon: 'trophy', n: (P, r) => (r >= 5 ? 2 : 1), have: f => f.prs, fits: (P, r) => P.prs > 0 || r >= 2 },
  { id: 'legs', cat: 'variety', icon: 'figureStrength', n: () => 1, have: f => f.legs },
  { id: 'newex', cat: 'variety', icon: 'sparkles', n: () => 1, have: f => f.newEx, fits: P => !P.fresh },
  { id: 'groups', cat: 'variety', icon: 'figureStrength', n: (P, r) => Math.min(6, 2 + r), have: f => f.groups, fits: (P, r) => r >= 2 },
  { id: 'cardio', cat: 'cardio', icon: 'figureRun', n: (P, r) => 15 + 5 * r, have: f => Math.floor(f.cardioMin) },
  { id: 'mobility', cat: 'mobility', icon: 'heart', n: () => 1, have: f => f.mobility },
  { id: 'weigh', cat: 'body', icon: 'scale', n: () => 1, have: f => f.weigh },
]
const BY_ID = Object.fromEntries(WEEKLY.map(m => [m.id, m]))

/** How someone has been training, from the four weeks before `key`. */
function paceBefore(days, key) {
  const past = [1, 2, 3, 4].map(i => weekOf(days, addDays(key, -7 * i))).filter(f => f.workouts > 0)
  return {
    fresh: past.length === 0,
    sets: median(past.map(f => f.sets)),
    volumeKg: median(past.map(f => f.volumeKg)),
    prs: past.reduce((n, f) => n + f.prs, 0),
  }
}

/** The week's missions for someone at `rank`: [{ id, cat, icon, n }]. */
export function weekPicks(days, key, rank) {
  const P = paceBefore(days, key)
  const i = weekIndex(key)
  const count = MISSIONS_PER_RANK[Math.min(rank, MISSIONS_PER_RANK.length - 1)]
  const out = [{ ...BY_ID.workouts, n: BY_ID.workouts.n(P, rank) }]
  for (let c = 0; c < CATEGORIES.length && out.length < count; c++) {
    const cat = CATEGORIES[(i + c) % CATEGORIES.length]
    const options = WEEKLY.filter(m => m.cat === cat && (!m.fits || m.fits(P, rank)))
    if (!options.length) continue
    const m = options[(i + c) % options.length]
    out.push({ ...m, n: m.n(P, rank) })
  }
  return out.map(({ id, cat, icon, n }) => ({ id, cat, icon, n }))
}

/** The missions of a week with how far they are. */
export function weekProgress(days, key, rank) {
  const f = weekOf(days, key)
  return weekPicks(days, key, rank).map(p => { const have = BY_ID[p.id].have(f); return { ...p, have, done: have >= p.n } })
}

// The optional daily mission, one a day, turning with the date.
// The daily mission (optional, small points): something simple anyone can do every day, without a
// gym, chosen by the person's goal (the active Personal method's answers). `how` is how it gets
// done: 'walk' with the GPS walk (or any run), 'stretch' with the stretch timer, 'check' by hand
// ("Fiz!"). A workout logged that day does the gym-ish ones too.
const M = {
  walk10: { title: 'Caminhe 10 minutos', icon: 'steps', how: 'walk', done: d => d.walkMin >= 10 },
  walk20: { title: 'Caminhe ou corra 20 minutos', icon: 'cargaRun', how: 'walk', done: d => d.walkMin >= 20 },
  stretch5: { title: 'Alongue-se 5 minutos', icon: 'stretch', how: 'stretch', done: d => d.stretchMin >= 5 || d.mobility > 0 },
  squats20: { title: 'Faça 20 agachamentos', icon: 'legs', how: 'check', done: (d, id) => d.checks.has(id) || d.legs > 0 },
  pushups10: { title: 'Faça 10 flexões', icon: 'arm', how: 'check', done: (d, id) => d.checks.has(id) || d.pushups >= 10 },
  pushups20: { title: 'Faça 20 flexões', icon: 'arm', how: 'check', done: (d, id) => d.checks.has(id) || d.pushups >= 20 },
  plank: { title: 'Segure a prancha por 1 minuto', icon: 'abs', how: 'check', done: (d, id) => d.checks.has(id) || d.core > 0 },
  shake: { title: 'Tome seu shake ou vitamina', icon: 'flame', how: 'check', done: (d, id) => d.checks.has(id) },
  water: { title: 'Beba 2 litros de água', icon: 'heart', how: 'check', done: (d, id) => d.checks.has(id) },
  jacks: { title: 'Faça 50 polichinelos', icon: 'bolt', how: 'check', done: (d, id) => d.checks.has(id) },
  stairs: { title: 'Suba escadas por 5 minutos', icon: 'steps', how: 'check', done: (d, id) => d.checks.has(id) },
  sleep: { title: 'Durma 8 horas hoje', icon: 'moon', how: 'check', done: (d, id) => d.checks.has(id) },
}
export const DAILY_BY_GOAL = {
  fatloss: ['walk20', 'stretch5', 'water', 'walk10', 'jacks', 'stairs', 'squats20'],
  hypertrophy: ['shake', 'pushups20', 'stretch5', 'squats20', 'sleep', 'plank', 'walk10'],
  strength: ['plank', 'pushups20', 'stretch5', 'squats20', 'sleep', 'shake', 'walk10'],
  conditioning: ['walk20', 'jacks', 'stretch5', 'stairs', 'plank', 'walk10', 'water'],
  health: ['walk10', 'stretch5', 'water', 'squats20', 'sleep', 'plank', 'walk20'],
  sport: ['stretch5', 'plank', 'walk10', 'jacks', 'sleep', 'pushups10', 'water'],
  default: ['walk10', 'stretch5', 'squats20', 'pushups10', 'plank', 'water', 'walk20'],
}
export const DAILY = Object.entries(M).map(([id, m]) => ({ id, ...m }))
/** The person's goal from the active Personal method (or the last one), or null. */
export function goalOf(S) {
  const list = Array.isArray(S?.methods) ? S.methods : []
  const m = list.find(x => x && x.id === S?.activeMethod) || list[list.length - 1]
  return m?.answers?.goal || null
}
export const dailyOf = (days, iso, goal = null) => {
  const pool = DAILY_BY_GOAL[goal] || DAILY_BY_GOAL.default
  const id = pool[((dayIndex(iso) % pool.length) + pool.length) % pool.length]
  const m = M[id]
  const d = days[iso] || emptyDay()
  return { id, icon: m.icon, title: m.title, how: m.how, done: m.done(d, id) }
}
/** Ticks (or unticks) a hand-done daily mission on a store draft. */
export function tickDaily(s, iso, id, on = true) {
  const all = s.dailyDone && typeof s.dailyDone === 'object' ? { ...s.dailyDone } : {}
  const ids = new Set(Array.isArray(all[iso]) ? all[iso] : [])
  if (on) ids.add(id); else ids.delete(id)
  all[iso] = [...ids]
  // keep the last 60 days
  const keys = Object.keys(all).sort()
  for (const k of keys.slice(0, Math.max(0, keys.length - 60))) delete all[k]
  s.dailyDone = all
}

// Flash missions show on about three days in ten and last that day only; harder with the rank.
export const FLASH = [
  { id: 'pushups', icon: 'arm', n: r => 30 + 10 * r, have: d => d.pushups },
  { id: 'cardio', icon: 'figureRun', n: r => 15 + 3 * r, have: d => Math.floor(d.cardioMin) },
  { id: 'legs', icon: 'figureStrength', n: () => 1, have: d => d.legs },
  { id: 'pr', icon: 'trophy', n: () => 1, have: d => d.prs },
]
export const isFlashDay = iso => ((dayIndex(iso) * 7 + 3) % 10) < 3
export function flashOf(days, iso, rank) {
  if (!isFlashDay(iso)) return null
  const m = FLASH[((Math.floor(dayIndex(iso) / 3) % FLASH.length) + FLASH.length) % FLASH.length]
  const d = days[iso] || emptyDay()
  const n = m.n(rank), have = m.have(d)
  return { id: m.id, icon: m.icon, n, have, done: have >= n }
}

/* ---------- pauses ---------- */

const PAUSES_KEPT = 24
/** The stored pauses, cleaned: [{ from, to }] as ISO days, oldest first. */
export function pausesOf(S) {
  const list = Array.isArray(S?.cargaPauses) ? S.cargaPauses : []
  return list.filter(p => p && /^\d{4}-\d{2}-\d{2}$/.test(p.from) && /^\d{4}-\d{2}-\d{2}$/.test(p.to) && p.to >= p.from)
    .sort((a, b) => (a.from < b.from ? -1 : 1)).slice(-PAUSES_KEPT)
}
const pausedOn = (pauses, iso) => pauses.some(p => iso >= p.from && iso <= p.to)
/** The pause running on `today`, if any. */
export const pauseNow = (S, today) => pausesOf(S).find(p => today >= p.from && today <= p.to) || null
/** Whether a freeze may start on `today`: none running and none started yet this calendar month. */
export function canPause(S, today) {
  const month = today.slice(0, 7)
  return !pauseNow(S, today) && pausesOf(S).filter(p => p.from.slice(0, 7) === month).length < PAUSES_PER_MONTH
}
/** Freezes the week `today` is in (to its last day) on a store draft. */
export function startPause(s, today) {
  if (!canPause(s, today)) return
  const to = addDays(weekKey(today, weekStartOf(s)), 6)
  s.cargaPauses = [...pausesOf(s), { from: today, to }].slice(-PAUSES_KEPT)
}
/** Ends the running pause yesterday (today counts again). */
export function endPause(s, today) {
  s.cargaPauses = pausesOf(s).map(p => (today >= p.from && today <= p.to ? { ...p, to: addDays(today, -1) } : p)).filter(p => p.to >= p.from)
}

/* ---------- replaying the Carga ---------- */

const monthEnd = key => { const [y, m] = key.split('-').map(Number); return isoAt(Date.UTC(y, m, 0, 12)) }

/** Monthly challenges as points, by month: { [YYYY-MM]: { one, all } } (all = the three made). */
function monthsOf(S) {
  const out = {}
  for (const [key, m] of Object.entries(S?.challenges && typeof S.challenges === 'object' ? S.challenges : {})) {
    if (!/^\d{4}-\d{2}$/.test(key)) continue
    const done = Array.isArray(m?.done) ? m.done.length : 0
    const picked = Array.isArray(m?.picked) ? m.picked.length : 0
    out[key] = { one: done, all: picked > 0 && done >= picked }
  }
  return out
}

/**
 * The whole story, replayed: the Carga now, the best rank ever, the streak, and this week's and
 * today's missions with their points.
 */
export function replay(S, now = new Date()) {
  const today = isoOf(now)
  const ws = weekStartOf(S)
  const { days, first } = dayFacts(S)
  const pauses = pausesOf(S)
  const months = monthsOf(S)
  const goal = goalOf(S)
  const current = weekKey(today, ws)
  let carga = 0, best = 0, streak = 0, lastNet = 0
  let week = null
  let key = first ? weekKey(first, ws) : current
  const paid = new Set()
  for (let guard = 0; key <= current && guard < 1500; guard++, key = addDays(key, 7)) {
    const closed = key < current
    const start = carga
    const rank = rankOf(carga)
    const mult = Math.min(STREAK_MAX, 1 + STREAK_STEP * streak)
    const missions = weekProgress(days, key, rank)
    const f = weekOf(days, key)
    const done = missions.filter(m => m.done).length
    const allDone = done === missions.length
    let earned = f.workouts * PTS.workout + f.prs * PTS.pr + done * missionPts(rank)
    if (allDone) earned += Math.round(weekAllPts(rank) * mult)
    for (let i = 0; i < 7; i++) {
      const iso = addDays(key, i)
      if (iso > today) break
      if (dailyOf(days, iso, goal).done) earned += PTS.daily
      const fl = flashOf(days, iso, rank)
      if (fl && fl.done) earned += PTS.flash
    }
    // a month's challenges count in the week it ends in (this month's, in this week)
    for (const [mk, m] of Object.entries(months)) {
      if (paid.has(mk)) continue
      const end = monthEnd(mk)
      if ((end >= key && end <= addDays(key, 6)) || (!closed && mk === today.slice(0, 7))) {
        paid.add(mk)
        earned += m.one * PTS.month + (m.all ? Math.round(monthAllPts(rank) * mult) : 0)
      }
    }
    carga += earned
    const paused = [0, 1, 2, 3, 4, 5, 6].some(i => pausedOn(pauses, addDays(key, i)))
    if (closed) {
      // ranks E and D never lose: the drain starts at Rank C (DECAY_FROM)
      if (!paused && rankOf(carga) >= DECAY_FROM) carga -= Math.round(carga * DECAY)
      streak = allDone ? streak + 1 : paused ? streak : 0
      lastNet = carga - start
    } else {
      week = { key, rank, missions, done, allDone, mult, bonus: Math.round(weekAllPts(rank) * mult), missionPts: missionPts(rank), paused }
    }
    best = Math.max(best, rankOf(carga))
  }
  const L = levelFor(carga)
  return {
    carga, best, streak, lastNet, week,
    daily: dailyOf(days, today, goal),
    flash: flashOf(days, today, L.rank),
    pause: pauseNow(S, today),
    canPause: canPause(S, today),
    // the first level of a rank, losing ground last week: the card warns before it drops
    risk: L.rank > 0 && L.level === L.rank * PER_TIER + 1 && lastNet < 0,
  }
}

/** The numbers on the rank card: workouts done, records hit, weeks with at least one workout. */
export function statsOf(S) {
  let workouts = 0, prs = 0
  const weeks = new Set()
  const ws = weekStartOf(S)
  for (const w of Array.isArray(S?.workouts) ? S.workouts : []) {
    const d = w && workoutDay(w)
    if (!d) continue
    workouts++
    prs += prsOf(w)
    weeks.add(weekKey(d, ws))
  }
  return { workouts, prs, weeks: weeks.size }
}

/** Everything the level card shows. */
export function levelCard(S, now = new Date()) {
  const R = replay(S, now)
  return { ...levelFor(R.carga), ...R, stats: statsOf(S) }
}
