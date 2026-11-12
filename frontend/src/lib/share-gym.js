// CARGA: the gym workout's share pictures (2026-11-12), drawn at 1080×1920 next to lib/share-card.js.
//   - The rank card is the app's own (components/RankCard.jsx + its CSS), drawn on the canvas.
//   - Everything sits between SAFE_TOP and SAFE_BOTTOM: Instagram lays the profile bar over the top
//     of a Story and the message box over its bottom. The CARGA seal (drawSeal) goes just above the
//     message box, centred, where every Story shows it.
//   - The person picks what shows (SHOW_ITEMS); a model draws only what is on and what it uses.
import { drawMarkOn, MARK_ASPECT } from './carga-mark.js'

export const W = 1080, H = 1920
export const SAFE_TOP = 260, SAFE_BOTTOM = 1560, SEAL_Y = 1592
const FONT = '"Barlow Condensed","Arial Narrow",Impact,sans-serif'
const BODY = '"Barlow","Segoe UI",Roboto,Helvetica,Arial,sans-serif'
const OR = '#ff6b00', INK = '#120800', PAPER = '#f6eee8', GROUND = '#0d0a09'

/** What the person can switch on and off, in the order the sheet lists them. */
export const SHOW_ITEMS = [
  { id: 'card', name: 'Carta de rank' },
  { id: 'levelup', name: 'Subiu de nível' },
  { id: 'pts', name: 'Pontos' },
  { id: 'time', name: 'Tempo' },
  { id: 'volume', name: 'Volume' },
  { id: 'sets', name: 'Séries' },
  { id: 'lifts', name: 'Exercícios' },
  { id: 'pr', name: 'Recorde' },
  { id: 'status', name: 'Status' },
  { id: 'date', name: 'Data' },
]
export const SHOW_DEFAULT = Object.fromEntries(SHOW_ITEMS.map(i => [i.id, true]))
const ALL = SHOW_ITEMS.map(i => i.id)
const NO_CARD = ALL.filter(i => i !== 'card')

// The gym models: the four from before (their logo moved), then the ones chosen on 2026-11-12.
// `uses` is what each can show; `needs` hides a model that has nothing to show without it.
export const GYM_MODELS = [
  { id: 'logo', name: 'CARGA', uses: ['time', 'volume', 'sets', 'lifts', 'status', 'date'] },
  { id: 'receipt', name: 'Recibo', uses: ['time', 'volume', 'sets', 'lifts', 'pts', 'status', 'date'] },
  { id: 'rank', name: 'Carta de rank', uses: ALL, needs: 'card' },
  { id: 'corner', name: 'Carta no canto', uses: ALL, needs: 'card' },
  { id: 'levelup', name: 'Subiu de nível', uses: ['card', 'pts', 'time', 'volume', 'sets', 'status', 'date'], needs: 'levelUp' },
  { id: 'poster', name: 'Pôster', uses: NO_CARD },
  { id: 'score', name: 'Placar', uses: NO_CARD },
  { id: 'diagonal', name: 'Diagonal', uses: ALL },
  { id: 'outline', name: 'Contorno', uses: NO_CARD },
  { id: 'photo', name: 'Com foto', uses: ['time', 'volume', 'sets', 'lifts', 'status', 'date'] },
  { id: 'band', name: 'Foto com faixa', uses: NO_CARD },
]

const when = a => (a.at ? new Date(a.at) : new Date())
export const fmtWhen = d => d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const shortWhen = d => d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').toUpperCase()

/**
 * The activity `a` as a model shows it: only what is switched on and what the model uses.
 * a: { title, status, statusLabel, big {v,u}, stats [[label, value]], list [[name, detail]], at,
 *      card?, pts?, levelUp? { from, to, rankFrom, rankTo }, prNames? [] }
 */
export function view(a, show, uses) {
  const on = id => (uses === undefined || uses.includes(id)) && show[id] !== false
  const stat = label => a.stats?.find(s => s[0] === label)?.[1]
  const items = []
  if (on('time') && a.big) items.push(['Tempo', a.big.v + (a.big.u === 'min' ? ' min' : ' h')])
  if (on('volume') && stat('Volume')) items.push(['Volume', stat('Volume')])
  if (on('sets') && stat('Séries')) items.push(['Séries', stat('Séries')])
  return {
    title: a.title || 'Treino',
    items,
    time: on('time') && a.big ? a.big : null,
    volume: on('volume') ? stat('Volume') || '' : '',
    lifts: on('lifts') ? a.list || [] : [],
    status: on('status') ? a.status || null : null,
    label: a.statusLabel || a.status?.name || '',
    date: on('date') ? fmtWhen(when(a)) : '',
    short: on('date') ? shortWhen(when(a)) : '',
    pts: on('pts') ? a.pts || 0 : 0,
    up: on('levelup') ? a.levelUp || null : null,
    levelUp: a.levelUp || null,
    card: on('card') ? a.card || null : null,
    pr: on('pr') ? a.prNames || [] : [],
  }
}

/* ---------- small drawing helpers ---------- */

