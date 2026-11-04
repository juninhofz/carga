// CARGA group challenges (GymRats-style), on the account's cloud (lib/cloud.js). A challenge has
// members, who post check-ins: an activity done in the app (a workout, a run, a class), with a
// photo, a caption and its numbers. The leaderboard is worked out here from the check-ins, by the
// challenge's scoring. Reactions, comments and a chat sit around them. The database lets only the
// members of a challenge see anything of it (the tables and functions are in the Supabase project).
import { cloud, currentUser } from './cloud.js'
import { isWarmupRow } from './workout-model.js'
import { SPORTS, hasGps, pointsOf, encodeRows, fmtPace, paceOf } from './run-track.js'

export const COVERS = [
  ['#ff7a1a', '#ff3d00'], ['#2563eb', '#0ea5e9'], ['#16a34a', '#065f46'], ['#a855f7', '#6d28d9'], ['#ef4444', '#7f1d1d'],
  ['#f59e0b', '#b45309'], ['#14b8a6', '#0f766e'], ['#ec4899', '#9d174d'], ['#64748b', '#1e293b'], ['#111827', '#000000'],
]
export const coverCss = i => { const [a, b] = COVERS[i] || COVERS[0]; return `linear-gradient(135deg,${a},${b})` }

export const SCORING = {
  days: { name: 'Dias ativos', help: '1 ponto por dia com treino. O mais justo.', unit: n => (n === 1 ? 'dia' : 'dias') },
  workouts: { name: 'Treinos', help: 'Cada treino, corrida ou aula vale 1.', unit: n => (n === 1 ? 'treino' : 'treinos') },
  minutes: { name: 'Minutos', help: 'O tempo de atividade somado.', unit: () => 'min' },
  km: { name: 'Quilômetros', help: 'Só corrida, caminhada e pedal.', unit: () => 'km' },
  carga: { name: 'Pontos CARGA', help: 'Pelo status: Pena 1, Firme 2, Pesado 3, Brutal 4, Carga Máxima 5.', unit: () => 'pts' },
  race: { name: 'Menor tempo', help: 'Vence quem fizer a distância mais rápido.', unit: () => '' },
  lifts: { name: 'Duelo de carga', help: 'Escolha os exercícios: quem levantar mais peso em cada um leva os pontos dele.', unit: () => 'pts' },
}
// the exercises a lifting duel offers first (Brazilian gym names, lib/exercise-names)
export const DUEL_LIFTS = ['0025', '0047', '0289', '0314', '0043', '0032', '0739', '1162', '2330', '0027', '0861', '0031', '0085', '0241']

/** The heaviest set of each exercise in a workout, in kg: { [exercise id]: kg }. */
export function liftsOf(w, unit = 'kg') {
  const k = unit === 'lb' ? 0.45359237 : 1
  const out = {}
  for (const e of Array.isArray(w?.entries) ? w.entries : []) {
    if (typeof e?.id !== 'string') continue
    const top = Math.max(0, ...(Array.isArray(e.sets) ? e.sets : []).filter(s => s && s.done && !isWarmupRow(s) && Number(s.r) > 0).map(s => Number(s.w) || 0))
    if (top > 0) out[e.id] = Math.max(out[e.id] || 0, Math.round(top * k * 10) / 10)
  }
  return out
}

/** A lifting duel, exercise by exercise: [{ id, name, pts, rows: [{ user_id, kg }] heaviest first }]. */
export function liftBoards(challenge, members, checkins) {
  const lifts = Array.isArray(challenge?.rules?.lifts) ? challenge.rules.lifts : []
  const ids = new Set(members.map(m => m.user_id))
  const inRange = c => c.day >= challenge.starts && c.day <= challenge.ends && c.verified !== false && ids.has(c.user_id)
  return lifts.map(l => {
    const best = new Map()
    for (const c of checkins) {
      if (!inRange(c)) continue
      const kg = Number(c?.stats?.lifts?.[l.id]) || 0
      if (kg > (best.get(c.user_id) || 0)) best.set(c.user_id, kg)
    }
    const rows = [...best.entries()].map(([user_id, kg]) => ({ user_id, kg })).sort((a, b) => b.kg - a.kg)
    return { id: l.id, name: l.name, pts: Number(l.pts) || 1, rows }
  })
}
/** A check-in's time in seconds (a run keeps its exact moving time; otherwise its minutes). */
export const checkinSeconds = c => Number(c?.stats?.sec) > 0 ? Number(c.stats.sec) : (Number(c?.minutes) || 0) * 60
const STATUS_PTS = { pena: 1, firme: 2, pesado: 3, brutal: 4, max: 5 }
export const REACTIONS = [['fire', 'Fogo'], ['strong', 'Força'], ['clap', 'Palmas']]

