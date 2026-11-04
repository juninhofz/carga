// The CARGA Personal: turns the answers of the questionnaire (views/Personal.jsx) into a whole,
// personal training plan, the way a coach would reason about it. Pure and deterministic: the same
// answers always give the same plan, no server and no AI, so it works offline and every rule can
// be read, tested and tuned.
//
// HOW IT THINKS, in order:
//   1. The doses. Goal (and second goal), experience and recovery (sleep, job, stress) set the
//      rep ranges, the rest, how many sets each exercise gets and how hard to push.
//   2. The split. How many gym days → which sessions (full body, upper/lower, push/pull/legs or a
//      five-day push · legs · pull · legs · upper), strength sessions when strength is a goal.
//   3. The week. Sessions are laid on the chosen days around the sports: legs never on a day the
//      person said no legs to, never two leg days in a row, the heavy strength day away from
//      the hardest sport days; a day with a sport can be shorter and stop short of failure.
//   4. The exercises. Each session is a list of movement slots; each slot takes the first
//      exercise the equipment allows that no pain rules out and the person did not say they hate.
//      Priority muscles get an extra exercise or set; the sport adds what it asks of the body
//      (grip, neck and hips for grappling, rotation and power for striking, single leg and calves
//      for running), on days that do not tire the sport.
//   5. The extras. A warm-up drill, a cardio finisher when the goal asks for it and the sports do
//      not already give it, and the sports themselves as activities on their days, which the app
//      counts as cardio.
// The result names every choice it made (`why`), so the plan explains itself.
import { EXIDX } from '../exercises.js'
import { uid } from '../format.js'

/* ---------- the questionnaire's vocabulary ---------- */

export const GOALS = ['hypertrophy', 'strength', 'fatloss', 'conditioning', 'health', 'sport']
export const EXPERIENCE = ['new', 'lt6m', '6m2y', '2y5y', '5yplus']
export const SPORTS = ['bjj', 'muaythai', 'boxing', 'mma', 'judo', 'wrestling', 'running', 'football', 'cycling', 'swimming', 'crossfit', 'other']
export const GRAPPLING = new Set(['bjj', 'judo', 'wrestling', 'mma'])
export const STRIKING = new Set(['muaythai', 'boxing', 'mma'])
export const ENDURANCE = new Set(['running', 'cycling', 'swimming', 'football'])
export const PAINS = ['shoulder', 'elbow', 'wrist', 'lowback', 'knee', 'hip', 'ankle', 'neck']
export const EQUIPMENT = ['full', 'basic', 'home_db', 'home_band', 'bodyweight']
export const MUSCLES = ['chest', 'back', 'shoulders', 'arms', 'core', 'glutes', 'legs', 'calves']

/* ---------- the exercises, by movement slot ---------- */

// Each slot lists catalogue exercises from best to last resort; the first one the equipment
// allows and nothing rules out is taken.
export const SLOTS = {
  squat: ['0043', '1760', '3948'],
  frontsq: ['0042', '1760', '3948'],
  legpress: ['0739', '2267', '1760', '3948'],
  hack: ['0046', '0739', '1760'],
  rdl: ['0085', '1459', '5864'],
  deadlift: ['0032', '0811', '1459'],
  hipthrust: ['1060', '4742'],
  splitsq: ['4442', '0336', '1460'],
  lunge: ['4295', '0336', '1460'],
  legext: ['0585'],
  legcurl: ['0586', '0599', '1459'],
  calf: ['0605', '0417', '1373'],
  bench: ['0025', '0289', '0662'],
  incline: ['0314', '0047', '0662'],
  fly: ['0155', '0596', '0308'],
  dip: ['0251', '0129'],
  ohp: ['1162', '0405', '0426', '1499'],
  lateral: ['0178', '0334'],
  rear: ['5607', '0378', '1503'],
  row: ['0027', '0293', '4145'],
  supportedrow: ['9698', '0327', '0861', '0293', '4145'],
  cablerow: ['0861', '9698', '0293', '4145'],
  pulldown: ['2330', '0150', '0652', '4145'],
  pullup: ['0652', '0017', '2330', '4145'],
  curl: ['0031', '0294', '4138'],
  hammer: ['0313', '0294', '4138'],
  pushdown: ['0241', '0201', '2188', '0129'],
  tricext: ['2188', '1504', '0129'],
  shrug: ['0095'],
  plank: ['0463'],
  legraise: ['0472', '1163'],
  crunch: ['0175', '0274'],
  antirot: ['0979', '0463'],
  hollow: ['1246', '0463'],
  farmer: ['2133'],
  hang: ['10438'],
  neck: ['2411'],
  neckflex: ['2412'],
  getup: ['0551', '4388'],
  swing: ['0549', '3397', '5864'],
  slam: ['1354', '1699', '1160'],
  rotthrow: ['1699', '0979'],
  jump: ['4242', '4209'],
  rope: ['5038'],
  burpee: ['1160'],
  bike: ['2138', '0685'],
  run: ['0685'],
  warmup: ['4633', '8052', '4580'],
  hipmob: ['4296', '4633'],
}