const spacing = (ctx, px) => { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px' }
function text(ctx, s, x, y, font, color, align = 'left', ls = 0) {
  ctx.save(); ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; spacing(ctx, ls)
  ctx.fillText(s, x, y); ctx.restore()
}
/** The biggest size up to `size` at which `s` fits in `w`. */
function fit(ctx, s, w, size, style = 'italic 900', fam = FONT, ls = 0) {
  ctx.save(); spacing(ctx, ls)
  let z = size
  for (; z > 24; z -= 4) { ctx.font = `${style} ${z}px ${fam}`; if (ctx.measureText(s).width <= w) break }
  ctx.restore()
  return z
}
/** `s` in up to `max` lines of width `w`, at the biggest size up to `size` that fits. */
function lines(ctx, s, w, size, max = 2) {
  const words = String(s).toUpperCase().split(/\s+/)
  for (let z = size; z > 30; z -= 4) {
    ctx.save(); ctx.font = `italic 900 ${z}px ${FONT}`
    const out = []; let cur = ''
    for (const wd of words) {
      const next = cur ? cur + ' ' + wd : wd
      if (ctx.measureText(next).width <= w || !cur) cur = next; else { out.push(cur); cur = wd }
    }
    if (cur) out.push(cur)
    const ok = out.length <= max && out.every(l => ctx.measureText(l).width <= w)
    ctx.restore()
    if (ok) return { z, out }
  }
  return { z: 30, out: [String(s).toUpperCase()] }
}
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})` }

/** The status pill; `scheme` [ground, ink] overrides its colours. Returns its width. */
function chip(ctx, h, x, y, v, scheme) {
  if (!v.status) return 0
  return h.drawChip(ctx, x, y, v.status, v.label, scheme)
}
function chipWidth(ctx, v) {
  if (!v.status) return 0
  ctx.save(); ctx.font = `800 40px ${FONT}`; const w = ctx.measureText(v.label.toUpperCase()).width + 110; ctx.restore()
  return w
}

/** The numbers in a row of columns: label above, value below. Returns the height used. */
function statRow(ctx, items, x, y, w, { ink = PAPER, sub = 'rgba(246,238,232,.55)', box = false, align = 'left', size = 84 } = {}) {
  if (!items.length) return 0
  const gap = box ? 18 : 24, col = (w - gap * (items.length - 1)) / items.length
  items.forEach(([l, val], i) => {
    const cx = x + i * (col + gap)
    if (box) { ctx.save(); ctx.fillStyle = '#17130f'; ctx.strokeStyle = '#2b2522'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(cx, y, col, 150, 26); ctx.fill(); ctx.stroke(); ctx.restore() }
    const tx = align === 'center' ? cx + col / 2 : cx + (box ? 26 : 0)
    text(ctx, l.toUpperCase(), tx, y + (box ? 46 : 28), `700 28px ${BODY}`, sub, align, 3)
    const z = fit(ctx, val, col - (box ? 40 : 6), box ? 66 : size, '800', FONT)
    text(ctx, val, tx, y + (box ? 122 : 28 + z * 0.95), `800 ${z}px ${FONT}`, ink, align)
  })
  return box ? 150 : 40 + size
}

/** The exercises, one per row; a record gets a PR tag. Returns the height used. */
function liftRows(ctx, v, x, y, w, max, { ink = PAPER, sub = '#c9bdb3', rule = 'rgba(255,255,255,.1)', rowH = 60, size = 40 } = {}) {
  const rows = v.lifts.slice(0, Math.max(0, max))
  rows.forEach(([n, d], i) => {
    const yy = y + i * rowH + size
    ctx.save()
    ctx.font = `800 ${size + 4}px ${FONT}`; const dw = ctx.measureText(d).width
    ctx.fillStyle = sub; ctx.textAlign = 'right'; ctx.fillText(d, x + w, yy)
    ctx.font = `700 ${size}px ${BODY}`; ctx.fillStyle = ink; ctx.textAlign = 'left'
    let name = n
    const room = w - dw - 40 - (v.pr.includes(n) ? 80 : 0)
    while (name.length > 4 && ctx.measureText(name).width > room) name = name.slice(0, -2)
    if (name !== n) name = name.trimEnd() + '…'
    ctx.fillText(name, x, yy)
    if (v.pr.includes(n)) {
      const nx = x + ctx.measureText(name).width + 14
      ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.roundRect(nx, yy - size * 0.78, 64, size * 0.86, 8); ctx.fill()
      ctx.fillStyle = '#1a1200'; ctx.font = `800 ${Math.round(size * 0.66)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('PR', nx + 32, yy - size * 0.14)
    }
    ctx.fillStyle = rule; ctx.fillRect(x, yy + 16, w, 2)
    ctx.restore()
  })
  const more = v.lifts.length - rows.length
  if (more > 0 && rows.length) text(ctx, '+ ' + more + (more === 1 ? ' exercício' : ' exercícios'), x, y + rows.length * rowH + 40, `600 30px ${BODY}`, sub)
  return rows.length ? rows.length * rowH + (more > 0 ? 50 : 0) : 0
}

/** "▲ Subiu de nível 16 → 17", centred on cx or from x. */
function levelLine(ctx, v, x, y, color, align = 'left') {
  if (!v.up) return 0
  ctx.save()
  const a = 'SUBIU DE NÍVEL', b = v.up.from + ' → ' + v.up.to
  ctx.font = `italic 900 60px ${FONT}`; const aw = ctx.measureText(a).width
  ctx.font = `800 42px ${FONT}`; const bw = ctx.measureText(b).width
  const total = 54 + aw + 20 + bw
  const x0 = align === 'center' ? x - total / 2 : x
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + 22, y - 40); ctx.lineTo(x0 + 44, y); ctx.closePath(); ctx.fill()
  ctx.font = `italic 900 60px ${FONT}`; ctx.fillText(a, x0 + 54, y)
  ctx.fillStyle = PAPER; ctx.font = `800 42px ${FONT}`; ctx.fillText(b, x0 + 54 + aw + 20, y)
  ctx.restore()
  return 76
}

