import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t, tn } from '../lib/i18n.js'
import { WorkoutRow, DayNoteRow, workoutDetailSheet, logPastWorkoutSheet } from '../sheets.jsx'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { dayNoteOf } from '../lib/day-notes.js'
import { reportSheet } from '../components/ReportSheet.jsx'
import { StatusBadge } from '../components/StatusReveal.jsx'
import { STATUS_DEFS } from '../lib/status-art.js'
import { runStatus, workoutStatus } from '../lib/activity-status.js'
import { sessionVolume } from '../lib/history.js'
import { SPORTS, hasGps, fmtClock, fmtKm, fmtPace, fmtSpeed, paceOf } from '../lib/run-track.js'
import { RouteThumb } from './Run.jsx'
import { isoOf } from '../lib/format.js'

// Newest first: every workout, and in between them the days off you left a note on (#261). A
// note on a day that has a workout too stays in the day sheet; the workout speaks for that day.
// CARGA: the runs, walks, rides and classes (S.runs) are in it too, each on its own row with its
// own time: a gym session in the morning and jiu-jitsu at night are two things, never one.
export function historyRows(S) {
  const runs = Array.isArray(S.runs) ? S.runs.filter(r => r && r.start) : []
  const trained = new Set([...(S.workouts || []).map(w => w?.d), ...runs.map(r => isoOf(new Date(r.start)))])
  const notes = Object.keys(S.dayNotes || {}).filter(d => !trained.has(d)).map(d => ({ d, note: dayNoteOf(S, d) })).filter(x => x.note)
  const rows = [...(S.workouts || []).map(w => ({ d: w.d, at: w.start || 0, w })), ...runs.map(r => ({ d: isoOf(new Date(r.start)), at: r.start, run: r })), ...notes]
  // Newest day first, then the later start; workouts with the same start keep their stored order.
  return rows.map((r, i) => [r, i]).sort((a, b) => (a[0].d < b[0].d ? 1 : a[0].d > b[0].d ? -1 : (b[0].at || 0) - (a[0].at || 0) || b[1] - a[1])).map(([r]) => r)
}

// The kinds the list can be narrowed to; a kind with nothing in it shows no chip.
const SPORT_KINDS = ['bjj', 'muaythai', 'boxing', 'football', 'swim', 'other', 'stretch', 'home']
const KINDS = [
  ['all', 'Tudo', () => true],
  ['gym', 'Academia', r => !!r.w],
  ['run', 'Corrida', r => r.run?.type === 'run'],
  ['walk', 'Caminhada', r => r.run?.type === 'walk'],
  ['ride', 'Pedal', r => r.run?.type === 'ride'],
  ['sport', 'Esportes e aulas', r => SPORT_KINDS.includes(r.run?.type)],
]
const hhmm = ms => (ms ? new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '')

/** A run, walk, ride or class as History lists it: what, when (with the time), how much, its status. */
function ActivityRow({ run, S }) {
  const nav = useNavigate()
  const status = runStatus(S.runs, run)
  const gps = hasGps(run.type)
  const when = new Date(run.start).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + hhmm(run.start)
  const open = () => nav('/corrida/' + run.id)
  return <div className="item hist-run" role="button" tabIndex={0} onClick={open} onKeyDown={e => { if (e.key === 'Enter') open() }}>
    {gps && run.points?.length ? <span className="hist-thumb"><RouteThumb run={run} size={34} /></span>
      : <span className="lrow-i" style={{ width: 34, height: 34, borderRadius: 8, fontSize: 19 }}><Icon name={SPORTS[run.type]?.icon || 'stopwatch'} /></span>}
    <div className="grow"><div className="tt">{run.name || SPORTS[run.type]?.name}</div>
      <div className="ss">{[when, gps ? fmtKm(run.distM) + ' km' : null, fmtClock(run.movingSec * 1000), gps ? (run.type === 'ride' ? fmtSpeed(run.distM, run.movingSec) + ' km/h' : fmtPace(paceOf(run.movingSec, run.distM)) + ' /km') : (run.kcal ? run.kcal + ' kcal' : null)].filter(Boolean).join(' · ')}</div></div>
    {status && <span className="hist-st"><StatusBadge status={status} /></span>}
    <Icon name="chevronRight" className="chev" />
  </div>
}