// What each equipment answer allows, by the catalogue's equipment names.
const ALLOWED = {
  full: null,
  basic: new Set(['barbell', 'dumbbell', 'body weight', 'cable', 'ez barbell', 'kettlebell', 'band', 'resistance band', 'medicine ball', 'rope', 'stationary bike', 'weighted', 'assisted', 'leverage machine', 'trap bar']),
  home_db: new Set(['dumbbell', 'body weight', 'band', 'resistance band', 'kettlebell', 'rope', 'weighted']),
  home_band: new Set(['band', 'resistance band', 'body weight', 'rope']),
  bodyweight: new Set(['body weight']),
}

// Exercises that load each sore spot; a pain that limits rules them out (a mild one keeps the
// lighter ones and only drops the hardest).
const HARD_ON = {
  shoulder: ['1162', '0251', '0129', '0025', '0047', '0652', '0095', '1499'],
  elbow: ['2188', '1504', '0031', '0447', '0251'],
  wrist: ['0031', '0447', '0662', '0126', '0025'],
  lowback: ['0032', '0027', '0043', '0085', '0549', '0811', '0042', '0046'],
  knee: ['0043', '0042', '0046', '0336', '4295', '1460', '4442', '4209', '4242', '0585', '1160', '0685', '5038'],
  hip: ['0336', '4295', '1460', '4442', '0032', '0043'],
  ankle: ['4209', '4242', '5038', '1160', '0685'],
  neck: ['2411', '2412', '0095', '1162'],
}
const MILD_ONLY = { shoulder: ['1162', '0251', '0095'], elbow: ['2188', '1504'], wrist: ['0031', '0126'], lowback: ['0032', '0027'], knee: ['4209', '4242', '0336', '1160'], hip: ['0336'], ankle: ['4209', '4242', '5038'], neck: ['2411', '2412'] }

// What the person said they hate, as tags on the slots they cover.
export const DISLIKES = {
  squat: ['0043', '0042', '0046'], deadlift: ['0032', '0811'], pullup: ['0652', '1326', '0017'], bench: ['0025'],
  lunge: ['0336', '4295', '1460', '4442'], burpee: ['1160'], running: ['0685'], jumps: ['4209', '4242', '5038'], dips: ['0251', '0129'],
}

/* ---------- the sessions ---------- */

