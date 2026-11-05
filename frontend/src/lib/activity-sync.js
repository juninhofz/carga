// CARGA: a short summary of each activity goes up to the cloud (the `activities` table), so the people
// who share a challenge with you can see, on your profile, what you have been doing day by day: what
// it was, when, how long, how far and its status. The workout itself (exercises, sets, weights) stays
// on the phone. Runs only when signed in; the last list sent is remembered, so nothing is sent twice.
// A saved activity is kept for good: the database ignores changes to it and refuses to delete it.
import { cloud, currentUser } from './cloud.js'
import { runStatus, workoutStatus } from './activity-status.js'
import { sessionVolume } from './history.js'
import { SPORTS, hasGps } from './run-track.js'

const SENT = 'carga.acts.sent'
const KEEP = 300
const KINDS = ['run', 'walk', 'ride']

/** The summaries of the newest activities in S, newest first. */
export function activityRows(S) {
  const workouts = Array.isArray(S?.workouts) ? S.workouts : []
  const runs = Array.isArray(S?.runs) ? S.runs : []
  const gym = workouts.filter(w => w && w.id && w.start).map(w => ({
    id: 'w-' + w.id, kind: 'gym', title: String(w.name || 'Treino').slice(0, 80), start: new Date(w.start).toISOString(),
    minutes: w.end > w.start ? Math.min(1440, Math.round((w.end - w.start) / 60000)) : null, km: null,
    status: workoutStatus(workouts, w, x => sessionVolume(x, S), Array.isArray(w.prs) ? w.prs : [])?.id || null,
  }))
  const acts = runs.filter(r => r && r.id && r.start).map(r => ({
    id: 'r-' + r.id, kind: KINDS.includes(r.type) ? r.type : 'sport', title: String(r.name || SPORTS[r.type]?.name || 'Atividade').slice(0, 80),
    start: new Date(r.start).toISOString(), minutes: r.movingSec ? Math.min(1440, Math.round(r.movingSec / 60)) : null,
    km: hasGps(r.type) && r.distM > 0 ? Math.min(999, Math.round(r.distM / 10) / 100) : null,
    status: runStatus(runs, r)?.id || null,
  }))
  return [...gym, ...acts].sort((a, b) => (a.start < b.start ? 1 : -1)).slice(0, KEEP)
}

let busy = false
/** Sends what changed since the last time; quietly does nothing offline or signed out. */
export async function syncActivities(S) {
  if (busy) return
  busy = true
  try {
    if (!(await currentUser())) return
    const rows = activityRows(S)
    const sig = JSON.stringify(rows)
    let last = null
    try { last = localStorage.getItem(SENT) } catch { /* private mode */ }
    if (last === sig) return
    if (rows.length) {
      const { error } = await cloud().from('activities').upsert(rows, { onConflict: 'user_id,id' })
      if (error) return
    }
    // nothing is ever taken back: a saved activity stays in the history (the database keeps it too)
    try { localStorage.setItem(SENT, sig) } catch { /* private mode */ }
  } catch { /* offline: next time */ } finally { busy = false }
}

/** Someone's activities as their profile shows them (only for people who share a challenge with me). */
export async function activitiesOf(uid) {
  const { data, error } = await cloud().from('activities').select('id, kind, title, start, minutes, km, status').eq('user_id', uid).order('start', { ascending: false }).limit(KEEP)
  if (error) throw new Error(error.message)
  return data || []
}

// A daily hello from this phone (app_pings): a random code made here, nothing personal, and whether it
// is signed in. Lets the owner's panel count the people using CARGA with and without an account.
const DEVICE = 'carga.device'
const PINGED = 'carga.pinged'
export async function pingToday(signed) {
  try {
    let id = localStorage.getItem(DEVICE)
    if (!id) { id = (crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now()).replace(/-/g, ''); localStorage.setItem(DEVICE, id) }
    const key = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }) + (signed ? ':s' : ':g')
    if (localStorage.getItem(PINGED) === key) return
    const { error } = await cloud().rpc('ping', { p_device: id, p_signed: !!signed })
    if (!error) localStorage.setItem(PINGED, key)
  } catch { /* offline or private mode: tomorrow */ }
}
