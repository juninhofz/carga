// CARGA runs: the GPS engine behind views/Run.jsx, pure so it can be tested with made-up fixes.
//
// A phone's GPS is noisy: a fix can be 40 m off, standing still it wanders a few metres every
// second, and now and then it jumps across the block. What a running app shows is only as good as
// what it throws away, so every fix goes through, in order:
//   1. accuracy   fixes worse than MAX_ACC metres are dropped (the first ones while the GPS warms up)
//   2. spikes     a fix that would mean moving faster than the sport allows is dropped
//   3. smoothing  a small Kalman filter blends each fix with the track so far, by its accuracy
//   4. anchors    distance only grows once the smoothed position has left the last counted point by
//                 more than the noise (STEP), so standing still adds nothing
//   5. moving     no new anchor for STOP_MS means stopped: the moving time pauses (auto-pause)
// Splits per km, elevation gain (with a dead band against the altimeter's wobble), the pace of the
// last half minute and calories come out of the same pass. A finished run is kept compact: the
// anchors delta-encoded like a Google polyline, with seconds and metres of altitude alongside.

export const SPORTS = {
  run: { name: 'Corrida', verb: 'Correr', icon: 'cargaRun', q: 3, max: 9, kcalKgKm: 1.0 },
  walk: { name: 'Caminhada', verb: 'Caminhar', icon: 'steps', q: 2, max: 4.5, kcalKgKm: 0.53 },
  ride: { name: 'Pedal', verb: 'Pedalar', icon: 'bike', q: 8, max: 25, met: 7.5 },
  // the sports without GPS: only the clock runs (a class, a game, a swim)
  bjj: { name: 'Jiu-jitsu', icon: 'figureStrength', gps: false, met: 8 },
  muaythai: { name: 'Muay Thai', icon: 'boxing', gps: false, met: 9 },
  boxing: { name: 'Boxe', icon: 'boxing', gps: false, met: 9 },
  football: { name: 'Futebol', icon: 'figureRun', gps: false, met: 7 },
  swim: { name: 'Natação', icon: 'swim', gps: false, met: 7 },
  other: { name: 'Outra atividade', icon: 'stopwatch', gps: false, met: 5 },
}
export const hasGps = type => SPORTS[type]?.gps !== false
export const MAX_ACC = 35
export const GOOD_ACC = 20
export const STOP_MS = 8000
const PACE_WINDOW_MS = 30000
const ALT_BAND = 3