// A session is a name, an icon, the muscles it trains and its slots: [slot, role]. Roles:
// 'main' the heavy lift, 'comp' another compound, 'acc' an accessory, 'core', 'extra' (sport or
// priority, only with time to spare). Slots are taken in order until the session's time runs out.
const S_ = (name, emoji, kind, muscles, slots, heavy = false) => ({ name, emoji, kind, muscles, slots, heavy })
export const SESSIONS = {
  push: S_('Peito, ombro e tríceps', 'barbell', 'upper', ['chest', 'shoulders', 'arms'], [['bench', 'main'], ['incline', 'comp'], ['ohp', 'comp'], ['lateral', 'acc'], ['fly', 'acc'], ['pushdown', 'acc'], ['tricext', 'acc']]),
  pull: S_('Costas e bíceps', 'pullup', 'upper', ['back', 'arms'], [['pullup', 'main'], ['supportedrow', 'comp'], ['cablerow', 'comp'], ['rear', 'acc'], ['curl', 'acc'], ['hammer', 'acc'], ['shrug', 'acc']]),
  legsStr: S_('Pernas · força', 'legs', 'legs', ['legs', 'glutes', 'calves', 'core'], [['squat', 'main'], ['rdl', 'comp'], ['legpress', 'comp'], ['legcurl', 'acc'], ['calf', 'acc'], ['plank', 'core']], true),
  legsHyp: S_('Pernas e glúteos · hipertrofia', 'legs', 'legs', ['legs', 'glutes', 'calves', 'core'], [['legpress', 'main'], ['splitsq', 'comp'], ['hipthrust', 'comp'], ['legext', 'acc'], ['legcurl', 'acc'], ['calf', 'acc'], ['legraise', 'core']]),
  upperStr: S_('Superiores · força', 'barbell', 'upper', ['chest', 'back', 'shoulders', 'arms'], [['bench', 'main'], ['row', 'main'], ['ohp', 'comp'], ['pullup', 'comp'], ['dip', 'acc'], ['curl', 'acc']], true),
  upperHyp: S_('Superiores · hipertrofia', 'barbell', 'upper', ['chest', 'back', 'shoulders', 'arms'], [['incline', 'main'], ['pulldown', 'comp'], ['supportedrow', 'comp'], ['lateral', 'acc'], ['fly', 'acc'], ['curl', 'acc'], ['pushdown', 'acc']]),
  lower: S_('Inferiores', 'legs', 'legs', ['legs', 'glutes', 'calves', 'core'], [['squat', 'main'], ['rdl', 'comp'], ['lunge', 'comp'], ['legcurl', 'acc'], ['calf', 'acc'], ['crunch', 'core']]),
  fullA: S_('Corpo inteiro A', 'figureStrength', 'full', ['legs', 'chest', 'back', 'shoulders', 'core'], [['squat', 'main'], ['bench', 'main'], ['row', 'comp'], ['ohp', 'comp'], ['legcurl', 'acc'], ['plank', 'core']], true),
  fullB: S_('Corpo inteiro B', 'figureStrength', 'full', ['legs', 'glutes', 'back', 'chest', 'core'], [['deadlift', 'main'], ['incline', 'comp'], ['pulldown', 'comp'], ['splitsq', 'comp'], ['lateral', 'acc'], ['legraise', 'core']], true),
  fullC: S_('Corpo inteiro C', 'figureStrength', 'full', ['legs', 'glutes', 'back', 'shoulders', 'arms'], [['legpress', 'main'], ['pullup', 'comp'], ['ohp', 'comp'], ['hipthrust', 'comp'], ['curl', 'acc'], ['pushdown', 'acc']], true),
  conditioning: S_('Condicionamento', 'figureRun', 'cond', ['core', 'legs'], [['swing', 'comp'], ['burpee', 'comp'], ['slam', 'comp'], ['rope', 'acc'], ['plank', 'core']]),
}
const LEGS_FREE = { legsStr: 'upperStr', legsHyp: 'upperHyp', lower: 'upperHyp', fullA: 'upperStr', fullB: 'upperHyp', fullC: 'upperHyp' }