// The list grows as it is scrolled: the first PAGE rows, then PAGE more whenever its end comes
// within a screen or so. A 400-workout history rendered every row (some 1500 components) on each
// open. How far it had grown is kept for the session, so coming back (the back button, the edge
// swipe) renders the same rows and the page lands where it was scrolled to.
export const HISTORY_PAGE = 60
let grownTo = HISTORY_PAGE

export default function History() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const [kind, setKind] = useState('all')
  const all = historyRows(S)
  const kinds = KINDS.filter(([k, , f]) => k === 'all' || all.some(f))
  const pick = (KINDS.find(([k]) => k === kind) || KINDS[0])[2]
  const rows = kind === 'all' ? all : all.filter(pick)
  const acts = all.filter(r => r.w || r.run).length
  const [shown, setShown] = useState(() => Math.max(HISTORY_PAGE, grownTo))
  const end = useRef(null)
  const more = rows.length > shown
  useEffect(() => { grownTo = Math.max(grownTo, shown) }, [shown])
  useEffect(() => {
    if (!more) return
    const IO = typeof window !== 'undefined' ? window.IntersectionObserver : undefined
    // Without an observer (an old engine) the list is simply whole, as before.
    if (typeof IO !== 'function') { setShown(Infinity); return }
    const io = new IO(es => { if (es.some(e => e.isIntersecting)) setShown(n => n + HISTORY_PAGE) }, { rootMargin: '0px 0px 1200px 0px' })
    if (end.current) io.observe(end.current)
    return () => io.disconnect()
  }, [more, shown])
  return <>
    <div className="hdr"><button className="iconbtn" data-back="/stats" data-tour="history-back" onClick={() => nav('/stats')} aria-label={t('Stats')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginInlineStart: 12 }}><h1>{t('History')}</h1><div className="sub">{acts === 1 ? '1 atividade' : acts + ' atividades'}</div></div>
      {S.workouts.length > 0 && <button className="iconbtn" onClick={reportSheet} aria-label={t('Performance report')} title={t('Performance report')}><Icon name="note" /></button>}</div>
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: '<defs>' + STATUS_DEFS + '</defs>' }} />
    {kinds.length > 2 && <div className="hist-kinds" role="tablist" aria-label="Tipo de atividade">{kinds.map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={kind === k} className={'chip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{label}</button>)}</div>}
    {all.length > 0 && <Button icon="plus" data-tour="history-add" onClick={logPastWorkoutSheet} style={{ marginBottom: 12 }}>{t('Log a past workout')}</Button>}
    {rows.length ? <><div className="list">{(more ? rows.slice(0, shown) : rows).map((r, i) => r.w
      ? <WorkoutRow key={r.w.id} w={r.w} tour={i === 0 ? 'history-row' : undefined} onClick={() => workoutDetailSheet(r.w)}
          status={workoutStatus(S.workouts, r.w, x => sessionVolume(x, S), Array.isArray(r.w.prs) ? r.w.prs : [])} time={hhmm(r.w.start)} />
      : r.run ? <ActivityRow key={'run-' + r.run.id} run={r.run} S={S} />
      : <DayNoteRow key={'note-' + r.d} iso={r.d} note={r.note} />)}</div>
      {more && <div ref={end} aria-hidden="true" style={{ height: 1 }} />}</>
      : <EmptyState icon="history" text={t('No workouts yet. Your first one will land here.')}>
        <Button variant="tinted" icon="plus" data-tour="history-add" onClick={logPastWorkoutSheet}>{t('Log a past workout')}</Button>
      </EmptyState>}
  </>
}