/** A pill with the points: "+180 PTS". */
function ptsPill(ctx, v, x, y, color, align = 'left', suffix = '') {
  if (!v.pts) return 0
  ctx.save()
  const s = '+' + v.pts + ' PTS' + suffix
  ctx.font = `800 46px ${FONT}`; spacing(ctx, 4)
  const w = ctx.measureText(s).width + 56
  const x0 = align === 'center' ? x - w / 2 : x
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x0, y, w, 70, 14); ctx.fill()
  ctx.fillStyle = INK; ctx.textBaseline = 'middle'; ctx.fillText(s, x0 + 28, y + 38)
  ctx.restore()
  return 70
}

/** The record line: "🏆 Recorde em Agachamento". */
function prBox(ctx, v, x, y, w) {
  if (!v.pr.length) return 0
  ctx.save()
  ctx.fillStyle = 'rgba(250,204,21,.12)'; ctx.strokeStyle = 'rgba(250,204,21,.4)'; ctx.lineWidth = 3
  ctx.beginPath(); ctx.roundRect(x, y, w, 96, 26); ctx.fill(); ctx.stroke()
  const s = (v.pr.length > 1 ? v.pr.length + ' recordes: ' : 'Recorde em ') + v.pr[0]
  ctx.fillStyle = '#facc15'; ctx.font = `700 38px ${BODY}`; ctx.textBaseline = 'middle'
  let t = s; while (t.length > 6 && ctx.measureText(t).width > w - (v.pts ? 260 : 120)) t = t.slice(0, -2)
  ctx.fillText('🏆 ' + (t === s ? s : t.trimEnd() + '…'), x + 28, y + 50)
  if (v.pts) { ctx.fillStyle = OR; ctx.font = `800 46px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText('+' + v.pts + ' pts', x + w - 28, y + 50) }
  ctx.restore()
  return 96
}

/** The bottom row: the status on the left, the date (or `right`) on the right. */
function footer(ctx, h, v, y, { right = v.date, ink = '#9a918a', scheme } = {}) {
  const cw = chip(ctx, h, 80, y, v, scheme)
  if (right) text(ctx, right, cw ? W - 80 : 80, y + 46, `600 34px ${BODY}`, ink, cw ? 'right' : 'left')
}

/** The CARGA seal, centred just above the message box Instagram lays over a Story. */
export function drawSeal(ctx, dark = false) {
  ctx.save()
  const mh = 84, mw = mh * MARK_ASPECT
  ctx.font = `italic 900 70px ${FONT}`; const tw = ctx.measureText('CARGA').width
  ctx.font = `800 22px ${FONT}`; spacing(ctx, 6); const sw = ctx.measureText('TREINO · CORRIDA · DESAFIOS').width
  spacing(ctx, 0)
  const total = mw + 18 + Math.max(tw, sw)
  const x = W / 2 - total / 2
  drawMarkOn(ctx, x, SEAL_Y + mh / 2, mh, dark ? { bar: INK, plate: INK, ground: OR } : { bar: OR, plate: PAPER, ground: GROUND })
  const ink = dark ? INK : PAPER
  text(ctx, 'CARGA', x + mw + 18, SEAL_Y + 56, `italic 900 70px ${FONT}`, ink, 'left', 2)
  text(ctx, 'TREINO · CORRIDA · DESAFIOS', x + mw + 20, SEAL_Y + 86, `800 22px ${FONT}`, dark ? 'rgba(18,8,0,.75)' : 'rgba(246,238,232,.7)', 'left', 6)
  ctx.restore()
}

/* ---------- the rank card, as components/RankCard.jsx and its CSS draw it ---------- */

const ROMAN = ['I', 'II', 'III', 'IV', 'V']
/** The rank's letter (letterSVG in RankCard.jsx) on a 200 × 200 grid. */
function drawLetter(ctx, k) {
  const symbol = k.r === '★' || k.r === '∞'
  const len = [...k.r].length
  const size = symbol ? 150 : len === 1 ? 190 : len === 2 ? 128 : 92
  const fam = symbol ? 'Arial, sans-serif' : FONT
  const y = k.r === '∞' ? 150 : k.r === '★' ? 158 : 168
  const font = `italic 900 ${size}px ${fam}`
  const put = (fill, stroke) => {
    ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; spacing(ctx, -4)
    if (stroke) { ctx.strokeStyle = '#0d0d0d'; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.strokeText(k.r, 100, y) }
    ctx.fillStyle = fill; ctx.fillText(k.r, 100, y)
  }
  // the gradient runs over the letter's own height, as the SVG's bounding-box gradient does
  const top = y - size * 0.74
  const metal = ctx.createLinearGradient(0, top, 0, y)
  metal.addColorStop(0, '#ffffff'); metal.addColorStop(0.38, k.c); metal.addColorStop(0.52, k.c2); metal.addColorStop(0.6, k.c); metal.addColorStop(1, k.c2)
  ctx.save(); ctx.globalAlpha = 0.9; ctx.translate(13, 8); put(k.c2); ctx.restore()
  ctx.save(); ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(146, 0); ctx.lineTo(26, 200); ctx.lineTo(-20, 200); ctx.closePath(); ctx.clip(); put(metal, true); ctx.restore()
  ctx.save(); ctx.translate(4, -3); ctx.beginPath(); ctx.moveTo(154, 0); ctx.lineTo(220, 0); ctx.lineTo(220, 200); ctx.lineTo(34, 200); ctx.closePath(); ctx.clip(); put(metal, true); ctx.restore()
  ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(156, -6); ctx.lineTo(24, 206); ctx.stroke(); ctx.restore()
}

/**
 * The rank card centred on (cx, cy), `em` px per em (the card is 15 × 21 em), turned `deg`.
 * card: { tier: { r, c, c2, fx, label }, level, name, xp: { into, step }, stats: { workouts, prs, weeks }, number }
 */
export function drawRankCard(ctx, cx, cy, em, deg, card) {
  const k = card.tier, w = 15 * em, h = 21 * em
  ctx.save()
  ctx.translate(cx, cy); ctx.rotate((deg * Math.PI) / 180); ctx.translate(-w / 2, -h / 2)
  // the frame in the rank's metal, glowing
  let frame
  if (k.fx.includes('fire')) { frame = ctx.createLinearGradient(0, h, 0, 0); frame.addColorStop(0, '#ff3b00'); frame.addColorStop(0.4, '#ff6b00'); frame.addColorStop(0.75, '#ffb000'); frame.addColorStop(1, '#ffe27a') }
  else if (k.fx.includes('holo')) { frame = ctx.createLinearGradient(0, 0, w, h); ['#ff6b6b', '#ffd23f', '#5bff9a', '#3fa9ff', '#b46bff', '#ff6b6b'].forEach((c, i) => frame.addColorStop(i / 5, c)) }
  else { frame = ctx.createLinearGradient(0, 0, w, h); frame.addColorStop(0, k.c); frame.addColorStop(0.45, k.c2); frame.addColorStop(0.7, k.c); frame.addColorStop(1, k.c2) }
  ctx.shadowColor = rgba(k.c, 0.55); ctx.shadowBlur = 2.4 * em; ctx.shadowOffsetY = 0.6 * em
  ctx.fillStyle = frame; ctx.beginPath(); ctx.roundRect(0, 0, w, h, em); ctx.fill()
  ctx.shadowColor = 'transparent'
  // the face
  const ix = 0.44 * em, iy = 0.44 * em, iw = w - 0.88 * em, ih = h - 0.88 * em
  ctx.save()
  ctx.beginPath(); ctx.roundRect(ix, iy, iw, ih, 0.7 * em); ctx.clip()
  ctx.fillStyle = '#101010'; ctx.fillRect(ix, iy, iw, ih)
  ctx.save(); ctx.translate(ix + iw / 2, iy + ih * 0.46); ctx.scale(1.1 * iw, 0.65 * ih)
  const face = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); face.addColorStop(0, rgba(k.c, 0.22)); face.addColorStop(0.64, 'rgba(16,16,16,0)')
  ctx.fillStyle = face; ctx.fillRect(-1, -1, 2, 2); ctx.restore()
  if (k.fx.includes('foil')) {
    const sheen = ctx.createLinearGradient(ix, iy, ix + iw, iy + ih)
    sheen.addColorStop(0.35, 'rgba(255,255,255,0)'); sheen.addColorStop(0.45, 'rgba(255,255,255,.16)'); sheen.addColorStop(0.55, 'rgba(255,255,255,0)')
    ctx.fillStyle = sheen; ctx.fillRect(ix, iy, iw, ih)
  }
  const x0 = ix + 0.75 * em, x1 = ix + iw - 0.75 * em, top = iy + 0.7 * em, bottom = iy + ih - 0.6 * em
  // top row: the mark and CARGA, the card's number
  const mh = 1.25 * em / MARK_ASPECT, my = top + mh / 2
  drawMarkOn(ctx, x0, my, mh, { bar: OR, plate: '#ffffff', ground: '#101010' })
  ctx.textBaseline = 'middle'
  text(ctx, 'CARGA', x0 + 1.25 * em + 0.35 * em, my + 0.25 * em, `700 ${0.72 * em}px ${FONT}`, 'rgba(255,255,255,.7)', 'left', 0.22 * 0.72 * em)
  text(ctx, card.number ? 'Nº ' + String(card.number).padStart(3, '0') : 'RANK ' + k.r, x1, my + 0.25 * em, `700 ${0.68 * em}px ${FONT}`, k.c, 'right', 0.2 * 0.68 * em)
  // the foot, from the bottom up
  const statsTop = bottom - 1.75 * em
  const xptY = statsTop - 0.9 * em
  const xpY = xptY - 1.0 * em
  const lvlY = xpY - 0.55 * em
  const nameY = lvlY - 1.0 * em
  // the art: aura, ring, sparks, the letter, in the space between the top row and the name
  const artTop = top + mh, artBottom = nameY - 1.6 * em
  const ax = ix + iw / 2, ay = (artTop + artBottom) / 2
  const aura = ctx.createRadialGradient(ax, ay, 0, ax, ay, 4.3 * em)
  aura.addColorStop(0, rgba(k.c, 0.5)); aura.addColorStop(0.64, rgba(k.c, 0))
  ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(ax, ay, 4.3 * em, 0, Math.PI * 2); ctx.fill()
  ctx.save(); ctx.strokeStyle = rgba(k.c, 0.33); ctx.lineWidth = Math.max(1.5, 0.08 * em); ctx.setLineDash([0.3 * em, 0.22 * em])
  ctx.beginPath(); ctx.arc(ax, ay, 3.9 * em, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
  if (k.fx.includes('sparks')) for (const [px, py] of [[0.26, 0.62], [0.72, 0.56]]) {
    ctx.save(); ctx.fillStyle = k.c; ctx.shadowColor = k.c; ctx.shadowBlur = 0.4 * em
    ctx.beginPath(); ctx.arc(ix + iw * px, artTop + (artBottom - artTop) * py, 0.13 * em, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  }
  const ls = 9 * em
  ctx.save()
  ctx.translate(ax - ls / 2, ay - ls / 2); ctx.scale(ls / 200, ls / 200)
  ctx.shadowColor = rgba(k.c, 0.55); ctx.shadowBlur = 0.7 * em
  drawLetter(ctx, k)
  ctx.restore()
  // the name, the level, the points to the next level, the numbers
  ctx.save(); ctx.shadowColor = rgba(k.c, 0.55); ctx.shadowBlur = 0.5 * em
  text(ctx, (k.label + ' ' + ROMAN[(card.level - 1) % 5]).toUpperCase(), ax, nameY, `800 ${1.7 * em}px ${FONT}`, '#fff', 'center', 0.06 * 1.7 * em)
  ctx.restore()
  text(ctx, (card.name ? card.name + ' · ' : '') + 'Nível ' + card.level, ax, lvlY, `500 ${0.8 * em}px ${BODY}`, 'rgba(255,255,255,.72)', 'center')
  const bx = x0 + 0.3 * em, bw = x1 - x0 - 0.6 * em, bh = 0.32 * em
  ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.roundRect(bx, xpY, bw, bh, bh / 2); ctx.fill()
  const pct = Math.max(0.02, Math.min(1, (card.xp?.into || 0) / (card.xp?.step || 1)))
  const bar = ctx.createLinearGradient(bx, 0, bx + bw * pct, 0); bar.addColorStop(0, k.c2); bar.addColorStop(1, k.c)
  ctx.fillStyle = bar; ctx.beginPath(); ctx.roundRect(bx, xpY, bw * pct, bh, bh / 2); ctx.fill()
  text(ctx, (card.xp?.into || 0).toLocaleString('pt-BR') + ' pts', x0 + 0.45 * em, xptY, `500 ${0.6 * em}px ${BODY}`, 'rgba(255,255,255,.5)')
  text(ctx, 'nível ' + (card.level + 1), x1 - 0.45 * em, xptY, `500 ${0.6 * em}px ${BODY}`, 'rgba(255,255,255,.5)', 'right')
  ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(x0, statsTop - 0.45 * em, x1 - x0, Math.max(1, 0.06 * em))
  const col = (x1 - x0) / 3
  ;[['workouts', 'treinos'], ['prs', 'recordes'], ['weeks', 'semanas']].forEach(([key, l], i) => {
    const c = x0 + col * i + col / 2
    if (i) { ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(x0 + col * i, statsTop, Math.max(1, 0.06 * em), 1.6 * em) }
    text(ctx, String(card.stats?.[key] ?? 0), c, statsTop + 1.0 * em, `800 ${1.15 * em}px ${FONT}`, '#fff', 'center')
    text(ctx, l.toUpperCase(), c, statsTop + 1.6 * em, `500 ${0.5 * em}px ${BODY}`, 'rgba(255,255,255,.5)', 'center', 0.07 * em)
  })
  ctx.restore()
  ctx.restore()
  return h
}

/* ---------- the models ---------- */

const ground = (ctx, color = GROUND) => { ctx.fillStyle = color; ctx.fillRect(0, 0, W, H) }
function glow(ctx, x, y, r, color, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0))
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
}
function streaks(ctx) {
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.03)'; ctx.lineWidth = 2
  for (let x = -H; x < W; x += 62) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + H * 0.47, 0); ctx.stroke() }
  ctx.restore()
}
const tierColor = a => a.card?.tier.c || OR

/** The rank card the hero: the card, the workout under it. */
function rankModel(ctx, h, v, a) {
  ground(ctx); glow(ctx, W / 2, 640, 760, tierColor(a), 0.42); streaks(ctx)
  let y = SAFE_TOP + 20
  if (v.up) { levelLine(ctx, v, W / 2, y + 50, tierColor(a), 'center'); y += 90 }
  const nLifts = Math.min(v.lifts.length, v.card ? 2 : 4)
  const below = 110 + (v.pts ? 90 : 0) + (v.items.length ? 150 : 0) + nLifts * 60 + 30
  const footY = SAFE_BOTTOM - 90
  if (v.card) {
    const ch = Math.min(21 * 42, footY - y - below - 20)
    drawRankCard(ctx, W / 2, y + ch / 2, ch / 21, -3, v.card)
    y += ch + 40
  } else {
    const t = lines(ctx, v.title, W - 160, 180, 2)
    t.out.forEach((l, i) => text(ctx, l, W / 2, y + t.z * 0.9 * (i + 1), `italic 900 ${t.z}px ${FONT}`, PAPER, 'center'))
    y += t.z * 0.9 * t.out.length + 60
  }
  if (v.card) { const z = fit(ctx, v.title.toUpperCase(), W - 160, 96); text(ctx, v.title.toUpperCase(), W / 2, y + z * 0.85, `italic 900 ${z}px ${FONT}`, PAPER, 'center'); y += z + 20 }
  if (v.pts) { ptsPill(ctx, v, W / 2, y, tierColor(a), 'center', v.card ? ' NA CARTA' : ''); y += 96 }
  y += statRow(ctx, v.items, 80, y, W - 160, { align: 'center' }) + (v.items.length ? 26 : 0)
  liftRows(ctx, v, 80, y, W - 160, Math.min(nLifts, Math.floor((footY - y - 20) / 60)))
  footer(ctx, h, v, footY)
  drawSeal(ctx)
}

/** A big title, the card turned in the corner. */
function cornerModel(ctx, h, v, a) {
  ground(ctx); glow(ctx, 860, 420, 620, tierColor(a), 0.48)
  const cardW = v.card ? 300 : 0
  if (v.card) drawRankCard(ctx, W - 80 - cardW / 2 + 10, SAFE_TOP + 220, 20, 8, v.card)
  text(ctx, (v.short || 'TREINO DE HOJE'), 80, SAFE_TOP + 70, `800 38px ${FONT}`, OR, 'left', 8)
  const t = lines(ctx, v.title, W - 160 - (v.card ? cardW + 40 : 0), 170, 3)
  t.out.forEach((l, i) => text(ctx, l, 80, SAFE_TOP + 90 + t.z * 0.86 * (i + 1), `italic 900 ${t.z}px ${FONT}`, PAPER))
  let y = Math.max(SAFE_TOP + 110 + t.z * 0.86 * t.out.length, v.card ? SAFE_TOP + 460 : 0) + 50
  if (v.up) { levelLine(ctx, v, 80, y + 50, tierColor(a)); y += 100 }
  const footY = SAFE_BOTTOM - 90
  let bottom = footY - 30
  if (v.pr.length) { bottom -= 96; prBox(ctx, v, 80, bottom, W - 160); bottom -= 26 }
  if (v.items.length) { bottom -= 150; statRow(ctx, v.items, 80, bottom, W - 160, { box: true }); bottom -= 30 }
  liftRows(ctx, v, 80, y, W - 160, Math.floor((bottom - y) / 66), { rowH: 66, size: 44 })
  footer(ctx, h, v, footY)
  drawSeal(ctx)
}

/** Levelled up: rays, the new level, the card. */
function levelModel(ctx, h, v, a) {
  const c = tierColor(a)
  ground(ctx)
  ctx.save(); ctx.translate(W / 2, 860); ctx.fillStyle = rgba(c, 0.16)
  for (let i = 0; i < 24; i++) { ctx.rotate(Math.PI / 12); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-80, -1400); ctx.lineTo(80, -1400); ctx.closePath(); ctx.fill() }
  ctx.restore()
  glow(ctx, W / 2, 860, 640, c, 0.55)
  const up = a.levelUp || { from: 1, to: 2 }
  const newRank = up.rankTo !== undefined && up.rankTo !== up.rankFrom
  text(ctx, newRank ? 'NOVO RANK' : 'SUBI DE NÍVEL', W / 2, SAFE_TOP + 130, `italic 900 ${fit(ctx, newRank ? 'NOVO RANK' : 'SUBI DE NÍVEL', W - 160, 150)}px ${FONT}`, '#fff', 'center')
  // NÍVEL 16 ▸ 17: the old level dim, the new one in the rank's colour
  ctx.save(); ctx.font = `800 64px ${FONT}`
  const l1 = 'NÍVEL ' + up.from, l2 = String(up.to), w1 = ctx.measureText(l1).width
  ctx.font = `italic 900 96px ${FONT}`; const w2 = ctx.measureText(l2).width
  const x = W / 2 - (w1 + 90 + w2) / 2, yy = SAFE_TOP + 240
  ctx.fillStyle = 'rgba(246,238,232,.45)'; ctx.font = `800 64px ${FONT}`; ctx.fillText(l1, x, yy)
  ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x + w1 + 26, yy - 50); ctx.lineTo(x + w1 + 66, yy - 25); ctx.lineTo(x + w1 + 26, yy); ctx.closePath(); ctx.fill()
  ctx.font = `italic 900 96px ${FONT}`; ctx.shadowColor = c; ctx.shadowBlur = 30; ctx.fillText(l2, x + w1 + 90, yy + 8)
  ctx.restore()
  const footY = SAFE_BOTTOM - 90
  let bottom = footY - 26
  if (v.items.length) { bottom -= 124; statRow(ctx, v.items, 80, bottom, W - 160, { align: 'center' }); bottom -= 20 }
  if (v.pts) { bottom -= 70; ptsPill(ctx, v, W / 2, bottom, c, 'center'); bottom -= 30 }
  const top = SAFE_TOP + 300
  if (v.card) {
    const ch = Math.min(21 * 40, bottom - top)
    drawRankCard(ctx, W / 2, top + ch / 2, ch / 21, 0, v.card)
    // sparkles round the card
    ctx.save(); ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 20
    for (const [px, py, s] of [[0.12, 0.3, 26], [0.88, 0.22, 34], [0.9, 0.7, 22], [0.1, 0.78, 30], [0.2, 0.08, 18]]) {
      const sx = W * px, sy = top + ch * py
      ctx.beginPath(); ctx.moveTo(sx, sy - s); ctx.quadraticCurveTo(sx, sy, sx + s, sy); ctx.quadraticCurveTo(sx, sy, sx, sy + s); ctx.quadraticCurveTo(sx, sy, sx - s, sy); ctx.quadraticCurveTo(sx, sy, sx, sy - s); ctx.fill()
    }
    ctx.restore()
  } else {
    const r = a.card?.tier.r || ''
    const z = Math.min(520, bottom - top)
    text(ctx, r, W / 2, top + z * 0.86, `italic 900 ${z}px ${FONT}`, c, 'center')
  }
  footer(ctx, h, v, footY)
  drawSeal(ctx)
}

/** Orange, TREINO PAGO. in black. */
function posterModel(ctx, h, v) {
  ground(ctx, OR)
  const z = fit(ctx, 'TREINO', W - 150, 290)
  text(ctx, 'TREINO', 72, SAFE_TOP + z * 0.8, `italic 900 ${z}px ${FONT}`, INK, 'left', -4)
  text(ctx, 'PAGO.', 72, SAFE_TOP + z * 1.62, `italic 900 ${z}px ${FONT}`, INK, 'left', -4)
  let y = SAFE_TOP + z * 1.62 + 70
  const k = [v.title.toUpperCase(), v.short, v.up ? 'NÍVEL ' + v.up.to + ' ▲' : ''].filter(Boolean).join(' · ')
  text(ctx, k, 80, y, `800 ${fit(ctx, k, W - 160, 38, '800', FONT, 6)}px ${FONT}`, INK, 'left', 6)
  y += 40
  y += statRow(ctx, v.items, 80, y, W - 160, { ink: INK, sub: 'rgba(18,8,0,.6)' }) + 30
  const footY = SAFE_BOTTOM - 90
  liftRows(ctx, v, 80, y, W - 160, Math.min(5, Math.floor((footY - y - 20) / 62)), { ink: INK, sub: INK, rule: 'rgba(18,8,0,.22)', rowH: 62 })
  footer(ctx, h, v, footY, { right: v.pts ? '+' + v.pts + ' PTS' : '', ink: INK, scheme: [INK, OR] })
  drawSeal(ctx, true)
}

/** The volume (or the time) huge, the status as a band across. */
function scoreModel(ctx, h, v) {
  ground(ctx)
  const big = v.volume ? v.volume.replace(/\s*(t|kg|lb)$/, '') : v.time ? v.time.v : String(v.lifts.length)
  const unit = v.volume ? (/t$/.test(v.volume) ? 'TONELADAS LEVANTADAS' : /lb$/.test(v.volume) ? 'LIBRAS LEVANTADAS' : 'KG LEVANTADOS') : v.time ? (v.time.u === 'min' ? 'MINUTOS DE TREINO' : 'HORAS DE TREINO') : 'EXERCÍCIOS'
  text(ctx, v.title.toUpperCase(), W / 2, SAFE_TOP + 60, `800 ${fit(ctx, v.title.toUpperCase(), W - 160, 38, '800', FONT, 8)}px ${FONT}`, OR, 'center', 8)
  const z = fit(ctx, big, W - 120, 380, 'italic 900', FONT, -8)
  text(ctx, big, W / 2, SAFE_TOP + 70 + z * 0.86, `italic 900 ${z}px ${FONT}`, PAPER, 'center', -8)
  text(ctx, unit, W / 2, SAFE_TOP + 170 + z * 0.86, `italic 900 ${fit(ctx, unit, W - 160, 84)}px ${FONT}`, OR, 'center')
  let y = SAFE_TOP + 230 + z * 0.86
  if (v.status) {
    ctx.save(); ctx.translate(W / 2, y + 60); ctx.rotate(-0.1)
    ctx.fillStyle = OR; ctx.fillRect(-W, -46, W * 2, 92)
    ctx.fillStyle = INK; ctx.font = `italic 900 60px ${FONT}`; ctx.textBaseline = 'middle'
    const s = v.label.toUpperCase(), sw = ctx.measureText(s).width + 120
    for (let x = -W; x < W; x += sw) { h.drawIcon(ctx, v.status.id, x, -24, 48, INK); ctx.fillText(s, x + 58, 4) }
    ctx.restore()
    y += 190
  }
  if (v.up) { levelLine(ctx, v, 80, y + 50, OR); y += 96 }
  const rest = v.items.filter(([l]) => l !== (v.volume ? 'Volume' : 'Tempo'))
  y += statRow(ctx, rest, 80, y, W - 160, { box: true }) + (rest.length ? 30 : 0)
  const footY = SAFE_BOTTOM - 70
  liftRows(ctx, v, 80, y, W - 160, Math.floor((footY - y - 70) / 60))
  text(ctx, v.date, 80, footY + 30, `600 34px ${BODY}`, '#9a918a')
  if (v.pts) text(ctx, '+' + v.pts + ' pts', W - 80, footY + 30, `800 46px ${FONT}`, OR, 'right')
}

/** Orange above a slanted cut, black below; the card on the orange. */
function diagonalModel(ctx, h, v, a) {
  ground(ctx)
  ctx.fillStyle = OR; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, 560); ctx.lineTo(0, 900); ctx.closePath(); ctx.fill()
  if (v.card) drawRankCard(ctx, 860, SAFE_TOP + 230, 19, 7, v.card)
  text(ctx, v.up ? 'NÍVEL ' + v.up.to + ' ▲' : 'TREINO FEITO', 80, SAFE_TOP + 60, `800 38px ${FONT}`, INK, 'left', 8)
  const t = lines(ctx, v.title, W - 160 - (v.card ? 330 : 0), 150, 3)
  t.out.forEach((l, i) => text(ctx, l, 80, SAFE_TOP + 80 + t.z * 0.86 * (i + 1), `italic 900 ${t.z}px ${FONT}`, INK))
  let y = 940
  const footY = SAFE_BOTTOM - 90
  y += statRow(ctx, v.items, 80, y, W - 160) + 30
  let bottom = footY - 30
  if (v.pr.length) { bottom -= 96; prBox(ctx, v, 80, bottom, W - 160); bottom -= 20 }
  liftRows(ctx, v, 80, y, W - 160, Math.floor((bottom - y) / 60))
  footer(ctx, h, v, footY)
  if (v.pts && !v.pr.length && !v.status) text(ctx, '+' + v.pts + ' pts', W - 80, footY + 46, `800 46px ${FONT}`, OR, 'right')
  drawSeal(ctx)
}

/** CARGA in hollow letters behind, the workout in an orange frame. */
function outlineModel(ctx, h, v, a) {
  ground(ctx)
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.14)
  ctx.font = `italic 900 250px ${FONT}`; ctx.strokeStyle = 'rgba(255,107,0,.33)'; ctx.lineWidth = 3; ctx.textAlign = 'center'
  for (let i = -5; i <= 5; i++) ctx.strokeText('CARGA CARGA CARGA', i % 2 ? 120 : -60, i * 215)
  ctx.restore()
  const bx = 60, by = 540, bw = W - 120, bh = SAFE_BOTTOM - 20 - by
  ctx.save(); ctx.fillStyle = GROUND; ctx.strokeStyle = OR; ctx.lineWidth = 5
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 36); ctx.fill(); ctx.stroke(); ctx.restore()
  let y = by + 40
  const t = lines(ctx, v.title, bw - 100, 120, 2)
  t.out.forEach((l, i) => text(ctx, l, bx + 50, y + t.z * 0.88 * (i + 1), `italic 900 ${t.z}px ${FONT}`, PAPER))
  y += t.z * 0.88 * t.out.length + 40
  if (v.up) { levelLine(ctx, v, bx + 50, y + 50, OR); y += 96 }
  y += statRow(ctx, v.items, bx + 50, y, bw - 100) + 30
  const footY = by + bh - 110
  liftRows(ctx, v, bx + 50, y, bw - 100, Math.floor((footY - y - 10) / 60))
  const cw = chip(ctx, h, bx + 50, footY, v)
  const right = v.pts ? '+' + v.pts + ' pts' : v.date
  if (right) text(ctx, right, cw ? bx + bw - 50 : bx + 50, footY + 46, v.pts ? `800 46px ${FONT}` : `600 34px ${BODY}`, v.pts ? OR : '#9a918a', cw ? 'right' : 'left')
  drawSeal(ctx)
}

/** The person's photo, an orange slash, the workout on a dark panel. */
function bandModel(ctx, h, v, a, photo) {
  ground(ctx, '#2b3138')
  if (photo) {
    const s = Math.max(W / photo.width, H / photo.height)
    ctx.drawImage(photo, (W - photo.width * s) / 2, (H - photo.height * s) / 2, photo.width * s, photo.height * s)
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#3a3f47'); g.addColorStop(0.45, '#1c1f24'); g.addColorStop(1, '#3b2414')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  }
  chip(ctx, h, 80, SAFE_TOP + 10, v, ['rgba(13,10,9,.75)', '#ff8a3d'])
  // the lower part in CARGA orange, cut on a slant, a black slash along the cut
  const g = ctx.createLinearGradient(0, 900, W, H); g.addColorStop(0, '#ff7a1a'); g.addColorStop(1, '#ff4d00')
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 990); ctx.lineTo(W, 918); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill()
  ctx.save(); ctx.translate(W / 2, 954); ctx.rotate(-0.0665); ctx.fillStyle = INK; ctx.fillRect(-W, -16, W * 2, 32); ctx.restore()
  const sub = 'rgba(18,8,0,.62)'
  let y = 1040
  if (v.up) {
    ctx.save(); ctx.font = `italic 900 56px ${FONT}`; ctx.fillStyle = INK
    ctx.beginPath(); ctx.moveTo(80, y + 40); ctx.lineTo(100, y + 4); ctx.lineTo(120, y + 40); ctx.closePath(); ctx.fill()
    ctx.fillText('SUBIU DE NÍVEL  ' + v.up.from + ' → ' + v.up.to, 132, y + 40); ctx.restore()
    y += 80
  }
  const z = fit(ctx, v.title.toUpperCase(), W - 160, 104)
  text(ctx, v.title.toUpperCase(), 80, y + z * 0.86, `italic 900 ${z}px ${FONT}`, INK); y += z + 20
  y += statRow(ctx, v.items, 80, y, W - 160, { ink: INK, sub }) + 26
  const footY = SAFE_BOTTOM - 60
  liftRows(ctx, v, 80, y, W - 160, Math.floor((footY - y - 70) / 58), { ink: INK, sub: INK, rule: 'rgba(18,8,0,.22)', rowH: 58, size: 38 })
  text(ctx, v.date, 80, footY + 30, `600 32px ${BODY}`, sub)
  if (v.pts) text(ctx, '+' + v.pts + ' pts', W - 80, footY + 30, `800 46px ${FONT}`, INK, 'right')
  drawSeal(ctx, true)
}

/** Draws gym model `id` (one of the new ones); false when it is not one of them. */
export function drawGymModel(ctx, id, a, show, photo, helpers) {
  const m = GYM_MODELS.find(x => x.id === id)
  const draw = { rank: rankModel, corner: cornerModel, levelup: levelModel, poster: posterModel, score: scoreModel, diagonal: diagonalModel, outline: outlineModel, band: bandModel }[id]
  if (!m || !draw) return false
  draw(ctx, helpers, view(a, show, m.uses), a, photo)
  return true
}
