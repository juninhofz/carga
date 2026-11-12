// CARGA: the pictures an activity is shared as (components/ShareActivity.jsx), drawn on the device
// at 1080×1920 (a Story). The approved models (2026-11-04):
//   map      the route over the real map (OpenStreetMap tiles), the numbers under it (runs only)
//   photo    the person's photo, the route and the numbers over it
//   dark     black, the route in orange, big numbers
//   orange   the brand's orange, ink in near-black
//   sticker  only the route and the numbers on a transparent PNG, to lay over any photo
// `a` is one activity: { title, status, big: { v, u }, stats: [[label, value] ×3], segments
// (lat/lng lines) or null, list: [[name, detail]], icon: an SVG path on a 24 grid }.
import { makeCanvas, toPng } from './share-image.js'
import { TILES } from './gym-places.js'
import { drawMarkOn, MARK_ASPECT } from './carga-mark.js'
import { GYM_MODELS, SHOW_DEFAULT, drawGymModel, drawSeal, fmtWhen, SAFE_TOP } from './share-gym.js'

export const W = 1080, H = 1920
const FONT = '"Barlow Condensed","Arial Narrow",Impact,sans-serif'
const BODY = '"Barlow","Segoe UI",Roboto,Helvetica,Arial,sans-serif'
const ORANGE = '#ff6b00', INK = '#1a0b00'
// the status icons (the same as the reveal's badges), 24 grid
export const STATUS_PATHS = {
  pena: { d: 'M20 4c-6 0-11 4-12 11l-3 5M8 15h6M10 11h6M20 4c0 7-4 11-11 11', stroke: true },
  firme: { d: 'M4 12h3M17 12h3M7 8v8M17 8v8M9 10v4M15 10v4M9 12h6', stroke: true },
  pesado: { d: 'M3 12h18M6 6v12M9 8v8M18 6v12M15 8v8', stroke: true },
  brutal: { d: 'M13 2 5 13h6l-1 9 8-12h-6z' },
  max: { d: 'M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-7z M5 21h14', mixed: true },
}
const CHIP = { pena: ['rgba(147,197,253,.18)', '#93c5fd'], firme: ['rgba(52,211,153,.18)', '#34d399'], pesado: ['rgba(255,107,0,.2)', '#ff8a3d'], brutal: ['rgba(239,68,68,.2)', '#f87171'], max: ['#ffb347', INK] }

let fontsAsked = null
/** Barlow Condensed for the pictures (the app itself does not need it), once, if the network allows. */
export function loadFonts() {
  if (fontsAsked) return fontsAsked
  fontsAsked = new Promise(resolve => {
    try {
      const l = document.createElement('link')
      l.rel = 'stylesheet'
      l.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,800;0,900;1,900&family=Barlow:wght@500;600;700&family=Space+Mono:wght@400;700&display=swap'
      l.onload = () => Promise.all(['900 100px "Barlow Condensed"', '800 100px "Barlow Condensed"', 'italic 900 100px "Barlow Condensed"', '600 40px "Barlow"', '400 30px "Space Mono"', '700 30px "Space Mono"'].map(f => document.fonts.load(f))).then(resolve, resolve)
      l.onerror = resolve
      document.head.appendChild(l)
      setTimeout(resolve, 2500)
    } catch { resolve() }
  })
  return fontsAsked
}

const loadImage = src => new Promise(resolve => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => resolve(i); i.onerror = () => resolve(null); i.src = src })

function drawIcon(ctx, id, x, y, size, color) {
  const p = STATUS_PATHS[id]
  if (!p) return
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 24, size / 24)
  ctx.strokeStyle = ctx.fillStyle = color
  ctx.lineWidth = 2.2
  ctx.lineCap = ctx.lineJoin = 'round'
  if (p.mixed) { const [flame, base] = p.d.split(' M'); ctx.fill(new Path2D(flame)); ctx.stroke(new Path2D('M' + base)) }
  else if (p.stroke) ctx.stroke(new Path2D(p.d))
  else ctx.fill(new Path2D(p.d))
  ctx.restore()
}