/** The sessions for `n` gym days, before they are laid on the week. */
export function splitFor(n, strengthy, goal, beginner = false) {
  if (goal === 'conditioning' && n >= 3) return [...splitFor(n - 1, strengthy, 'health', beginner), 'conditioning']
  // a beginner learns the lifts best by doing each of them often: the whole body, every session
  if (beginner && n <= 3) return ['fullA', 'fullB', 'fullC'].slice(0, Math.max(1, n))
  if (n <= 1) return ['fullA']
  if (n === 2) return ['fullA', 'fullB']
  if (n === 3) return strengthy ? ['fullA', 'fullB', 'fullC'] : ['push', 'pull', 'legsHyp']
  if (n === 4) return strengthy ? ['upperStr', 'legsStr', 'upperHyp', 'legsHyp'] : ['upperHyp', 'lower', 'upperStr', 'legsHyp']
  if (n === 5) return strengthy ? ['push', 'legsStr', 'pull', 'legsHyp', 'upperStr'] : ['push', 'legsHyp', 'pull', 'lower', 'upperHyp']
  return ['push', 'pull', 'legsStr', 'push', 'pull', 'legsHyp'].slice(0, Math.min(n, 6))
}

/* ---------- the doses ---------- */

const EXP_SETS = { new: 2, lt6m: 3, '6m2y': 3, '2y5y': 3, '5yplus': 4 }
/** How well this person recovers: 0.8 (little sleep, heavy job, high stress) to 1.1. */
export function recoveryOf(a) {
  let r = 1
  if (a.sleep === 'lt6') r -= 0.12
  else if (a.sleep === '8plus') r += 0.05
  if (a.job === 'heavy') r -= 0.08
  if (a.stress === 'high') r -= 0.07
  else if (a.stress === 'low') r += 0.03
  if (num(a.age) >= 45) r -= 0.05
  return Math.max(0.75, Math.min(1.1, r))
}
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0)

/** Reps, rest and how hard, for a role under the person's goals. */
export function doseFor(role, a, heavy = true) {
  const goals = [a.goal, a.goal2].filter(Boolean)
  const has = g => goals.includes(g)
  const beginner = a.experience === 'new' || a.experience === 'lt6m'
  if (role === 'core') return { reps: 15, repsMin: 10, rest: 45, sec: 40 }
  if (has('strength') && role === 'main' && heavy && !beginner) return { reps: 6, repsMin: 4, rest: 180, rir: 2 }
  if (has('strength') && role === 'comp' && heavy && !has('hypertrophy') && !beginner) return { reps: 8, repsMin: 6, rest: 150, rir: 2 }
  if (has('fatloss') || has('conditioning')) return role === 'acc' ? { reps: 15, repsMin: 12, rest: 45, rir: 1 } : { reps: 12, repsMin: 8, rest: 75, rir: 2 }
  if (has('health')) return { reps: 12, repsMin: 10, rest: 75, rir: 3 }
  if (role === 'main') return { reps: 10, repsMin: beginner ? 8 : 6, rest: 120, rir: beginner ? 3 : 2 }
  if (role === 'comp') return { reps: 12, repsMin: 8, rest: 90, rir: 2 }
  return { reps: 15, repsMin: 10, rest: 60, rir: 1 }
}

/* ---------- choosing exercises ---------- */


// Exercises that need a bar to hang from: out at home unless there is one.
const NEEDS_BAR = ['0652', '1326', '0017', '0472', '10438', '0251']

export function excludedBy(a) {
  const out = new Set()
  if (['home_db', 'home_band', 'bodyweight'].includes(a.equipment) && !a.hasBar) for (const id of NEEDS_BAR) out.add(id)
  for (const p of a.pains || []) for (const id of (a.painLevel === 'mild' ? MILD_ONLY : HARD_ON)[p] || []) out.add(id)
  for (const d of a.dislikes || []) for (const id of DISLIKES[d] || []) out.add(id)
  return out
}
export function pick(slot, a, taken, excluded) {
  const allowed = ALLOWED[a.equipment || 'full']
  for (const id of SLOTS[slot] || []) {
    const ex = EXIDX[id]
    if (!ex || taken.has(id) || excluded.has(id)) continue
    if (allowed && !allowed.has(ex.eq)) continue
    return id
  }
  return null
}

const EXERCISES_FOR_MIN = m => (m <= 30 ? 4 : m <= 45 ? 5 : m <= 60 ? 6 : m <= 75 ? 7 : 8)