const R = 6371008.8
const rad = d => (d * Math.PI) / 180
/** Metres between two { lat, lng }. */
export function haversine(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** A new recording. */
export function startTrack(type = 'run', now = Date.now()) {
  return {
    type: SPORTS[type] ? type : 'run', startedAt: now, status: 'running',
    // filter
    kf: null, raw: null,
    // what is counted
    pts: [], brk: [], dist: 0, movingMs: 0, pausedMs: 0, pauseAt: null,
    anchor: null, moving: false, lastFixT: null, splits: [], splitAt: 0,
    gain: 0, alt: null, altBase: null, recent: [],
  }
}

const kalman = (kf, fix, q) => {
  const acc = Math.max(1, fix.acc)
  if (!kf) return { lat: fix.lat, lng: fix.lng, v: acc * acc, t: fix.t }
  const dt = Math.max(0, fix.t - kf.t)
  const v = kf.v + (dt * q * q) / 1000
  const k = v / (v + acc * acc)
  return { lat: kf.lat + k * (fix.lat - kf.lat), lng: kf.lng + k * (fix.lng - kf.lng), v: (1 - k) * v, t: fix.t }
}

/**
 * One GPS fix { lat, lng, acc, alt?, t } into the track. Returns the next track (the input is not
 * changed) and why a fix was dropped, if it was: { track, drop }.
 */
export function addFix(track, fix) {
  if (track.status !== 'running') return { track, drop: 'paused' }
  if (!(fix && Number.isFinite(fix.lat) && Number.isFinite(fix.lng) && Number.isFinite(fix.t))) return { track, drop: 'bad' }
  const acc = Number.isFinite(fix.acc) ? fix.acc : MAX_ACC
  if (acc > MAX_ACC) return { track, drop: 'accuracy' }
  const sport = SPORTS[track.type]
  const s = { ...track }
  if (s.raw) {
    const dt = (fix.t - s.raw.t) / 1000
    if (dt <= 0) return { track, drop: 'time' }
    // allow for both fixes' error before calling it a jump
    const d = Math.max(0, haversine(s.raw, fix) - acc - s.raw.acc)
    if (d / dt > sport.max) return { track, drop: 'spike' }
  }
  s.raw = { lat: fix.lat, lng: fix.lng, acc, t: fix.t }
  s.kf = kalman(s.kf, { ...fix, acc }, sport.q)
  const p = { lat: s.kf.lat, lng: s.kf.lng, t: fix.t }

  // time since the last fix; it counts as moving below if the fix moved on (or we still move)
  const dtFix = s.lastFixT != null ? fix.t - s.lastFixT : 0
  s.lastFixT = fix.t

  // altitude, smoothed, with a dead band
  if (Number.isFinite(fix.alt)) {
    s.alt = s.alt == null ? fix.alt : s.alt + 0.25 * (fix.alt - s.alt)
    if (s.altBase == null) s.altBase = s.alt
    else if (s.alt > s.altBase + ALT_BAND) { s.gain += s.alt - s.altBase; s.altBase = s.alt }
    else if (s.alt < s.altBase - ALT_BAND) s.altBase = s.alt
  }

  if (!s.anchor) {
    s.anchor = p
    s.pts = [...s.pts, { ...p, d: s.dist, alt: s.alt }]
    return { track: s }
  }
  const step = Math.min(15, Math.max(3, acc * 0.5))
  const d = haversine(s.anchor, p)
  if (d >= step) {
    // a long gap (screen off, tunnel) counts only as long as the distance could take at a walk
    s.movingMs += Math.min(dtFix, (d / 0.8) * 1000)
    s.lingerMs = 0
    const before = s.dist
    s.dist += d
    // splits: the moving time at each whole km, by where on this stretch it fell
    const segMs = fix.t - s.anchor.t
    for (let km = Math.floor(before / 1000) + 1; km * 1000 <= s.dist; km++) {
      const frac = (km * 1000 - before) / d
      const at = s.movingMs - Math.min(segMs, s.movingMs) * (1 - frac)
      s.splits = [...s.splits, Math.round((at - s.splitAt) / 1000)]
      s.splitAt = at
    }
    s.anchor = p
    s.moving = true
    s.pts = [...s.pts, { ...p, d: s.dist, alt: s.alt }]
    s.recent = [...s.recent.filter(r => fix.t - r.t <= PACE_WINDOW_MS), { t: fix.t, d: s.dist }]
  } else if (s.moving && fix.t - s.anchor.t > STOP_MS) {
    // stopped: the seconds spent around the last anchor were not moving after all
    s.moving = false
    s.movingMs -= s.lingerMs || 0
    s.lingerMs = 0
  } else if (s.moving) {
    const dt = Math.min(dtFix, STOP_MS)
    s.movingMs += dt
    s.lingerMs = (s.lingerMs || 0) + dt
  }
  return { track: s }
}

/** Pause (manual): the time until resume counts nowhere, and the line breaks on the map. */
export function pauseTrack(track, now = Date.now()) {
  if (track.status !== 'running') return track
  const s = { ...track, status: 'paused', pauseAt: now, moving: false }
  // the smoothed line trails the runner by a few metres: close it to the last fix
  if (track.moving && track.raw && track.anchor) {
    const d = haversine(track.anchor, track.raw)
    if (d >= 3) {
      s.dist += d
      s.pts = [...s.pts, { lat: track.raw.lat, lng: track.raw.lng, t: track.raw.t, d: s.dist, alt: s.alt }]
    }
  }
  return s
}
export function resumeTrack(track, now = Date.now()) {
  if (track.status !== 'paused') return track
  return { ...track, status: 'running', pausedMs: track.pausedMs + (now - track.pauseAt), pauseAt: null,
    // a fresh start: no jump from where it stopped, no speed check against the old fix
    raw: null, kf: null, anchor: null, lastFixT: null, recent: [], brk: track.pts.length ? [...track.brk, track.pts.length] : track.brk }
}

/** Time on the clock: everything since the start except manual pauses. */
export const elapsedMs = (track, now = Date.now()) =>
  Math.max(0, (track.status === 'paused' ? track.pauseAt : now) - track.startedAt - track.pausedMs)

/** Moving time, live: the counted time plus the stretch since the last fix while moving. */
export const movingMsNow = (track, now = Date.now()) =>
  track.movingMs + (track.status === 'running' && track.moving && track.lastFixT != null ? Math.min(Math.max(0, now - track.lastFixT), 5000) : 0)

/** Seconds per km over the last half minute, or null while stopped or too little to tell. */
export function currentPace(track, now = Date.now()) {
  const r = track.recent.filter(x => now - x.t <= PACE_WINDOW_MS)
  if (!track.moving || r.length < 2) return null
  const d = r[r.length - 1].d - r[0].d, dt = (r[r.length - 1].t - r[0].t) / 1000
  return d > 10 && dt > 0 ? (dt / d) * 1000 : null
}

export const paceOf = (sec, m) => (m > 0 ? (sec / m) * 1000 : null)

export function kcalOf(type, distM, movingSec, kg = 70) {
  const s = SPORTS[type] || SPORTS.run
  const w = Number(kg) > 0 ? Number(kg) : 70
  return Math.round(s.met ? s.met * w * (movingSec / 3600) : s.kcalKgKm * w * (distM / 1000))
}

/* ---------- formatting ---------- */

const two = n => String(n).padStart(2, '0')
/** 1:02:03 or 12:03. */
export function fmtClock(ms) {
  const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60
  return h ? h + ':' + two(m) + ':' + two(s) : m + ':' + two(s)
}
/** 5:32 (per km), or –:– */
export const fmtPace = sec => (sec && Number.isFinite(sec) && sec < 3600 ? Math.floor(sec / 60) + ':' + two(Math.round(sec % 60) % 60) : '–:–')
/** 5,24 (km, Brazilian decimal comma) */
export const fmtKm = m => (Math.max(0, m) / 1000).toFixed(2).replace('.', ',')
/** km/h for the bike */
export const fmtSpeed = (m, sec) => (sec > 0 ? ((m / sec) * 3.6).toFixed(1).replace('.', ',') : '0,0')

/* ---------- keeping a run small ---------- */

// Google's polyline algorithm, generalised to n numbers per point: each value is the difference to
// the one before, zig-zag signed, in 5-bit chunks offset into printable ASCII.
function encNum(v) {
  let n = v < 0 ? ~(v << 1) : v << 1, out = ''
  while (n >= 0x20) { out += String.fromCharCode((0x20 | (n & 0x1f)) + 63); n >>= 5 }
  return out + String.fromCharCode(n + 63)
}
export function encodeRows(rows) {
  const prev = []
  let out = ''
  for (const row of rows) row.forEach((v, i) => { out += encNum(v - (prev[i] || 0)); prev[i] = v })
  return out
}
export function decodeRows(str, width) {
  const rows = [], prev = new Array(width).fill(0)
  let i = 0, row = []
  while (i < str.length) {
    let b, shift = 0, n = 0
    do { b = str.charCodeAt(i++) - 63; n |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20 && i < str.length)
    const v = prev[row.length] + (n & 1 ? ~(n >> 1) : n >> 1)
    prev[row.length] = v
    row.push(v)
    if (row.length === width) { rows.push(row); row = [] }
  }
  return rows
}

/** The finished run as it is kept in S.runs. */
export function finishTrack(track, { now = Date.now(), kg, name } = {}) {
  const t = track.status === 'paused' ? track : pauseTrack(track, now)
  // without GPS there is no moving or stopped: the whole clock counts
  const movingSec = Math.round((hasGps(t.type) ? t.movingMs : elapsedMs(t, now)) / 1000)
  const t0 = t.startedAt
  const rows = t.pts.map(p => [Math.round(p.lat * 1e5), Math.round(p.lng * 1e5), Math.round((p.t - t0) / 1000), p.alt == null ? -9999 : Math.round(p.alt)])
  const sport = SPORTS[t.type]
  const hour = new Date(t0).getHours()
  const part = hour < 5 ? 'noturna' : hour < 12 ? 'matinal' : hour < 18 ? 'à tarde' : 'noturna'
  const when = hour < 5 ? 'à noite' : hour < 12 ? 'de manhã' : hour < 18 ? 'à tarde' : 'à noite'
  const title = name || (!hasGps(t.type) ? sport.name + ' ' + when : t.type === 'ride' ? 'Pedal ' + (part === 'matinal' ? 'matinal' : part === 'à tarde' ? 'à tarde' : 'noturno') : sport.name + ' ' + part)
  return {
    id: 'run' + t0.toString(36), type: t.type, name: title, start: t0, end: t.pauseAt,
    elapsedSec: Math.round(elapsedMs(t, now) / 1000), movingSec, distM: Math.round(t.dist), gainM: Math.round(t.gain),
    kcal: kcalOf(t.type, t.dist, movingSec, kg), splits: t.splits, trk: encodeRows(rows), brk: t.brk, _ts: now,
  }
}

/** The kept points of a run: [{ lat, lng, s (seconds from the start), alt|null }], and the breaks. */
export function pointsOf(run) {
  const pts = decodeRows(String(run?.trk || ''), 4).map(([la, ln, s, a]) => ({ lat: la / 1e5, lng: ln / 1e5, s, alt: a === -9999 ? null : a }))
  return pts
}
/** The run's line, cut at the manual pauses: [[[lat, lng], …], …]. */
export function segmentsOf(run, pts = pointsOf(run)) {
  const cuts = [0, ...(Array.isArray(run?.brk) ? run.brk : []), pts.length]
  const out = []
  for (let i = 0; i + 1 < cuts.length; i++) {
    const seg = pts.slice(cuts[i], cuts[i + 1]).map(p => [p.lat, p.lng])
    if (seg.length) out.push(seg)
  }
  return out
}

/** The local day of a run, yyyy-mm-dd. */
export function runDay(run) {
  const d = new Date(run.start)
  return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate())
}

/** Best efforts over the classic distances, from the kept points: { 1000: sec, 5000: sec, … }. */
export function bestEfforts(run, pts = pointsOf(run), marks = [400, 1000, 5000, 10000, 21097]) {
  // cumulative distance along the kept points, cut at pauses
  const cuts = new Set(Array.isArray(run?.brk) ? run.brk : [])
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + (cuts.has(i) ? 0 : haversine(pts[i - 1], pts[i])))
  const out = {}
  for (const m of marks) {
    if (cum[cum.length - 1] < m) continue
    let best = Infinity, j = 0
    for (let i = 0; i < pts.length; i++) {
      while (j < pts.length && cum[j] - cum[i] < m) j++
      if (j >= pts.length) break
      const over = cum[j] - cum[i], sec = (pts[j].s - pts[i].s) * (m / over)
      if (sec > 0 && sec < best) best = sec
    }
    if (best < Infinity) out[m] = Math.round(best)
  }
  return out
}
