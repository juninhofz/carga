// CARGA: the status of a finished activity, held against the person's own history. Five levels,
// lightest to a record: Pena (well under the usual), Firme (the usual), Pesado (over it), Brutal
// (far over it) and Carga Máxima (a personal record). The reveal and the share cards read it
// (components/StatusReveal.jsx, lib/share-card.js).
//   run, walk, ride  the pace against similar distances before it; a best 1 km / 5 km / 10 km is a record
//   gym workout      the volume against the earlier sessions of the same exercises; a PR is a record
//   sport or class   the duration against the earlier ones of the same sport; the longest ever is a record
import { SPORTS, hasGps, bestEfforts, fmtPace, paceOf, fmtClock } from './run-track.js'

export const LEVELS = [
  { id: 'pena', name: 'Pena', color: '#93c5fd' },
  { id: 'firme', name: 'Firme', color: '#34d399' },
  { id: 'pesado', name: 'Pesado', color: '#ff8a3d' },
  { id: 'brutal', name: 'Brutal', color: '#f87171' },
  { id: 'max', name: 'Carga Máxima', color: '#ffd166' },
]

const avg = xs => xs.reduce((a, b) => a + b, 0) / xs.length
const status = (level, reason) => ({ level, ...LEVELS[level], reason })
/** Light, usual, over, far over: from how much more than usual (1 = the usual). */
const byRatio = (r, steps) => (r < steps[0] ? 0 : r < steps[1] ? 1 : r < steps[2] ? 2 : 3)

/** The status of a run, walk, ride or class from S.runs (`runs` may include `run` itself). */
export function runStatus(runs, run) {
  const before = (Array.isArray(runs) ? runs : []).filter(r => r && r.id !== run.id && r.type === run.type && r.start < run.start)
  const name = SPORTS[run.type]?.name || 'Atividade'
  if (!hasGps(run.type)) {
    const durs = before.map(r => r.movingSec).filter(s => s > 0)
    if (!durs.length) return status(1, `Primeira aula de ${name} registrada. As próximas vão ser comparadas com esta.`)
    if (durs.length >= 3 && run.movingSec > Math.max(...durs) * 1.05) return status(4, `A sessão de ${name} mais longa que você já fez: ${fmtClock(run.movingSec * 1000)}.`)
    const usual = avg(durs.slice(0, 8))
    const lvl = byRatio(run.movingSec / usual, [0.75, 1.15, 1.5])
    return status(lvl, `${fmtClock(run.movingSec * 1000)} de ${name}. O seu normal é ${fmtClock(usual * 1000)}.`)
  }
  if (run.distM < 200 || run.movingSec < 60) return status(0, 'Atividade curta demais para comparar.')
  // a record over a classic distance
  if (run.type !== 'ride' && before.length) {
    const mine = bestEfforts(run)
    for (const m of [10000, 5000, 1000]) {
      if (!mine[m]) continue
      const past = before.map(r => bestEfforts(r)[m]).filter(Boolean)
      if (past.length && mine[m] < Math.min(...past)) return status(4, `Recorde pessoal: ${m / 1000} km em ${fmtClock(mine[m] * 1000)}.`)
    }
  }
  const similar = before.filter(r => r.distM > 0 && r.movingSec > 0 && r.distM >= run.distM * 0.6 && r.distM <= run.distM * 1.6).slice(0, 8)
  const pace = paceOf(run.movingSec, run.distM)
  if (!similar.length) return status(1, `${(run.distM / 1000).toFixed(1).replace('.', ',')} km. Ainda não há atividades parecidas para comparar.`)
  const usual = avg(similar.map(r => paceOf(r.movingSec, r.distM)))
  // faster than usual = heavier; a pace 3% quicker is already over the usual
  let lvl = byRatio(usual / pace, [0.91, 1.03, 1.08])
  // much longer than usual at about the usual pace counts too
  if (lvl < 3 && run.distM > avg(similar.map(r => r.distM)) * 1.5 && usual / pace > 0.95) lvl++
  const what = run.type === 'ride' ? `${((run.distM / run.movingSec) * 3.6).toFixed(1).replace('.', ',')} km/h` : `pace ${fmtPace(pace)}`
  const norm = run.type === 'ride' ? `${((1000 / usual) * 3.6).toFixed(1).replace('.', ',')} km/h` : fmtPace(usual)
  return status(lvl, `${what}. O seu normal em distâncias parecidas é ${norm}.`)
}

/**
 * The status of a gym workout `w`, from the workouts before it. `volumeOf(w)` gives a session's
 * volume (history.js sessionVolume), `prs` the exercise ids it set records on.
 */
export function workoutStatus(workouts, w, volumeOf, prs = []) {
  if (prs.length) return status(4, prs.length > 1 ? `${prs.length} recordes pessoais neste treino.` : 'Recorde pessoal neste treino.')
  const ids = new Set((w.entries || []).map(e => e?.id).filter(Boolean))
  const before = (Array.isArray(workouts) ? workouts : []).filter(x => x && x !== w && x.id !== w.id && (x.start || 0) < (w.start || Infinity))
  const share = x => { const xs = (x.entries || []).map(e => e?.id).filter(Boolean); return xs.length ? xs.filter(id => ids.has(id)).length / Math.max(xs.length, ids.size) : 0 }
  let same = before.filter(x => share(x) >= 0.5).slice(-6)
  if (!same.length) same = before.slice(-6)
  const vols = same.map(volumeOf).filter(v => v > 0)
  const vol = volumeOf(w)
  if (!vols.length || !(vol > 0)) return status(1, 'Treino registrado. Os próximos vão ser comparados com este.')
  const usual = avg(vols)
  const lvl = byRatio(vol / usual, [0.8, 1.05, 1.2])
  const t = n => (n >= 1000 ? (n / 1000).toFixed(1).replace('.', ',') + ' t' : Math.round(n) + ' kg')
  return status(lvl, `Volume de ${t(vol)}. O seu normal nesse treino é ${t(usual)}.`)
}