// A check-in posted with only a photo (no activity recorded in the app: `verified` false) counts
// half: there is no proof, and the app's own record is what the challenges want to encourage.
export const UNVERIFIED = 0.5
const weightOf = c => (c.verified === false ? UNVERIFIED : 1)

/** What a check-in scores in a challenge of `scoring`. */
export function checkinScore(c, scoring) {
  const w = weightOf(c)
  if (scoring === 'minutes') return Math.max(0, c.minutes || 0) * w
  if (scoring === 'km') return ['run', 'walk', 'ride'].includes(c.kind) ? (Number(c.km) || 0) * w : 0
  // a photo-only check-in has no status: half of Firme
  if (scoring === 'carga') return c.verified === false ? STATUS_PTS.firme * w : STATUS_PTS[c.status] || 1
  return w
}

/**
 * The leaderboard: every member with their score, check-ins and last one, best first. `days`
 * counts each member's distinct days. Ties keep whoever got there first ahead.
 */
export function leaderboard(challenge, members, checkins) {
  const rows = new Map(members.map(m => [m.user_id, { user_id: m.user_id, name: m.name || 'Sem nome', team: m.team, score: 0, count: 0, last: null, reachedAt: 0, days: new Map() }]))
  const inRange = c => c.day >= challenge.starts && c.day <= challenge.ends
  const sorted = [...checkins].filter(inRange).sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
  for (const c of sorted) {
    const r = rows.get(c.user_id)
    if (!r) continue
    r.count++
    r.last = !r.last || c.created_at > r.last ? c.created_at : r.last
    // a day counts once, as much as its best check-in: 1 from the app, ½ from a photo alone
    if (challenge.scoring === 'days') { const was = r.days.get(c.day) || 0, w = weightOf(c); if (w > was) { r.days.set(c.day, w); r.score += w - was; r.reachedAt = Date.parse(c.created_at) } }
    else { const s = checkinScore(c, challenge.scoring); if (s > 0) { r.score += s; r.reachedAt = Date.parse(c.created_at) } }
  }
  if (challenge.scoring === 'race') return raceBoard(challenge, rows, sorted)
  if (challenge.scoring === 'lifts') {
    // each exercise's points to whoever lifted the most in it (a tie shares them whole)
    for (const r of rows.values()) { r.score = 0; r.count = 0; r.last = null }
    for (const c of sorted) { const r = rows.get(c.user_id); if (r) { r.count++; r.last = !r.last || c.created_at > r.last ? c.created_at : r.last } }
    for (const b of liftBoards(challenge, members, checkins)) {
      const top = b.rows[0]?.kg || 0
      if (!top) continue
      for (const x of b.rows) if (x.kg === top) { const r = rows.get(x.user_id); r.score += b.pts; r.reachedAt = r.reachedAt || 1 }
    }
  }
  const list = [...rows.values()].map(r => ({ ...r, score: Math.round(r.score * 100) / 100, days: r.days.size }))
  list.sort((a, b) => b.score - a.score || (a.reachedAt || Infinity) - (b.reachedAt || Infinity) || a.name.localeCompare(b.name))
  let place = 0, prev = null
  list.forEach((r, i) => { if (r.score !== prev) { place = i + 1; prev = r.score } r.place = place })
  return list
}