// What each sport asks of the body, as slots to add on days that do not tire it.
export const SPORT_NEEDS = {
  grappling: { slots: [['farmer', 'extra'], ['hang', 'extra'], ['antirot', 'core'], ['neck', 'extra'], ['getup', 'extra']], why: 'pegada, pescoço, quadril e core para o jiu-jitsu e a luta agarrada' },
  striking: { slots: [['rotthrow', 'extra'], ['slam', 'extra'], ['calf', 'acc'], ['antirot', 'core'], ['neck', 'extra']], why: 'rotação, explosão, panturrilha e pescoço para a luta em pé' },
  endurance: { slots: [['splitsq', 'comp'], ['calf', 'acc'], ['plank', 'core'], ['hipmob', 'extra']], why: 'perna unilateral, panturrilha e core para aguentar a corrida e o jogo' },
}
const NEED_SLOTS = { grip: [['farmer', 'extra'], ['hang', 'extra']], gas: [['swing', 'extra']], power: [['jump', 'extra'], ['slam', 'extra']], strength: [], mobility: [['hipmob', 'extra']], injury: [['antirot', 'core'], ['rear', 'acc']] }
const PRIORITY_SLOTS = { chest: ['fly', 'incline', 'bench'], back: ['cablerow', 'pulldown', 'supportedrow', 'row'], shoulders: ['lateral', 'rear', 'ohp'], arms: ['pushdown', 'curl', 'tricext', 'hammer'], core: ['legraise', 'antirot', 'plank', 'crunch'], glutes: ['hipthrust', 'splitsq'], legs: ['legext', 'legcurl'], calves: ['calf'] }

/* ---------- the plan ---------- */

const DOW = [1, 2, 3, 4, 5, 6, 0]
export const DAY_NAMES = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' }
const SPORT_NAMES = { bjj: 'Jiu-jitsu', muaythai: 'Muay Thai', boxing: 'Boxe', mma: 'MMA', judo: 'Judô', wrestling: 'Wrestling', running: 'Corrida', football: 'Futebol', cycling: 'Ciclismo', swimming: 'Natação', crossfit: 'CrossFit' }
export const sportName = s => (s.id === 'other' ? (s.otherName || 'Outra atividade') : SPORT_NAMES[s.id] || s.id)

