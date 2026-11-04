import { describe, expect, it } from 'vitest'
import { addFix, startTrack, pauseTrack, resumeTrack, finishTrack, pointsOf, segmentsOf, bestEfforts, haversine,
  encodeRows, decodeRows, fmtPace, fmtClock, fmtKm, currentPace, elapsedMs } from './run-track.js'

// a seeded wobble, so the noisy runs are the same every time
const rng = seed => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5 }
const M_LAT = 1 / 111195
const at = (x, y, lat0 = -23.55, lng0 = -46.63) => ({ lat: lat0 + y * M_LAT, lng: lng0 + x * M_LAT / Math.cos(lat0 * Math.PI / 180) })

/** Run along a straight line east at `speed` m/s for `sec` seconds, a fix a second, noisy by ±noise m. */
function run(track, { sec, speed, noise = 0, acc = 8, t0, x0 = 0, seed = 7, alt } = {}) {
  const r = rng(seed)
  let tr = track
  for (let i = 0; i <= sec; i++) {
    const p = at(x0 + speed * i + r() * 2 * noise, r() * 2 * noise)
    tr = addFix(tr, { ...p, acc, t: t0 + i * 1000, alt: alt ? alt(i) : undefined }).track
  }
  return tr
}

describe('the GPS engine', () => {
  it('measures a clean 5 km at 5:00/km: distance, moving time and the splits', () => {
    const t0 = 1_700_000_000_000
    const tr = run(startTrack('run', t0), { sec: 1500, speed: 1000 / 300, t0 })
    expect(tr.dist).toBeGreaterThan(4950)
    expect(tr.dist).toBeLessThan(5050)
    expect(tr.movingMs / 1000).toBeGreaterThan(1470)
    expect(tr.movingMs / 1000).toBeLessThan(1510)
    expect(tr.splits.length).toBe(4)
    for (const s of tr.splits) expect(Math.abs(s - 300)).toBeLessThanOrEqual(3)
  })
  it('keeps a noisy run close to the truth', () => {
    const t0 = 1_700_000_000_000
    const tr = run(startTrack('run', t0), { sec: 900, speed: 3, noise: 6, acc: 12, t0 })
    expect(Math.abs(tr.dist - 2700) / 2700).toBeLessThan(0.04)
  })
  it('adds almost nothing standing still, and stops the moving clock', () => {
    const t0 = 1_700_000_000_000
    let tr = run(startTrack('run', t0), { sec: 60, speed: 3, t0 })
    const d = tr.dist, m = tr.movingMs
    tr = run(tr, { sec: 120, speed: 0, noise: 4, acc: 10, t0: t0 + 61000, x0: 180 })
    expect(tr.dist - d).toBeLessThan(15)
    expect(tr.movingMs - m).toBeLessThan(STOP_ALLOWANCE)
    expect(tr.moving).toBe(false)
  })
  it('drops fixes that are too vague or would mean a jump', () => {
    const t0 = 1_700_000_000_000
    let tr = run(startTrack('run', t0), { sec: 10, speed: 3, t0 })
    expect(addFix(tr, { ...at(30, 0), acc: 80, t: t0 + 11000 }).drop).toBe('accuracy')
    expect(addFix(tr, { ...at(400, 0), acc: 5, t: t0 + 11000 }).drop).toBe('spike')
    expect(addFix(tr, { ...at(33, 0), acc: 5, t: t0 + 11000 }).drop).toBeUndefined()
  })
  it('counts a stretch with the screen off by the distance it covered', () => {
    const t0 = 1_700_000_000_000
    let tr = run(startTrack('run', t0), { sec: 30, speed: 3, t0 })
    // two minutes without fixes, 360 m further on
    tr = run(tr, { sec: 30, speed: 3, t0: t0 + 150000, x0: 90 + 360 })
    expect(Math.abs(tr.dist - 540)).toBeLessThan(15)
  })
  it('pauses: no time, no distance, and the line breaks', () => {
    const t0 = 1_700_000_000_000
    let tr = run(startTrack('run', t0), { sec: 60, speed: 3, t0 })
    tr = pauseTrack(tr, t0 + 61000)
    expect(addFix(tr, { ...at(500, 0), acc: 5, t: t0 + 70000 }).drop).toBe('paused')
    tr = resumeTrack(tr, t0 + 121000)
    tr = run(tr, { sec: 60, speed: 3, t0: t0 + 121000, x0: 600 })
    expect(Math.abs(tr.dist - 360)).toBeLessThan(10)
    expect(elapsedMs(tr, t0 + 181000)).toBe(121000)
    const kept = finishTrack(tr, { now: t0 + 181000, kg: 80 })
    expect(segmentsOf(kept).length).toBe(2)
    expect(kept.kcal).toBe(Math.round(80 * kept.distM / 1000))
  })
  it('climbs only what the altimeter really climbed', () => {
    const t0 = 1_700_000_000_000
    const r = rng(3)
    const tr = run(startTrack('run', t0), { sec: 600, speed: 3, t0, alt: i => 700 + i * 0.05 + r() * 4 })
    expect(tr.gain).toBeGreaterThan(20)
    expect(tr.gain).toBeLessThan(40)
  })
  it('gives the pace of the last half minute', () => {
    const t0 = 1_700_000_000_000
    const tr = run(startTrack('run', t0), { sec: 120, speed: 4, t0 })
    expect(Math.abs(currentPace(tr, t0 + 120000) - 250)).toBeLessThan(6)
  })
})

const STOP_ALLOWANCE = 9000

describe('keeping a run', () => {
  it('round-trips the encoding, negative numbers too', () => {
    const rows = [[-2355000, -4663000, 0, 760], [-2354990, -4662980, 3, 761], [-2354950, -4662990, 9, -9999]]
    expect(decodeRows(encodeRows(rows), 4)).toEqual(rows)
  })
  it('keeps the points and finds the best km', () => {
    const t0 = 1_700_000_000_000
    let tr = run(startTrack('run', t0), { sec: 300, speed: 3, t0 })
    tr = run(tr, { sec: 250, speed: 4, t0: t0 + 301000, x0: 900 })
    const kept = finishTrack(tr, { now: t0 + 552000 })
    const pts = pointsOf(kept)
    expect(pts.length).toBeGreaterThan(100)
    expect(haversine(pts[0], at(0, 0))).toBeLessThan(2)
    const best = bestEfforts(kept)
    expect(Math.abs(best[1000] - 250)).toBeLessThan(6)
    expect(best[5000]).toBeUndefined()
  })
  it('formats like a running app', () => {
    expect(fmtPace(332)).toBe('5:32')
    expect(fmtPace(null)).toBe('–:–')
    expect(fmtClock(3723000)).toBe('1:02:03')
    expect(fmtClock(65000)).toBe('1:05')
    expect(fmtKm(5243)).toBe('5,24')
  })
})
