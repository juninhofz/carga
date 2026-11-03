// The opening: a lifter strains a loaded bar overhead, the camera pushes in on the grind and pulls
// back at lockout, and the load bends the bar into the C of the CARGA mark (lib/carga-mark.js).
// Plain DOM on an <svg viewBox="0 0 240 240">: components/OpeningSplash.jsx owns the timing.
//
// Two cuts: `full` (the first launch, and the first after an update) and `quick` (every other
// launch), which starts with the bar already overhead and only bends it into the C.
import { CX, CY, C_RADIUS, MARK_SCALE, MARK_SHIFT, BAR_WIDTH, COLORS, barPoint, barPath, platesAt } from './carga-mark.js'

const NS = 'http://www.w3.org/2000/svg'
const clamp = v => (v < 0 ? 0 : v > 1 ? 1 : v)
const span = (t, a, b) => clamp((t - a) / (b - a))
const inOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const outBack = x => { const c = 1.5; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2) }

export function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
  const ch = sh => Math.round(((pa >> sh) & 255) + (((pb >> sh) & 255) - ((pa >> sh) & 255)) * t)
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)
}

const NEVER = [-2, -1]
export const CUTS = {
  full: { total: 2500, in: [0, 150], lift: [150, 1350], camIn: [450, 850], camOut: [1300, 1550], strainOut: [1350, 1500], bend: [1400, 1900], fig: [1450, 1800], color: [1450, 1900], turn: [1900, 2250], word: [2150, 2500] },
  quick: { total: 900, in: [0, 0], lift: NEVER, camIn: NEVER, camOut: NEVER, strainOut: NEVER, bend: [0, 450], fig: NEVER, color: [0, 450], turn: [400, 700], word: [600, 900] },
}
const CAM_ZOOM = 0.45
const CAM_FOCUS = [120, 90]          // the face and the bar during the grind
const LIFT = [104, 44]               // the bar's top: on the shoulders, then locked out

// How far up the bar is (0 shoulders, 1 locked out): a quick start, a long grind, then the lockout.
function pressAt(u) {
  if (u < 0.3) return 0.42 * inOut(u / 0.3)
  if (u < 0.72) return 0.42 + 0.1 * ((u - 0.3) / 0.42)
  return 0.52 + 0.48 * inOut((u - 0.72) / 0.28)
}