// A race: each person's best time over the event's distance (a run or walk at least 95% of it);
// the fastest first, those with no time yet after them. `score` is the time in seconds.
function raceBoard(challenge, rows, sorted) {
  const need = Number(challenge.target_km) > 0 ? Number(challenge.target_km) * 0.95 : 0
  for (const r of rows.values()) { r.score = 0; r.count = 0; r.last = null }
  for (const c of sorted) {
    const r = rows.get(c.user_id)
    if (!r) continue
    r.count++
    r.last = !r.last || c.created_at > r.last ? c.created_at : r.last
    if (!['run', 'walk'].includes(c.kind) || (need && !(Number(c.km) >= need))) continue
    const sec = checkinSeconds(c)
    if (sec > 0 && (!r.score || sec < r.score)) r.score = sec
  }
  const list = [...rows.values()].map(r => ({ ...r, days: 0 }))
  list.sort((a, b) => (a.score ? 0 : 1) - (b.score ? 0 : 1) || a.score - b.score || a.name.localeCompare(b.name))
  list.forEach((r, i) => { r.place = r.score ? i + 1 : list.length })
  return list
}

/** Two teams' totals, for a team challenge. */
export function teamScores(rows) {
  const t = [0, 0]
  for (const r of rows) if (r.team === 0 || r.team === 1) t[r.team] += r.score
  return t
}

/** Days into the challenge, days in all and days left, on `today` (yyyy-mm-dd). */
export function progressOf(ch, today) {
  const d = iso => Math.round(Date.parse(iso + 'T12:00:00Z') / 86400000)
  const total = d(ch.ends) - d(ch.starts) + 1
  const day = Math.min(total, Math.max(0, d(today) - d(ch.starts) + 1))
  return { total, day, left: Math.max(0, d(ch.ends) - d(today)), started: today >= ch.starts, over: today > ch.ends }
}

/* ---------- what an activity posts ---------- */

const localDay = ms => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }

/** A run, walk, ride or class (S.runs) as a check-in. */
export function runActivity(run, status) {
  const gps = hasGps(run.type)
  const stats = {}
  if (gps) {
    stats.pace = run.type === 'ride' ? null : fmtPace(paceOf(run.movingSec, run.distM))
    stats.gain = run.gainM || 0
    // the route, thinned to at most 120 points, for the feed's little map
    const pts = pointsOf(run)
    const step = Math.max(1, Math.ceil(pts.length / 120))
    const thin = pts.filter((_, i) => i % step === 0 || i === pts.length - 1)
    if (thin.length > 1) stats.route = encodeRows(thin.map(p => [Math.round(p.lat * 1e5), Math.round(p.lng * 1e5)]))
  }
  stats.kcal = run.kcal
  stats.sec = run.movingSec
  return {
    activity_id: run.id, day: localDay(run.start), kind: gps ? run.type : 'sport', title: run.name || SPORTS[run.type]?.name || 'Atividade',
    minutes: Math.round(run.movingSec / 60), km: gps ? Math.round(run.distM / 10) / 100 : 0, status: status?.id || null, stats,
  }
}

/** A check-in with only a photo: what was done, as the person says it. Counts half. */
export function manualActivity({ title, kind = 'other', minutes = 0, km = 0, time = '' }) {
  // a race's time typed as 42:15 or 1:02:30
  const parts = String(time || '').trim().split(':').map(Number)
  const sec = parts.length > 1 && parts.every(Number.isFinite) ? parts.reduce((t, x) => t * 60 + x, 0) : 0
  const now = Date.now()
  return { activity_id: 'foto-' + now.toString(36), day: localDay(now), kind, title: String(title || '').trim().slice(0, 80) || 'Treino',
    minutes: sec ? Math.round(sec / 60) : Math.max(0, Math.min(1440, Math.round(Number(minutes) || 0))), km: ['run', 'walk', 'ride'].includes(kind) ? Math.max(0, Math.min(1000, Number(km) || 0)) : 0,
    status: null, stats: sec ? { sec } : {}, verified: false }
}

/** A gym workout as a check-in. */
export function workoutActivity(w, status, { volume = 0, sets = 0, lifts = {} } = {}) {
  return {
    activity_id: 'w' + (w.id ?? w.start), day: w.d || localDay(w.start), kind: 'gym', title: w.name || 'Treino',
    minutes: Math.max(1, Math.round(((w.end || 0) - (w.start || 0)) / 60000)), km: 0, status: status?.id || null,
    stats: { volume: Math.round(volume), sets, ...(Object.keys(lifts).length ? { lifts } : {}) },
  }
}