/** Everything the plan needs, worked out from the answers. */
export function buildPlan(a) {
  const why = []
  const goals = [a.goal, a.goal2].filter(Boolean)
  const strengthy = goals.includes('strength') || goals.includes('sport')
  const rec = recoveryOf(a)
  const gymDays = DOW.filter(d => (a.gymDays || []).includes(d))
  const sports = (a.sports || []).filter(s => s && s.id)
  const sportOn = d => sports.filter(s => (s.days || []).includes(d))
  const hardSportOn = d => sportOn(d).some(s => s.intensity === 'hard' || s.intensity === 'competition')
  const noLegs = d => a.sportRules?.noLegs && sportOn(d).length > 0
  const grappler = sports.some(s => GRAPPLING.has(s.id)), striker = sports.some(s => STRIKING.has(s.id)), endurance = sports.some(s => ENDURANCE.has(s.id))

  // 2. the split
  const beginner = a.experience === 'new' || a.experience === 'lt6m'
  let kinds = splitFor(gymDays.length, strengthy, a.goal, beginner)
  if (beginner && gymDays.length <= 3) why.push('Como você está começando, cada treino trabalha o corpo inteiro: você aprende os movimentos repetindo cada um várias vezes por semana.')
  if (strengthy) why.push('Força entra nos exercícios principais: poucas repetições e carga alta, subindo aos poucos.')
  if (goals.includes('hypertrophy')) why.push('Hipertrofia no resto: de 8 a 15 repetições, perto da falha, com volume por músculo controlado.')

  // 3. the week: legs first, on days that allow them and never back to back, then the rest
  const isLegs = k => SESSIONS[k].kind === 'legs'
  const slots = gymDays.map(d => ({ day: d, kind: null }))
  const legs = kinds.filter(isLegs), rest = kinds.filter(k => !isLegs(k))
  const legDays = slots.filter(s => !noLegs(s.day))
  const placed = new Set()
  for (const k of legs) {
    const free = legDays.filter(s => !s.kind && !placed.has(s.day))
    // prefer a day whose neighbours hold no leg session, and a day after which no hard sport comes
    const score = s => {
      const i = DOW.indexOf(s.day)
      const prev = slots.find(x => x.day === DOW[(i + 6) % 7]), next = slots.find(x => x.day === DOW[(i + 1) % 7])
      return (prev && prev.kind && isLegs(prev.kind) ? 5 : 0) + (next && next.kind && isLegs(next.kind) ? 5 : 0) + (hardSportOn(DOW[(i + 1) % 7]) ? 2 : 0) + (sportOn(s.day).length ? 1 : 0)
    }
    const best = free.sort((x, y) => score(x) - score(y) || DOW.indexOf(x.day) - DOW.indexOf(y.day))[0]
    if (best) { best.kind = k; placed.add(best.day) } else rest.push(LEGS_FREE[k] || 'upperHyp')
  }
  if (legs.length && legDays.length < legs.length) why.push('Não há dias livres de esporte suficientes para todas as pernas: um treino de perna virou de superiores.')
  if (a.sportRules?.noLegs && sports.length) why.push('Nada de perna nos dias de ' + [...new Set(sports.map(sportName))].join(' e ') + ', como você pediu.')
  // the heavy strength upper day goes on the day with the least sport
  rest.sort((x, y) => (x === 'upperStr' ? -1 : 0) - (y === 'upperStr' ? -1 : 0))
  for (const k of rest) {
    const free = slots.filter(s => !s.kind)
    if (!free.length) break
    const pickDay = k === 'upperStr' ? free.sort((x, y) => (hardSportOn(x.day) - hardSportOn(y.day)) || (sportOn(x.day).length - sportOn(y.day).length))[0] : free[0]
    pickDay.kind = k
  }
  for (const s of slots) if (!s.kind) s.kind = 'upperHyp'

  // 4. the exercises
  const excluded = excludedBy(a)
  if ((a.pains || []).length) why.push('Exercícios que forçam ' + a.pains.map(p => PAIN_PT[p]).join(', ') + ' foram trocados por outros mais seguros.')
  if ((a.dislikes || []).length) why.push('Os exercícios que você não curte ficaram de fora.')
  const baseSets = EXP_SETS[a.experience] || 3
  const sportDaysNeedsUsed = new Set()
  const sessions = slots.map(({ day, kind }) => {
    const tpl = SESSIONS[kind]
    const onSport = sportOn(day).length > 0
    const minutes = num(onSport && a.shortOnSport ? a.sportDayMin || a.sessionMin : a.sessionMin) || 60
    let room = EXERCISES_FOR_MIN(minutes) - (onSport && a.shortOnSport ? 1 : 0)
    const want = [...tpl.slots]
    // the sport's needs and the person's priorities, on days without a sport (grip and neck tire the mat)
    if (!onSport) {
      const needs = [grappler && 'grappling', striker && 'striking', endurance && 'endurance'].filter(Boolean)
      for (const n of needs) for (const sl of SPORT_NEEDS[n].slots) if (!sportDaysNeedsUsed.has(sl[0])) { want.splice(Math.min(want.length, 4), 0, sl); sportDaysNeedsUsed.add(sl[0]); break }
      for (const need of a.sportNeeds || []) for (const sl of NEED_SLOTS[need] || []) if (!sportDaysNeedsUsed.has(sl[0])) { want.push(sl); sportDaysNeedsUsed.add(sl[0]); break }
    }
    for (const m of a.priorities || []) {
      if (!tpl.muscles.includes(m)) continue
      const own = (PRIORITY_SLOTS[m] || []).find(sl => want.some(w => w[0] === sl))
      if (own) { const i = want.findIndex(w => w[0] === own); if (i > 2) want.splice(2, 0, want.splice(i, 1)[0]) }
    }
    const taken = new Set()
    const exercises = []
    if (a.warmup !== false) { const w = pick('warmup', a, taken, excluded); if (w) { taken.add(w); exercises.push({ id: w, sets: 1, mode: 'time', sec: 60, role: 'warmup', rest: 0 }) } }
    for (const [slot, role] of want) {
      if (exercises.filter(e => e.role !== 'warmup' && e.role !== 'finisher').length >= room) break
      const id = pick(slot, a, taken, excluded)
      if (!id) continue
      taken.add(id)
      const d = doseFor(role, a, tpl.heavy)
      let sets = baseSets + (role === 'main' ? 1 : 0) - (role === 'core' || role === 'extra' ? 1 : 0)
      if (rec < 0.9 && role !== 'main') sets -= 1
      if ((a.priorities || []).some(m => tpl.muscles.includes(m) && PRIORITY_SLOTS[m]?.includes(slot))) sets += 1
      if (onSport && a.shortOnSport && role !== 'main') sets = Math.min(sets, 3)
      sets = Math.max(2, Math.min(5, sets))
      const ex = EXIDX[id]
      const timed = /plank|hold|hang|walk|carry/.test(ex?.n || '')
      exercises.push(timed ? { id, sets, mode: 'time', sec: /walk|carry/.test(ex?.n || '') ? 45 : 40, role, rest: Math.min(d.rest || 60, 90) } : { id, sets, reps: d.reps, repsMin: d.repsMin, rest: d.rest, rir: onSport ? Math.max(d.rir || 2, 2) : d.rir, role })
    }
    // 5. a cardio finisher when the goal asks for it and the sports do not give enough
    const sportMin = sports.reduce((n, s) => n + num(s.minutes) * (s.days || []).length, 0)
    const wantsCardio = goals.includes('fatloss') || goals.includes('conditioning') || a.cardioPref === 'yes'
    if (wantsCardio && sportMin < 150 && !onSport && a.cardioPref !== 'no') {
      const c = pick(a.dislikes?.includes('running') ? 'bike' : 'bike', a, taken, excluded) || pick('rope', a, taken, excluded)
      if (c) exercises.push({ id: c, sets: 1, mode: 'cardio', min: goals.includes('fatloss') ? 20 : 15, role: 'finisher' })
    }
    const ORDER = { warmup: 0, main: 1, comp: 2, acc: 3, extra: 4, core: 5, finisher: 6 }
    exercises.sort((x, y) => ORDER[x.role] - ORDER[y.role])
    return { day, kind, name: tpl.name, emoji: tpl.emoji, minutes, onSport, exercises }
  })
  if (sports.length) why.push((sports.every(s => ENDURANCE.has(s.id)) ? 'Os treinos de ' : 'As aulas de ') + [...new Set(sports.map(sportName))].join(', ') + ' entram na agenda e contam como cardio nas missões.')
  if (rec < 0.9) why.push('Sono, trabalho ou estresse pedem recuperação: menos séries nos acessórios.')
  if (a.shortOnSport && sports.length) why.push('Nos dias de esporte o treino é mais curto e para antes da falha, para você chegar inteiro na aula.')
  if (a.event?.kind && a.event.kind !== 'none' && a.event.date) why.push('Até ' + a.event.date + ' o plano segue em fases; perto da data, as semanas ficam mais leves.')

  const sportSessions = sports.flatMap(s => (s.days || []).map(day => ({ day, sport: s.id, name: sportName(s), minutes: num(s.minutes) || 60, intensity: s.intensity || 'mixed' })))
  return {
    title: planTitle(a, sports),
    sessions: sessions.sort((x, y) => DOW.indexOf(x.day) - DOW.indexOf(y.day)),
    sports: sportSessions.sort((x, y) => DOW.indexOf(x.day) - DOW.indexOf(y.day)),
    progression: progressionOf(a),
    recovery: rec,
    why,
  }
}