export function drawChip(ctx, x, y, status, label, scheme) {
  if (!status) return 0
  const [bg, fg] = scheme || CHIP[status.id] || CHIP.firme
  ctx.save()
  ctx.font = `800 40px ${FONT}`
  const text = label.toUpperCase()
  const w = ctx.measureText(text).width + 110, h = 68
  ctx.fillStyle = bg
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill()
  drawIcon(ctx, status.id, x + 18, y + 14, 40, fg)
  ctx.fillStyle = fg
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + 72, y + h / 2 + 2)
  ctx.restore()
  return w
}

function drawBig(ctx, x, y, big, ink, align = 'left') {
  if (!big) return
  ctx.save()
  ctx.fillStyle = ink
  ctx.textBaseline = 'alphabetic'
  ctx.font = `900 250px ${FONT}`
  const vw = ctx.measureText(big.v).width
  ctx.font = `800 80px ${FONT}`
  const uw = ctx.measureText(big.u).width
  let x0 = align === 'center' ? x - (vw + 16 + uw) / 2 : x
  ctx.font = `900 250px ${FONT}`
  ctx.fillText(big.v, x0, y)
  ctx.font = `800 80px ${FONT}`
  ctx.fillText(big.u, x0 + vw + 16, y)
  ctx.restore()
}

function drawStats(ctx, x, y, w, stats, ink, sub, align = 'left') {
  if (!stats.length) return
  ctx.save()
  const col = w / stats.length
  stats.forEach(([label, value], i) => {
    const cx = align === 'center' ? x + col * i + col / 2 : x + col * i
    ctx.textAlign = align === 'center' ? 'center' : 'left'
    ctx.fillStyle = sub
    ctx.font = `700 30px ${BODY}`
    ctx.fillText(String(label).toUpperCase(), cx, y)
    ctx.fillStyle = ink
    ctx.font = `800 76px ${FONT}`
    ctx.fillText(value, cx, y + 80)
  })
  ctx.restore()
}

/** The route fitted into a box, as canvas points. */
function fitRoute(segments, box, pad = 40) {
  const all = segments.flat()
  if (all.length < 2) return null
  const k = Math.cos((all[0][0] * Math.PI) / 180)
  const xs = all.map(p => p[1] * k), ys = all.map(p => -p[0])
  const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0 || 1e-9, h = Math.max(...ys) - y0 || 1e-9
  const s = Math.min((box.w - pad * 2) / w, (box.h - pad * 2) / h)
  const ox = box.x + (box.w - w * s) / 2, oy = box.y + (box.h - h * s) / 2
  return segments.map(seg => seg.map(p => [ox + (p[1] * k - x0) * s, oy + (-p[0] - y0) * s]))
}