/* ---------- the cloud ---------- */

const db = () => cloud()
const me = async () => (await currentUser())?.id || null
const fail = error => { throw new Error(error?.message || 'Não foi possível falar com o servidor.') }

/** The challenges I am in, newest first: [{ ...challenge, team, members }]. */
export async function myChallenges() {
  const uid = await me()
  if (!uid) return []
  const { data, error } = await db().from('challenge_members').select('team, challenges(*)').eq('user_id', uid)
  if (error) fail(error)
  const list = (data || []).map(r => ({ ...r.challenges, team: r.team })).filter(c => c.id)
  if (!list.length) return []
  const { data: mem } = await db().from('challenge_members').select('challenge_id, user_id, name').in('challenge_id', list.map(c => c.id))
  const people = await peopleOf((mem || []).map(m => m.user_id))
  return list.map(c => ({ ...c, people, members: (mem || []).filter(m => m.challenge_id === c.id) })).sort((a, b) => (a.ends < b.ends ? 1 : -1))
}

// always all ten arguments: the database also keeps an older 8-argument version of this function
export async function createChallenge({ name, cover, starts, ends, scoring, photo, teams, memberName, targetKm = null, event = false, rules = null }) {
  const { data, error } = await db().rpc('create_challenge', { p_name: name, p_cover: cover, p_starts: starts, p_ends: ends, p_scoring: scoring, p_photo: photo, p_teams: teams, p_member_name: memberName, p_target_km: targetKm, p_event: event })
  if (error) fail(error)
  // a lifting duel's exercises and points
  if (rules) { const r = await db().from('challenges').update({ rules }).eq('id', data); if (r.error) fail(r.error) }
  return data
}

export async function joinChallenge(code, memberName) {
  const { data, error } = await db().rpc('join_challenge', { p_code: code, p_member_name: memberName })
  if (error) fail(error)
  return data
}

export async function leaveChallenge(id) {
  const uid = await me()
  const { error } = await db().from('challenge_members').delete().eq('challenge_id', id).eq('user_id', uid)
  if (error) fail(error)
}
export async function deleteChallenge(id) {
  const { error } = await db().from('challenges').delete().eq('id', id)
  if (error) fail(error)
}

/** The profiles of these people that I may see (mine and my challenge mates'): { [id]: { name, rank, avatar } }. */
export async function peopleOf(ids) {
  const uniq = [...new Set(ids.filter(Boolean))]
  if (!uniq.length) return {}
  const { data } = await db().from('profiles').select('id, name, rank, level, carga, avatar').in('id', uniq)
  return Object.fromEntries((data || []).map(p => [p.id, p]))
}

/** Everything a challenge's page shows: { challenge, members, checkins (with photo urls), reactions, comments }. */
export async function loadChallenge(id) {
  const [c, m, k] = await Promise.all([
    db().from('challenges').select('*').eq('id', id).maybeSingle(),
    db().from('challenge_members').select('user_id, name, team, joined_at').eq('challenge_id', id),
    db().from('checkins').select('*').eq('challenge_id', id).order('created_at', { ascending: false }).limit(500),
  ])
  if (c.error || m.error || k.error) fail(c.error || m.error || k.error)
  if (!c.data) return null
  const checkins = k.data || []
  const ids = checkins.map(x => x.id)
  let reactions = [], comments = []
  if (ids.length) {
    const recent = ids.slice(0, 200)
    const [r, cm] = await Promise.all([
      db().from('checkin_reactions').select('checkin_id, user_id, kind').in('checkin_id', recent),
      db().from('checkin_comments').select('id, checkin_id, user_id, body, created_at').in('checkin_id', recent).order('created_at'),
    ])
    reactions = r.data || []
    comments = cm.data || []
  }
  const paths = checkins.filter(x => x.photo_path).slice(0, 60).map(x => x.photo_path)
  const urls = {}
  if (paths.length) {
    const { data } = await db().storage.from('checkins').createSignedUrls(paths, 3600)
    for (const u of data || []) if (u.signedUrl) urls[u.path] = u.signedUrl
  }
  const people = await peopleOf((m.data || []).map(x => x.user_id))
  return { challenge: c.data, people, members: m.data || [], checkins: checkins.map(x => ({ ...x, photo_url: x.photo_path ? urls[x.photo_path] || null : null })), reactions, comments, me: await me() }
}

