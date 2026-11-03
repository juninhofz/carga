// The CARGA mark: a loaded barbell bent a half turn into a C, three plates standing on each
// sleeve. One geometry for every place the mark is drawn: the opening (lib/carga-opening.js), the
// static mark (components/CargaMark.jsx), share cards (lib/card-draw.js), printouts
// (lib/print-doc.js) and the app icons (scripts/carga-icons.mjs).
//
// The bar is BAR units long. Between the collars (±COLLAR from the middle) it can bend into an
// arc that droops at the ends; past them the loaded sleeves run on straight, so the plates on a
// sleeve stay parallel. Fully bent (k = 1) the middle wraps a half turn and the sleeves end up
// parallel: turned a quarter, that is the C.

export const BAR = 200
export const COLLAR = 72
export const WRAP = Math.PI
// Biggest plate on the inside, as they are loaded on a real bar.
export const PLATES = [{ s: 79, w: 10, h: 46 }, { s: 88, w: 8, h: 35 }, { s: 95, w: 6, h: 24 }]
// Everything is drawn in a 240-unit square; the finished C is centred on (CX, CY).
export const CX = 120, CY = 120
export const C_RADIUS = 2 * COLLAR / WRAP
export const MARK_SCALE = 1.45      // the finished C, scaled up into the square
export const MARK_SHIFT = 12        // its bowl sits left of its circle's centre: back to the middle
export const BAR_WIDTH = 16         // the finished C's stroke, before MARK_SCALE

export const COLORS = { bar: '#ff6b00', plate: '#ffffff', ground: '#0d0d0d' }

/** The bar point at distance s from the middle, bent by k (0 straight, 1 the C), top at `top`: [x, y, angle°]. */
export function barPoint(s, k, top) {
  const phi = k * WRAP
  if (phi < 1e-4) return [CX + s, top, 0]
  const side = s < 0 ? -1 : 1, as = Math.abs(s)
  const R = 2 * COLLAR / phi, a = Math.min(as, COLLAR) / R
  let x = R * Math.sin(a), y = R * (1 - Math.cos(a))
  if (as > COLLAR) { x += (as - COLLAR) * Math.cos(a); y += (as - COLLAR) * Math.sin(a) }
  return [CX + side * x, top + y, side * a * 180 / Math.PI]
}

/** The bar as an SVG path, sampled every 4 units. */
export function barPath(k, top) {
  let d = ''
  for (let s = -BAR / 2; s <= BAR / 2 + 0.01; s += 4) {
    const [x, y] = barPoint(s, k, top)
    d += (d ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2)
  }
  return d
}

/** Each plate on both sleeves: { x, y, deg, w, h }. */
export function platesAt(k, top) {
  const out = []
  for (const p of PLATES) for (const side of [-1, 1]) {
    const [x, y, deg] = barPoint(p.s * side, k, top)
    out.push({ x, y, deg, w: p.w, h: p.h })
  }
  return out
}

// The finished C: fully bent, centred on the circle, turned a quarter and scaled into the square.
export const MARK_TOP = CY - C_RADIUS
export const MARK_TRANSFORM = `translate(${CX + MARK_SHIFT} ${CY}) rotate(-90) scale(${MARK_SCALE}) translate(${-CX} ${-CY})`
// The finished C's own box inside the square, for places that show the mark alone.
export const MARK_VIEWBOX = '50 16 140 208'
export const MARK_ASPECT = 140 / 208

/**
 * The finished C as an SVG string. `ground` is the colour behind it: a hairline of it around each
 * plate keeps the plates apart where they touch. `viewBox` defaults to the mark's own box. The
 * colours go in style="" so a CSS variable works too (var(--label) follows the app's theme).
 */
export function markSVG({ bar = COLORS.bar, plate = COLORS.plate, ground = COLORS.ground, viewBox = MARK_VIEWBOX, cls = '', title = '' } = {}) {
  const plates = platesAt(1, MARK_TOP).map(p =>
    `<rect x="${-p.w / 2}" y="${-p.h / 2}" width="${p.w}" height="${p.h}" rx="2" transform="translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.deg.toFixed(2)})" style="fill:${plate};stroke:${ground}" stroke-width="2.5" paint-order="stroke"/>`).join('')
  return `<svg${cls ? ` class="${cls}"` : ''} xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${title ? ` role="img" aria-label="${title}"` : ' aria-hidden="true"'}>`
    + `<g transform="${MARK_TRANSFORM}"><path d="${barPath(1, MARK_TOP)}" fill="none" style="stroke:${bar}" stroke-width="${BAR_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>${plates}</g></svg>`
}

/**
 * The finished C on a canvas, `h` high, its left edge at x, centred on y. Plain moveTo/lineTo and
 * rects, so it draws on any 2D context (the share cards are drawn in a worker on some phones).
 */
export function drawMarkOn(ctx, x, y, h, { bar = COLORS.bar, plate = COLORS.plate, ground = COLORS.ground } = {}) {
  const s = h / 208                                   // the mark's box is 140 × 208 units
  ctx.save()
  ctx.translate(x - 50 * s, y - 120 * s)              // its box starts at (50, 16); y is its centre
  ctx.scale(s, s)
  ctx.translate(CX + MARK_SHIFT, CY); ctx.rotate(-Math.PI / 2); ctx.scale(MARK_SCALE, MARK_SCALE); ctx.translate(-CX, -CY)
  ctx.beginPath()
  for (let t = -BAR / 2; t <= BAR / 2 + 0.01; t += 4) {
    const [px, py] = barPoint(t, 1, MARK_TOP)
    if (t === -BAR / 2) ctx.moveTo(px, py); else ctx.lineTo(px, py)
  }
  ctx.strokeStyle = bar; ctx.lineWidth = BAR_WIDTH; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.stroke()
  for (const p of platesAt(1, MARK_TOP)) {
    ctx.save()
    ctx.translate(p.x, p.y); ctx.rotate(p.deg * Math.PI / 180)
    ctx.fillStyle = ground; ctx.fillRect(-p.w / 2 - 1.25, -p.h / 2 - 1.25, p.w + 2.5, p.h + 2.5)
    ctx.fillStyle = plate; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
    ctx.restore()
  }
  ctx.restore()
}