function strokeRoute(ctx, lines, color, width, shadow) {
  if (!lines) return
  ctx.save()
  ctx.lineCap = ctx.lineJoin = 'round'
  for (const [c, w] of shadow ? [[shadow, width + 10], [color, width]] : [[color, width]]) {
    ctx.strokeStyle = c
    ctx.lineWidth = w
    for (const seg of lines) { ctx.beginPath(); seg.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke() }
  }
  const first = lines[0][0], lastSeg = lines[lines.length - 1], last = lastSeg[lastSeg.length - 1]
  for (const [p, fill] of [[first, '#22c55e'], [last, '#ef4444']]) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p[0], p[1], 16, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(p[0], p[1], 11, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

/* ---------- the map ---------- */

const lon2x = (lon, z) => ((lon + 180) / 360) * 256 * 2 ** z
const lat2y = (lat, z) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 256 * 2 ** z }

/** OpenStreetMap tiles behind the route in `box`, darkened; returns the route in canvas points. */
async function drawMap(ctx, segments, box) {
  const all = segments.flat()
  const lats = all.map(p => p[0]), lngs = all.map(p => p[1])
  const pad = 120
  let z = 18
  for (; z > 3; z--) {
    const w = lon2x(Math.max(...lngs), z) - lon2x(Math.min(...lngs), z)
    const h = lat2y(Math.min(...lats), z) - lat2y(Math.max(...lats), z)
    if (w <= box.w - pad * 2 && h <= box.h - pad * 2) break
  }
  // tiles are 256 px; drawn at 2× so the streets read on a phone
  const scale = 2, zz = z - 1
  const cx = (lon2x(Math.min(...lngs), zz) + lon2x(Math.max(...lngs), zz)) / 2
  const cy = (lat2y(Math.min(...lats), zz) + lat2y(Math.max(...lats), zz)) / 2
  const left = cx - box.w / 2 / scale, top = cy - box.h / 2 / scale
  const tx0 = Math.floor(left / 256), ty0 = Math.floor(top / 256)
  const tx1 = Math.floor((left + box.w / scale) / 256), ty1 = Math.floor((top + box.h / scale) / 256)
  const jobs = []
  for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) {
    const url = TILES.url.replace('{z}', zz).replace('{x}', ((tx % 2 ** zz) + 2 ** zz) % 2 ** zz).replace('{y}', ty)
    jobs.push(loadImage(url).then(img => ({ img, tx, ty })))
  }
  const tiles = await Promise.all(jobs)
  ctx.save()
  ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip()
  ctx.fillStyle = '#1b1f24'; ctx.fillRect(box.x, box.y, box.w, box.h)
  try { ctx.filter = 'invert(1) hue-rotate(180deg) brightness(.85) contrast(.9) saturate(.6)' } catch { /* older browsers: the plain map */ }
  for (const { img, tx, ty } of tiles) if (img) ctx.drawImage(img, box.x + (tx * 256 - left) * scale, box.y + (ty * 256 - top) * scale, 256 * scale + 1, 256 * scale + 1)
  ctx.filter = 'none'
  ctx.restore()
  return segments.map(seg => seg.map(([la, ln]) => [box.x + (lon2x(ln, zz) - left) * scale, box.y + (lat2y(la, zz) - top) * scale]))
}

/* ---------- the models ---------- */

// Everything between SAFE_TOP and SAFE_BOTTOM (lib/share-gym.js): Instagram lays its profile bar
// over the top of a Story and its message box over the bottom; the CARGA seal goes just above it.
export const MODELS = [
  { id: 'map', name: 'Mapa', needsRoute: true },
  { id: 'dark', name: 'Escuro' },
  { id: 'orange', name: 'Laranja' },
  { id: 'photo', name: 'Com foto' },
  { id: 'sticker', name: 'Adesivo' },
]
export { GYM_MODELS, SHOW_DEFAULT }

/** The exercises, one per row: name on the left, sets and weight on the right. */
function drawList(ctx, x, y, w, list, ink, sub, rowH = 58, max = 7) {
  const rows = list.slice(0, Math.max(0, max))
  ctx.save()
  rows.forEach(([n, d], i) => {
    const yy = y + i * rowH
    ctx.fillStyle = ink; ctx.font = `600 38px ${BODY}`; ctx.textAlign = 'left'
    ctx.fillText(n.length > 24 ? n.slice(0, 23) + '…' : n, x, yy)
    ctx.fillStyle = sub; ctx.font = `600 34px ${BODY}`; ctx.textAlign = 'right'
    ctx.fillText(d, x + w, yy)
  })
  if (list.length > rows.length && rows.length) { ctx.fillStyle = sub; ctx.font = `600 30px ${BODY}`; ctx.textAlign = 'left'; ctx.fillText('+ ' + (list.length - rows.length) + ' exercícios', x, y + rows.length * rowH) }
  ctx.restore()
  return rows.length * rowH + (list.length > rows.length && rows.length ? rowH : 0)
}

const MONO = '"Space Mono","Courier New",ui-monospace,monospace'
const when = a => (a.at ? new Date(a.at) : new Date())

