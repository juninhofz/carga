// CARGA runs: the live recorder. One GPS watch for the whole app (it keeps running while the person
// looks at another tab of the app), the track in progress (lib/run-track.js), a copy of it in
// localStorage every few seconds so a reload or a killed tab does not lose the run, and the voice
// that reads each km out loud.
//
// A web page only gets GPS while it is on screen: with the screen locked the browser stops the
// fixes, and the gap is bridged by a straight line when they come back (run-track counts it by
// distance). The screen is kept on while recording (App.jsx useWakeLock) for that reason.
import { create } from 'zustand'
import { useStore } from '../store/useStore.js'
import { addFix, startTrack, pauseTrack, resumeTrack, finishTrack, fmtPace, GOOD_ACC } from './run-track.js'

const LIVE = 'carga.run.live'
const PREFS = 'carga.run.prefs'
const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } }
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode, full */ } }

export const useRun = create(() => ({
  track: read(LIVE),
  fix: null,          // the last raw fix { lat, lng, acc, t }
  gps: 'off',         // off | searching | ok | weak | denied | unsupported
  prefs: { type: 'run', voice: true, ...(read(PREFS) || {}) },
}))

let watchId = null
let savedAt = 0

function onFix(pos) {
  const c = pos.coords
  const fix = { lat: c.latitude, lng: c.longitude, acc: c.accuracy, alt: c.altitude ?? undefined, t: pos.timestamp || Date.now() }
  const st = useRun.getState()
  const gps = fix.acc <= GOOD_ACC ? 'ok' : 'weak'
  if (!st.track || st.track.status !== 'running') { useRun.setState({ fix, gps }); return }
  const before = st.track.splits.length
  const { track } = addFix(st.track, fix)
  useRun.setState({ fix, gps, track })
  if (track.splits.length > before) announce(track)
  if (Date.now() - savedAt > 5000) { savedAt = Date.now(); write(LIVE, track) }
}

function onError(err) {
  useRun.setState({ gps: err && err.code === 1 ? 'denied' : 'searching' })
}

/** Start listening to the GPS (opening the run screen warms it up before the start). */
export function watchGps() {
  if (watchId != null) return
  if (!('geolocation' in navigator)) { useRun.setState({ gps: 'unsupported' }); return }
  if (useRun.getState().gps === 'off') useRun.setState({ gps: 'searching' })
  watchId = navigator.geolocation.watchPosition(onFix, onError, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 })
}
/** Stop listening, unless a run is being recorded. */
export function releaseGps() {
  const t = useRun.getState().track
  if (t) return
  if (watchId != null) navigator.geolocation.clearWatch(watchId)
  watchId = null
  useRun.setState({ gps: 'off' })
}

export function setPrefs(patch) {
  const prefs = { ...useRun.getState().prefs, ...patch }
  write(PREFS, prefs)
  useRun.setState({ prefs })
}

export function startRun(type) {
  const track = startTrack(type || useRun.getState().prefs.type)
  write(LIVE, track)
  useRun.setState({ track })
  watchGps()
  // the fix that is already there starts the line, if it is fresh
  const f = useRun.getState().fix
  if (f && Date.now() - f.t < 5000) useRun.setState({ track: addFix(track, { ...f, t: track.startedAt }).track })
  say('Atividade iniciada')
}
export function pauseRun() {
  const track = pauseTrack(useRun.getState().track)
  write(LIVE, track)
  useRun.setState({ track })
  say('Pausado')
}
export function resumeRun() {
  const track = resumeTrack(useRun.getState().track)
  write(LIVE, track)
  useRun.setState({ track })
  watchGps()
  say('Retomando')
}
/** Saves the run in S.runs and returns its id (null if it was too short to keep). */
export function finishRun() {
  const st = useRun.getState()
  if (!st.track) return null
  const S = useStore.getState().S
  const bw = Array.isArray(S.bodyweight) && S.bodyweight.length ? Number(S.bodyweight[S.bodyweight.length - 1].w) : 0
  const kg = bw > 0 ? (S.unit === 'lb' ? bw * 0.4536 : bw) : 70
  const run = finishTrack(st.track, { kg })
  write(LIVE, null)
  useRun.setState({ track: null })
  releaseGps()
  if (run.distM < 10 && run.movingSec < 10) return null
  useStore.getState().update(s => { s.runs = [run, ...(Array.isArray(s.runs) ? s.runs : []).filter(r => r.id !== run.id)] })
  return run.id
}
export function discardRun() {
  write(LIVE, null)
  useRun.setState({ track: null })
  releaseGps()
}

/* ---------- the voice ---------- */

function say(text) {
  if (!useRun.getState().prefs.voice) return
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'pt-BR'
    u.rate = 1.05
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  } catch { /* no voice on this device */ }
}
const spokenTime = sec => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60)
  return [h && h + (h > 1 ? ' horas' : ' hora'), m && m + (m > 1 ? ' minutos' : ' minuto'), s && s + ' segundos'].filter(Boolean).join(' e ') || 'zero segundos'
}
function announce(track) {
  const km = track.splits.length
  const last = track.splits[km - 1]
  const total = track.splits.reduce((a, b) => a + b, 0)
  const [m, s] = fmtPace(last).split(':')
  say(`${km} ${km > 1 ? 'quilômetros' : 'quilômetro'}. Tempo, ${spokenTime(total)}. Último quilômetro em ${Number(m)} minutos e ${Number(s)} segundos.`)
}