/** The opening at time t (ms) of a cut, as the numbers build() poses. */
export function openingScene(t, cut = 'full') {
  const T = CUTS[cut]
  const fadeIn = T.in[1] ? span(t, T.in[0], T.in[1]) : 0
  const u = span(t, T.lift[0], T.lift[1])
  const press = pressAt(u)
  const grind = u > 0.3 && u < 0.72 ? 1 : 0
  const bend = inOut(span(t, T.bend[0], T.bend[1]))
  // The strain shows in the bar's flex, the knees and the marks by the head; the picture never shakes.
  const strain = (u > 0 && u < 1 ? (1 + 1.4 * grind) * 1.5 : u >= 1 ? 1.5 : 0) * (1 - span(t, T.strainOut[0], T.strainOut[1]))
  let top = LIFT[0] + (LIFT[1] - LIFT[0]) * press
  top += (CY - C_RADIUS - LIFT[1]) * bend
  let k = 0.03 + 0.09 * press + 0.02 * Math.sin(t * 0.06) * (strain / 2)
  k += (1 - k) * bend
  const turn = outBack(span(t, T.turn[0], T.turn[1]))
  const color = span(t, T.color[0], T.color[1])
  return {
    cam: inOut(span(t, T.camIn[0], T.camIn[1])) * (1 - inOut(span(t, T.camOut[0], T.camOut[1]))),
    figOp: fadeIn * (1 - span(t, T.fig[0], T.fig[1])),
    sink: 14 * span(t, T.fig[0], T.fig[1]),
    knee: 4 + 7 * (strain / 3.6),
    duck: 4 * (1 - press) + grind * 1.5,
    effort: clamp(strain / 2.2) * (0.6 + 0.4 * Math.abs(Math.sin(t * 0.02))),
    top, k,
    bw: 9 + (BAR_WIDTH - 9) * bend,
    rot: -90 * turn,
    scale: 1 + (MARK_SCALE - 1) * turn,
    shift: MARK_SHIFT * turn,
    barColor: mixHex('#e6e6e6', COLORS.bar, color),
    plateColor: mixHex(COLORS.bar, COLORS.plate, color),
    word: span(t, T.word[0], T.word[1]),
  }
}

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag)
  for (const k in attrs) e.setAttribute(k, attrs[k])
  if (parent) parent.appendChild(e)
  return e
}
const line = (parent, w) => el('path', { fill: 'none', stroke: '#ffffff', 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent)
const poly = (node, pts) => node.setAttribute('d', pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(''))
// elbows drop and flare while the bar is low, straighten at lockout
function elbow(sh, h, side) {
  const low = clamp((h[1] - 48) / 64)
  return [(sh[0] + h[0]) / 2 + side * (6 + low * 18), (sh[1] + h[1]) / 2 + low * 16]
}
const SIDES = [-1, 1]

/** Draws the scene into `svg` (viewBox 0 0 240 240); returns pose(scene). */
export function buildOpening(svg) {
  svg.textContent = ''
  const cam = el('g', {}, svg)
  const fig = el('g', {}, cam)
  // the lifter: white, in fairly thin strokes, light next to the heavy bar
  const legs = SIDES.map(() => line(fig, 11))
  el('path', { d: 'M102 110 L138 110 L132 159 L108 159 Z', fill: '#ffffff', stroke: '#ffffff', 'stroke-width': 7, 'stroke-linejoin': 'round' }, fig)
  const neck = el('rect', { x: 115.5, y: 97, width: 9, height: 12, rx: 3, fill: '#ffffff' }, fig)
  const head = el('circle', { cx: 120, cy: 90, r: 11.5, fill: '#ffffff' }, fig)
  const effort = el('path', { d: 'M100 80 l-9 -6 M98 91 l-11 0 M100 102 l-9 6 M140 80 l9 -6 M142 91 l11 0 M140 102 l9 6', fill: 'none', stroke: '#ff9500', 'stroke-width': 3, 'stroke-linecap': 'round' }, fig)
  const arms = SIDES.map(() => line(fig, 9.5))
  const hands = SIDES.map(() => el('circle', { r: 6, fill: '#ffffff' }, fig))
  const bb = el('g', {}, cam)
  const bar = el('path', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, bb)
  const plates = platesAt(0, 0).map(p => el('rect', { x: -p.w / 2, y: -p.h / 2, width: p.w, height: p.h, rx: 2, stroke: COLORS.ground, 'stroke-width': 2.5, 'paint-order': 'stroke' }, bb))

  return sc => {
    const z = 1 + CAM_ZOOM * sc.cam
    cam.setAttribute('transform', `translate(${CAM_FOCUS[0]} ${CAM_FOCUS[1]}) scale(${z.toFixed(3)}) translate(${-CAM_FOCUS[0]} ${-CAM_FOCUS[1]})`)
    fig.setAttribute('opacity', sc.figOp)
    fig.setAttribute('transform', `translate(0 ${sc.sink.toFixed(2)})`)
    if (sc.figOp > 0) {
      head.setAttribute('cy', (90 + sc.duck).toFixed(1))
      neck.setAttribute('y', (97 + sc.duck).toFixed(1))
      effort.setAttribute('transform', `translate(0 ${(sc.duck - 2).toFixed(1)})`)
      effort.setAttribute('opacity', sc.effort)
      SIDES.forEach((side, i) => {
        poly(legs[i], [[120 + side * 8, 160], [120 + side * (17 + sc.knee), 195], [120 + side * 18, 228], [120 + side * 26, 229]])
        const p = barPoint(side * 30, sc.k, sc.top), h = [p[0], p[1] - sc.sink]
        const sh = [120 + side * 18, 114]
        poly(arms[i], [sh, elbow(sh, h, side), h])
        hands[i].setAttribute('cx', h[0].toFixed(2)); hands[i].setAttribute('cy', h[1].toFixed(2))
      })
    }
    bar.setAttribute('d', barPath(sc.k, sc.top))
    bar.setAttribute('stroke', sc.barColor)
    bar.setAttribute('stroke-width', sc.bw.toFixed(2))
    platesAt(sc.k, sc.top).forEach((p, i) => {
      plates[i].setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.deg.toFixed(2)})`)
      plates[i].setAttribute('fill', sc.plateColor)
    })
    bb.setAttribute('transform', `translate(${(CX + sc.shift).toFixed(2)} ${CY}) rotate(${sc.rot.toFixed(2)}) scale(${sc.scale.toFixed(3)}) translate(${-CX} ${-CY})`)
  }
}