/** The lines a receipt lists: the exercises of a workout, or the numbers of a run or a class. */
const receiptLines = a => (a.list?.length ? a.list : a.stats.map(([l, v]) => [l, v]))

function drawReceipt(ctx, a, label) {
  // orange ground, a paper slip slightly turned, torn at both ends, inside the safe band
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#ff7a1a'); g.addColorStop(1, '#ff5500')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  const gym = a.gym
  const extra = gym ? [a.big && ['Tempo', a.big.v + ' ' + a.big.u], a.sets && ['Séries', a.sets], a.pts && ['Pontos', '+' + a.pts]].filter(Boolean) : []
  const total = gym ? (a.volume ? ['TOTAL', a.volume] : null) : (a.big ? ['TEMPO', a.big.v + ' ' + a.big.u] : null)
  const rowH = 60
  const fixed = 110 + (a.noDate ? 0 : 52) + 40 + 64 + (extra.length ? 40 : 0) + (total ? 156 : 0) + (label ? 66 : 0) + 40 + 80 + 110 + 30
  const maxLines = Math.max(0, Math.floor((1260 - fixed - extra.length * rowH) / rowH))
  const lines = receiptLines(a).slice(0, maxLines)
  const px = 130, pw = W - 260
  const ph = fixed + (lines.length + extra.length) * rowH
  const py = SAFE_TOP + Math.max(0, (1290 - ph) / 2)
  ctx.save()
  ctx.translate(W / 2, py + ph / 2); ctx.rotate(-0.035); ctx.translate(-W / 2, -(py + ph / 2))
  ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18
  ctx.fillStyle = '#fffaf0'
  ctx.beginPath()
  const tooth = 26
  ctx.moveTo(px, py)
  for (let x = px; x < px + pw; x += tooth) ctx.lineTo(x + tooth / 2, py + 14), ctx.lineTo(x + tooth, py)
  ctx.lineTo(px + pw, py + ph)
  for (let x = px + pw; x > px; x -= tooth) ctx.lineTo(x - tooth / 2, py + ph - 14), ctx.lineTo(x - tooth, py + ph)
  ctx.closePath(); ctx.fill()
  ctx.shadowColor = 'transparent'
  const ink = '#2a1a0e', l = px + 50, r = px + pw - 50
  let y = py + 110
  ctx.fillStyle = ink; ctx.textAlign = 'center'
  ctx.font = `700 64px ${MONO}`; ctx.fillText('CARGA', W / 2, y)
  if (!a.noDate) { y += 52; ctx.font = `400 30px ${MONO}`; ctx.fillText(fmtWhen(when(a)), W / 2, y) }
  const dash = yy => { ctx.save(); ctx.strokeStyle = '#b49a80'; ctx.setLineDash([12, 10]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(l, yy); ctx.lineTo(r, yy); ctx.stroke(); ctx.restore() }
  y += 40; dash(y)
  ctx.font = `700 36px ${MONO}`; ctx.textAlign = 'left'; y += 64; ctx.fillText((a.title || 'Atividade').toUpperCase().slice(0, 24), l, y)
  ctx.font = `400 32px ${MONO}`
  for (const [n, d] of lines) {
    y += rowH
    ctx.textAlign = 'left'; ctx.fillText(n.length > 20 ? n.slice(0, 19) + '.' : n, l, y)
    ctx.textAlign = 'right'; ctx.fillText(d, r, y)
  }
  if (extra.length) {
    y += 40; dash(y)
    for (const [n, d] of extra) { y += rowH; ctx.textAlign = 'left'; ctx.fillText(n, l, y); ctx.textAlign = 'right'; ctx.fillText(d, r, y) }
  }
  if (total) {
    y += 40; dash(y)
    ctx.font = `700 46px ${MONO}`
    y += 76; ctx.textAlign = 'left'; ctx.fillText(total[0], l, y)
    ctx.textAlign = 'right'; ctx.fillText(total[1], r, y)
  }
  y += 40; dash(y)
  if (label) { y += 66; ctx.textAlign = 'center'; ctx.font = `700 38px ${MONO}`; ctx.fillText('STATUS: ' + label.toUpperCase(), W / 2, y) }
  // the barcode
  y += 40
  ctx.fillStyle = ink
  let x = l + 30, k = 7
  while (x < r - 30) { const w = 3 + ((k * 7) % 9); ctx.fillRect(x, y, w, 80); x += w + 4 + ((k * 3) % 7); k++ }
  y += 130; ctx.textAlign = 'center'; ctx.font = `400 30px ${MONO}`; ctx.fillText('obrigado pela carga', W / 2, y)
  ctx.restore()
  drawSeal(ctx, true)
}

/** The CARGA mark big enough to ask "what app is that?"; the workout under it. It is its own seal. */
function drawLogoModel(ctx, a, label) {
  ctx.fillStyle = '#0d0b0a'; ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, 380, 40, W / 2, 380, 520); glow.addColorStop(0, 'rgba(255,107,0,.35)'); glow.addColorStop(1, 'rgba(255,107,0,0)')
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)
  drawMarkOn(ctx, W / 2 - 220 * MARK_ASPECT / 2, SAFE_TOP + 135, 220, { bar: ORANGE, plate: '#f6eee8', ground: '#0d0b0a' })
  ctx.save()
  ctx.fillStyle = '#f6eee8'; ctx.textAlign = 'center'
  ctx.font = `italic 900 170px ${FONT}`; ctx.fillText('CARGA', W / 2, SAFE_TOP + 380)
  ctx.fillStyle = ORANGE; ctx.font = `800 32px ${FONT}`
  ctx.fillText('T R E I N O   ·   C O R R I D A   ·   D E S A F I O S', W / 2, SAFE_TOP + 430)
  ctx.restore()
  let y = SAFE_TOP + 460
  if (a.status) {
    ctx.save(); ctx.font = `800 40px ${FONT}`
    const w = ctx.measureText(label.toUpperCase()).width + 110
    ctx.restore()
    drawChip(ctx, W / 2 - w / 2, y, a.status, label)
    y += 90
  }
  const panelTop = y, panelBottom = 1550
  ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.roundRect(70, panelTop, W - 140, panelBottom - panelTop, 44); ctx.fill()
  y = panelTop + 90
  ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#f6eee8'; ctx.font = `800 62px ${FONT}`
  ctx.fillText((a.title || '').toUpperCase(), W / 2, y); ctx.restore()
  if (a.big) { drawBig(ctx, W / 2, y + 200, a.big, '#fff', 'center'); y += 200 }
  if (a.stats.length) { drawStats(ctx, 120, y + 70, W - 240, a.stats, '#fff', 'rgba(255,255,255,.55)', 'center'); y += 170 }
  if (a.list?.length) {
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(130, y + 10, W - 260, 2)
    drawList(ctx, 130, y + 80, W - 260, a.list, '#fff', 'rgba(255,255,255,.6)', 58, Math.floor((panelBottom - 40 - (y + 80)) / 58) - 1)
  }
  if (!a.noDate) { ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(246,238,232,.45)'; ctx.font = `600 30px ${BODY}`; ctx.fillText(fmtWhen(when(a)), W / 2, panelBottom + 50); ctx.restore() }
}