const PAIN_PT = { shoulder: 'ombro', elbow: 'cotovelo', wrist: 'punho', lowback: 'lombar', knee: 'joelho', hip: 'quadril', ankle: 'tornozelo', neck: 'pescoço' }
const GOAL_PT = { hypertrophy: 'Hipertrofia', strength: 'Força', fatloss: 'Emagrecimento', conditioning: 'Condicionamento', health: 'Saúde', sport: 'Performance' }
function planTitle(a, sports) {
  const g = [a.goal, a.goal2].filter(Boolean).map(x => GOAL_PT[x]).join(' + ')
  const s = [...new Set(sports.map(sportName))]
  return g + (s.length ? ' para ' + s.join(' e ') : '')
}
function progressionOf(a) {
  const goals = [a.goal, a.goal2].filter(Boolean)
  const beginner = a.experience === 'new' || a.experience === 'lt6m'
  const lines = []
  if (beginner) lines.push('Nas primeiras 2 semanas, foque na técnica com cargas leves; depois suba a carga sempre que fizer todas as séries no topo das repetições.')
  else lines.push('Dupla progressão: quando bater o número máximo de repetições em todas as séries, aumente a carga na próxima vez.')
  if (goals.includes('strength')) lines.push('Nos exercícios principais, suba 2,5 kg (superiores) ou 5 kg (pernas) por semana enquanto a técnica aguentar.')
  lines.push('A cada 5 ou 6 semanas, faça uma semana mais leve: metade das séries, mesma carga.')
  if (a.event?.kind && a.event.kind !== 'none') lines.push('Nas 2 semanas antes do evento, reduza o volume e mantenha a intensidade.')
  return lines
}