/** A photo as a smaller JPEG (at most 1280 px across) for the upload. */
export function shrinkPhoto(file, max = 1280) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(img.src)
      c.toBlob(b => (b ? resolve(b) : reject(new Error('foto'))), 'image/jpeg', 0.82)
    }
    img.onerror = () => reject(new Error('Não foi possível ler a foto.'))
    img.src = URL.createObjectURL(file)
  })
}

/** Posts one activity to several challenges, with the same photo (one copy in each). */
export async function postCheckin(challengeIds, activity, { caption = '', photo = null } = {}) {
  const uid = await me()
  if (!uid) fail({ message: 'Entre na sua conta para postar.' })
  const done = []
  for (const cid of challengeIds) {
    let photo_path = null
    if (photo) {
      photo_path = `${cid}/${uid}/${activity.activity_id.replace(/[^\w-]/g, '')}-${Date.now().toString(36)}.jpg`
      const { error } = await db().storage.from('checkins').upload(photo_path, photo, { contentType: 'image/jpeg', upsert: false })
      if (error) fail(error)
    }
    const { error } = await db().from('checkins').upsert({ ...activity, challenge_id: cid, user_id: uid, caption: caption.slice(0, 500), photo_path }, { onConflict: 'challenge_id,user_id,activity_id' })
    if (error) fail(error)
    done.push(cid)
  }
  return done
}

export async function deleteCheckin(c) {
  if (c.photo_path) await db().storage.from('checkins').remove([c.photo_path])
  const { error } = await db().from('checkins').delete().eq('id', c.id)
  if (error) fail(error)
}

export async function setReaction(checkinId, kind, on) {
  const uid = await me()
  const q = on
    ? db().from('checkin_reactions').insert({ checkin_id: checkinId, user_id: uid, kind })
    : db().from('checkin_reactions').delete().eq('checkin_id', checkinId).eq('user_id', uid).eq('kind', kind)
  const { error } = await q
  if (error && !/duplicate/i.test(error.message)) fail(error)
}

export async function addComment(checkinId, body) {
  const uid = await me()
  const { data, error } = await db().from('checkin_comments').insert({ checkin_id: checkinId, user_id: uid, body: body.trim().slice(0, 500) }).select().single()
  if (error) fail(error)
  return data
}

export async function loadMessages(challengeId) {
  const { data, error } = await db().from('challenge_messages').select('id, user_id, body, created_at').eq('challenge_id', challengeId).order('created_at', { ascending: false }).limit(200)
  if (error) fail(error)
  return (data || []).reverse()
}
export async function sendMessage(challengeId, body) {
  const uid = await me()
  const { error } = await db().from('challenge_messages').insert({ challenge_id: challengeId, user_id: uid, body: body.trim().slice(0, 1000) })
  if (error) fail(error)
}

/** Live: calls `fn` whenever the challenge gets a check-in, reaction, comment or message. */
export function watchChallenge(challengeId, fn) {
  try {
    const ch = db().channel('ch-' + challengeId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins', filter: `challenge_id=eq.${challengeId}` }, fn)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'challenge_messages', filter: `challenge_id=eq.${challengeId}` }, fn)
      .subscribe()
    return () => { try { db().removeChannel(ch) } catch { /* fine */ } }
  } catch { return () => {} }
}

/** The route a run check-in carries, as [[lat, lng], …]. */
export function routeOf(c) {
  const enc = c?.stats?.route
  if (!enc) return null
  const rows = []
  // two numbers a point, delta-encoded (run-track encodeRows)
  let i = 0, prev = [0, 0], row = []
  while (i < enc.length) {
    let b, shift = 0, n = 0
    do { b = enc.charCodeAt(i++) - 63; n |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20 && i < enc.length)
    const v = prev[row.length] + (n & 1 ? ~(n >> 1) : n >> 1)
    prev[row.length] = v
    row.push(v)
    if (row.length === 2) { rows.push([row[0] / 1e5, row[1] / 1e5]); row = [] }
  }
  return rows
}