/**
 * A gym workout as the person chose to show it (`show`, SHOW_DEFAULT when not given): the shape the
 * older models draw, with what is off left out.
 */
function gymView(a, show) {
  const on = id => show[id] !== false
  const stat = l => a.stats.find(s => s[0] === l)?.[1]
  return {
    ...a, gym: true,
    big: on('time') ? a.big : null,
    stats: a.stats.filter(([l]) => (l === 'Volume' ? on('volume') : l === 'Séries' ? on('sets') : on('lifts'))),
    list: on('lifts') ? a.list : [],
    status: on('status') ? a.status : null,
    statusLabel: on('status') ? a.statusLabel : '',
    noDate: !on('date'),
    volume: on('volume') ? stat('Volume') : '',
    sets: on('sets') ? stat('Séries') : '',
    pts: on('pts') ? a.pts || 0 : 0,
  }
}

/** The picture of `a` in `model` as a PNG blob. `photo` is an Image for the photo models; `show`
 *  says what a gym workout shows (lib/share-gym.js SHOW_ITEMS). */
export async function drawShare(a0, model, photo, show = SHOW_DEFAULT) {
  await loadFonts()
  const c = makeCanvas(W, H, FONT)
  if (!c) return null
  const { canvas, ctx } = c
  if (a0.list && drawGymModel(ctx, model, a0, show, photo, { drawChip, drawIcon })) return toPng(canvas)
  const a = a0.list ? gymView(a0, show) : a0
  const M = 80
  const label = a.statusLabel || a.status?.name || ''
  const listOrRoute = async (box, color, ink, sub, shadow) => {
    if (a.segments?.length) { strokeRoute(ctx, fitRoute(a.segments, box), color, 14, shadow); return }
    if (a.list?.length) {
      ctx.save()
      a.list.slice(0, Math.floor((box.h - 20) / 104)).forEach(([n, d], i) => {
        const y = box.y + 40 + i * 104
        ctx.fillStyle = ink; ctx.font = `600 44px ${BODY}`; ctx.textAlign = 'left'; ctx.fillText(n.length > 26 ? n.slice(0, 25) + '…' : n, box.x, y)
        ctx.fillStyle = sub; ctx.font = `600 40px ${BODY}`; ctx.textAlign = 'right'; ctx.fillText(d, box.x + box.w, y)
        ctx.fillStyle = sub; ctx.globalAlpha = 0.3; ctx.fillRect(box.x, y + 30, box.w, 2); ctx.globalAlpha = 1
      })
      ctx.restore()
      return
    }
    if (a.icon) {
      ctx.save()
      ctx.fillStyle = 'rgba(255,107,0,.14)'
      ctx.beginPath(); ctx.arc(box.x + box.w / 2, box.y + box.h / 2, 210, 0, Math.PI * 2); ctx.fill()
      ctx.translate(box.x + box.w / 2 - 130, box.y + box.h / 2 - 130); ctx.scale(260 / 24, 260 / 24)
      ctx.strokeStyle = color; ctx.lineWidth = 1.7; ctx.lineCap = ctx.lineJoin = 'round'
      ctx.stroke(new Path2D(a.icon))
      ctx.restore()
    }
  }
  const title = (ink, y) => { if (!a.title) return; ctx.save(); ctx.fillStyle = ink; ctx.font = `800 64px ${FONT}`; ctx.fillText(a.title, M, y); ctx.restore() }

  if (model === 'receipt') drawReceipt(ctx, a, label)
  else if (model === 'logo') drawLogoModel(ctx, a, label)
  else if (model === 'map' && a.segments?.length) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
    const box = { x: 0, y: 0, w: W, h: 1000 }
    const lines = await drawMap(ctx, a.segments, box)
    strokeRoute(ctx, lines, ORANGE, 14, 'rgba(0,0,0,.55)')
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `500 22px ${BODY}`; ctx.fillText('© OpenStreetMap', W - 230, 980)
    // the lower half in the brand's orange, ink in near-black
    const og = ctx.createLinearGradient(0, 1000, W, H); og.addColorStop(0, '#ff7a1a'); og.addColorStop(1, '#ff4d00')
    ctx.fillStyle = og; ctx.fillRect(0, 1000, W, H - 1000)
    ctx.fillStyle = INK; ctx.fillRect(0, 1000, W, 10)
    drawChip(ctx, M, 1050, a.status, label, [INK, ORANGE])
    drawBig(ctx, M, 1360, a.big, INK)
    drawStats(ctx, M, 1440, W - M * 2, a.stats, INK, 'rgba(26,11,0,.65)')
    drawSeal(ctx, true)
  } else if (model === 'orange') {
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#ff7a1a'); g.addColorStop(1, '#ff4d00')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    drawChip(ctx, M, SAFE_TOP, a.status, label, ['rgba(0,0,0,.16)', INK])
    title(INK, SAFE_TOP + 150)
    ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.beginPath(); ctx.roundRect(M, SAFE_TOP + 190, W - M * 2, 640, 40); ctx.fill()
    await listOrRoute({ x: M + 40, y: SAFE_TOP + 210, w: W - M * 2 - 80, h: 600 }, INK, INK, 'rgba(26,11,0,.65)')
    drawBig(ctx, M, 1320, a.big, INK)
    drawStats(ctx, M, 1410, W - M * 2, a.stats, INK, 'rgba(26,11,0,.65)')
    drawSeal(ctx, true)
  } else if (model === 'photo') {
    ctx.fillStyle = '#2b3138'; ctx.fillRect(0, 0, W, H)
    if (photo) {
      const s = Math.max(W / photo.width, H / photo.height)
      ctx.drawImage(photo, (W - photo.width * s) / 2, (H - photo.height * s) / 2, photo.width * s, photo.height * s)
    }
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(0.18, 'rgba(0,0,0,0)'); g.addColorStop(0.42, 'rgba(0,0,0,0)'); g.addColorStop(0.75, 'rgba(0,0,0,.8)'); g.addColorStop(1, 'rgba(0,0,0,.85)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    if (a.segments?.length) strokeRoute(ctx, fitRoute(a.segments, { x: M, y: SAFE_TOP + 40, w: W - M * 2, h: 520 }), ORANGE, 12, 'rgba(0,0,0,.45)')
    let y = 1540
    if (a.stats.length) { drawStats(ctx, M, y - 110, W - M * 2, a.stats, '#fff', 'rgba(255,255,255,.7)'); y -= 140 }
    if (a.big) { drawBig(ctx, M, y, a.big, '#fff'); y -= 230 }
    if (a.title) { title('#fff', y); y -= 80 }
    if (a.status) { drawChip(ctx, M, y - 60, a.status, label, ['rgba(255,107,0,.92)', INK]); y -= 90 }
    if (a.list?.length) {
      const n = Math.max(0, Math.min(a.list.length, Math.floor((y - SAFE_TOP - 120) / 56)))
      if (n) {
        const ph = 50 + n * 56 + (a.list.length > n ? 56 : 0), py = y - ph - 10
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.roundRect(M - 20, py - 30, W - M * 2 + 40, ph, 30); ctx.fill()
        drawList(ctx, M + 10, py + 30, W - M * 2 - 20, a.list, '#fff', 'rgba(255,255,255,.75)', 56, n)
      }
    }
    drawSeal(ctx)
  } else if (model === 'sticker') {
    // transparent: only the route (or the icon), the numbers and the seal, with a soft shadow
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 18
    await listOrRoute({ x: 140, y: SAFE_TOP + 40, w: W - 280, h: 640 }, ORANGE, '#fff', 'rgba(255,255,255,.8)')
    drawBig(ctx, W / 2, 1230, a.big, '#fff', 'center')
    drawStats(ctx, M, 1340, W - M * 2, [...a.stats.slice(0, 2), ['Status', a.status?.name || '']], '#fff', 'rgba(255,255,255,.85)', 'center')
    drawSeal(ctx)
    ctx.shadowBlur = 0
  } else {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
    drawChip(ctx, M, SAFE_TOP, a.status, label)
    title('#fff', SAFE_TOP + 150)
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.roundRect(M, SAFE_TOP + 190, W - M * 2, 640, 40); ctx.fill()
    await listOrRoute({ x: M + 40, y: SAFE_TOP + 210, w: W - M * 2 - 80, h: 600 }, ORANGE, '#fff', 'rgba(255,255,255,.6)')
    drawBig(ctx, M, 1320, a.big, '#fff')
    drawStats(ctx, M, 1410, W - M * 2, a.stats, '#fff', 'rgba(255,255,255,.6)')
    drawSeal(ctx)
  }
  return toPng(canvas)
}
