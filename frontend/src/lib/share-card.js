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
      l.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,800;0,900;1,900&family=Barlow:wght@500;600;700&display=swap'
      l.onload = () => Promise.all(['900 100px "Barlow Condensed"', '800 100px "Barlow Condensed"', '600 40px "Barlow"'].map(f => document.fonts.load(f))).then(resolve, resolve)
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

/** The CARGA mark and name, small, at x, y (top-left). */
function drawLogo(ctx, x, y, ink) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.strokeStyle = ink === INK ? '#fff' : ORANGE
  ctx.lineWidth = 9
  ctx.beginPath(); ctx.arc(x + 26, y + 26, 20, Math.PI * 0.28, Math.PI * 1.72); ctx.stroke()
  ctx.strokeStyle = ink
  ctx.lineWidth = 5
  for (const [px, py] of [[38, 2], [46, 2], [38, 44], [46, 44]]) { ctx.beginPath(); ctx.moveTo(x + px, y + py); ctx.lineTo(x + px, y + py + 8); ctx.stroke() }
  ctx.fillStyle = ink
  ctx.font = `900 46px ${FONT}`
  ctx.textBaseline = 'middle'
  ctx.fillText('CARGA', x + 66, y + 28)
  ctx.restore()
}

function drawChip(ctx, x, y, status, label, scheme) {
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

export const MODELS = [
  { id: 'map', name: 'Mapa', needsRoute: true },
  { id: 'dark', name: 'Escuro' },
  { id: 'orange', name: 'Laranja' },
  { id: 'photo', name: 'Com foto' },
  { id: 'sticker', name: 'Adesivo' },
]

/** The picture of `a` in `model` as a PNG blob. `photo` is an Image for the photo model. */
export async function drawShare(a, model, photo) {
  await loadFonts()
  const c = makeCanvas(W, H, FONT)
  if (!c) return null
  const { canvas, ctx } = c
  const M = 80
  const label = a.statusLabel || a.status?.name || ''
  const listOrRoute = async (box, color, ink, sub, shadow) => {
    if (a.segments?.length) { strokeRoute(ctx, fitRoute(a.segments, box), color, 14, shadow); return }
    if (a.list?.length) {
      ctx.save()
      a.list.slice(0, 7).forEach(([n, d], i) => {
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

  if (model === 'map' && a.segments?.length) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
    const box = { x: 0, y: 0, w: W, h: 1180 }
    const lines = await drawMap(ctx, a.segments, box)
    strokeRoute(ctx, lines, ORANGE, 14, 'rgba(0,0,0,.55)')
    const g = ctx.createLinearGradient(0, 0, 0, 220); g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 220)
    drawLogo(ctx, M, 70, '#fff')
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `500 22px ${BODY}`; ctx.fillText('© OpenStreetMap', W - 230, 1160)
    ctx.fillStyle = ORANGE; ctx.fillRect(0, 1180, W, 10)
    drawChip(ctx, M, 1240, a.status, label)
    drawBig(ctx, M, 1580, a.big, '#fff')
    drawStats(ctx, M, 1700, W - M * 2, a.stats, '#fff', 'rgba(255,255,255,.6)')
  } else if (model === 'orange') {
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#ff7a1a'); g.addColorStop(1, '#ff4d00')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    drawLogo(ctx, M, 80, INK)
    drawChip(ctx, M, 190, a.status, label, ['rgba(0,0,0,.16)', INK])
    title(INK, 340)
    ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.beginPath(); ctx.roundRect(M, 400, W - M * 2, 900, 40); ctx.fill()
    await listOrRoute({ x: M + 40, y: 420, w: W - M * 2 - 80, h: 860 }, INK, INK, 'rgba(26,11,0,.65)')
    drawBig(ctx, M, 1600, a.big, INK)
    drawStats(ctx, M, 1720, W - M * 2, a.stats, INK, 'rgba(26,11,0,.65)')
  } else if (model === 'photo') {
    ctx.fillStyle = '#2b3138'; ctx.fillRect(0, 0, W, H)
    if (photo) {
      const s = Math.max(W / photo.width, H / photo.height)
      ctx.drawImage(photo, (W - photo.width * s) / 2, (H - photo.height * s) / 2, photo.width * s, photo.height * s)
    }
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(0.2, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.82)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    drawLogo(ctx, M, 80, '#fff')
    if (a.segments?.length) strokeRoute(ctx, fitRoute(a.segments, { x: M, y: 360, w: W - M * 2, h: 640 }), ORANGE, 12, 'rgba(0,0,0,.45)')
    drawChip(ctx, M, 1250, a.status, label, ['rgba(255,107,0,.92)', INK])
    title('#fff', 1400)
    drawBig(ctx, M, 1640, a.big, '#fff')
    drawStats(ctx, M, 1740, W - M * 2, a.stats, '#fff', 'rgba(255,255,255,.7)')
  } else if (model === 'sticker') {
    // transparent: only the route (or the icon), the numbers and the mark, with a soft shadow
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 18
    await listOrRoute({ x: 140, y: 380, w: W - 280, h: 640 }, ORANGE, '#fff', 'rgba(255,255,255,.8)')
    drawBig(ctx, W / 2, 1320, a.big, '#fff', 'center')
    drawStats(ctx, M, 1430, W - M * 2, [...a.stats.slice(0, 2), ['Status', a.status?.name || '']], '#fff', 'rgba(255,255,255,.85)', 'center')
    ctx.shadowBlur = 0
    drawLogo(ctx, W / 2 - 140, 1620, '#fff')
  } else {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
    drawLogo(ctx, M, 80, '#fff')
    drawChip(ctx, M, 190, a.status, label)
    title('#fff', 340)
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.roundRect(M, 400, W - M * 2, 900, 40); ctx.fill()
    await listOrRoute({ x: M + 40, y: 420, w: W - M * 2 - 80, h: 860 }, ORANGE, '#fff', 'rgba(255,255,255,.6)')
    drawBig(ctx, M, 1600, a.big, '#fff')
    drawStats(ctx, M, 1720, W - M * 2, a.stats, '#fff', 'rgba(255,255,255,.6)')
  }
  return toPng(canvas)
}