/* ---------- into the app ---------- */


const SPORT_EX_ID = s => 'carga-sport-' + (s.id === 'other' ? 'other-' + String(s.otherName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24) : s.id)
/** The activity a sport is logged as: a custom cardio exercise, so its minutes count as cardio. */
export function sportExercise(s) {
  return { id: SPORT_EX_ID(s), n: ('aula de ' + sportName(s)).toLowerCase(), custom: true, eq: 'body weight', tg: 'cardiovascular system', bp: 'cardio', desc: 'Aula ou treino de ' + sportName(s) + '. Registre os minutos: contam como cardio nas missões da CARGA.' }
}

/**
 * The plan as the app stores it: routines (one per session, one per sport), the custom sport
 * exercises, and the week (weekday → routine ids), ready for the store.
 */
export function toApp(plan, a) {
  const routines = []
  const week = {}
  // the weekday only tells two sessions of the same name apart (a six-day push, pull, legs twice)
  const twice = name => plan.sessions.filter(x => x.name === name).length > 1
  for (const s of plan.sessions) {
    const r = {
      id: uid(), name: (twice(s.name) ? DAY_NAMES[s.day].slice(0, 3) + ' · ' : '') + s.name, emoji: s.emoji,
      ex: s.exercises.map(e => ({
        id: e.id, sets: e.sets, weight: 0,
        ...(e.mode === 'time' ? { mode: 'time', sec: e.sec } : e.mode === 'cardio' ? { mode: 'cardio', min: e.min, speed: 8 } : { reps: e.reps, repsMin: e.repsMin, mode: 'reps' }),
        ...(e.rest ? { restSec: e.rest } : {}),
      })),
    }
    routines.push(r)
    week[s.day] = [r.id]
  }
  const customEx = []
  const bySport = new Map()
  for (const sp of a.sports || []) {
    if (!sp?.id) continue
    const ex = sportExercise(sp)
    customEx.push(ex)
    const r = { id: uid(), name: '🥋 ' + sportName(sp), emoji: 'figureRun', ex: [{ id: ex.id, sets: 1, mode: 'cardio', min: num(sp.minutes) || 60, speed: 0 }] }
    if (!GRAPPLING.has(sp.id) && !STRIKING.has(sp.id)) r.name = '🏃 ' + sportName(sp)
    routines.push(r)
    bySport.set(sp, r.id)
    for (const d of sp.days || []) week[d] = [...(week[d] || []), r.id]
  }
  return { routines, week, customEx }
}
