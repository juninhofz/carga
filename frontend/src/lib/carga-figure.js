// CARGA's own exercise animations: one solid orange figure, drawn in code, that performs the
// movement while a heat map glows on the muscles the exercise works. It stands in for the
// shipped media, which this build does not carry (lib/brand.js OWN_FIGURES).
//
// Every built-in exercise is sorted into one of a few dozen movements (moveOf) by its name,
// falling back to its target muscle and body part; the equipment picks what the hands hold.
// The heat comes from the same muscle weights every muscle map uses (lib/muscles.js), so a
// correction there shows up here too.
//
// Two rigs draw the figure. The front rig is the standing figure with arms that move at the
// shoulder and elbow (presses, raises, pull-ups). The side rig faces right with a jointed trunk,
// both legs and both arms, the far ones a shade darker behind the body. Every piece of one rig
// is the same flat orange, so no join between the pieces shows; the heat sits on its own layer,
// masked by the body, so it fades across a joint instead of stopping at it.

import { musclesOf } from './muscles.js'
import MOVE_TABLE from './carga-moves.json' with { type: 'json' }

const NS = 'http://www.w3.org/2000/svg'
const ORANGE = '#ff6b00'
const FAR = '#c95400'
const SEAT = '#3d3d3d'
const POST = '#2b2b2b'
const rad = Math.PI / 180
const lerp = (a, b, t) => a + (b - a) * t
const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]
let uid = 0

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag)
  for (const k in attrs) e.setAttribute(k, attrs[k])
  if (parent) parent.appendChild(e)
  return e
}
// A tapered limb along +x from 0 to L: radius r0 at the root, r1 at the tip, bN and bP bulge
// the -y and +y sides (on a leg or arm, +y is the back of the limb).
function limb(L, r0, r1, bN, bP) {
  return 'M0 ' + (-r0) + 'C' + (L * 0.32) + ' ' + (-r0 - bN) + ' ' + (L * 0.72) + ' ' + (-r1 - bN * 0.5) + ' ' + L + ' ' + (-r1) +
    'A' + r1 + ' ' + r1 + ' 0 0 1 ' + L + ' ' + r1 +
    'C' + (L * 0.72) + ' ' + (r1 + bP * 0.5) + ' ' + (L * 0.32) + ' ' + (r0 + bP) + ' 0 ' + r0 +
    'A' + r0 + ' ' + r0 + ' 0 0 1 0 ' + (-r0) + 'Z'
}
// A closed Catmull-Rom curve through the points.
function smooth(pts) {
  const n = pts.length
  let d = 'M' + pts[0][0] + ' ' + pts[0][1]
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    d += 'C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' +
      (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' + p2[0] + ' ' + p2[1]
  }
  return d + 'Z'
}
const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) / rad
const along = (a, deg, L) => [a[0] + L * Math.cos(deg * rad), a[1] + L * Math.sin(deg * rad)]
// a point given in a rotated frame (u along the angle, v across it) back in the picture
const local = (origin, deg, u, v) => {
  const c = Math.cos(deg * rad), s = Math.sin(deg * rad)
  return [origin[0] + u * c - v * s, origin[1] + u * s + v * c]
}
// How far the second bone turns from the first, in -180..180 degrees.
const turn = (a, b, c) => ((ang(b, c) - ang(a, b)) % 360 + 540) % 360 - 180
// The figure faces right, so an elbow closes by turning the forearm the negative way (towards the
// front of the upper arm) and a knee by turning the shin the positive way (to the back of the
// thigh). The other way is a joint bent backwards; a few degrees of a straight limb pass.
const elbowBends = (sh, elbow, hand) => turn(sh, elbow, hand) <= 6
const kneeBends = (hip, knee, ankle) => turn(hip, knee, ankle) >= -6
// Two-bone reach from S towards H: where the middle joint sits, bent to side s (+1 or -1).
function ik(S, H, a, b, s) {
  let d = Math.hypot(H[0] - S[0], H[1] - S[1])
  d = Math.min(Math.max(d, Math.abs(a - b) + 1), a + b - 0.5)
  const base = Math.atan2(H[1] - S[1], H[0] - S[0])
  const al = Math.acos((a * a + d * d - b * b) / (2 * a * d))
  return [S[0] + a * Math.cos(base + s * al), S[1] + a * Math.sin(base + s * al)]
}
const place = (g, at, deg, flip) => g && g.setAttribute('transform',
  'translate(' + at[0].toFixed(2) + ' ' + at[1].toFixed(2) + ') rotate(' + deg.toFixed(2) + ')' + (flip ? ' scale(1 ' + flip + ')' : ''))

function paints(defs, k) {
  const steel = el('linearGradient', { id: k + 'st', x1: 0, y1: 0, x2: 0, y2: 1 }, defs)
  el('stop', { offset: 0, 'stop-color': '#ffffff' }, steel)
  el('stop', { offset: 1, 'stop-color': '#c9cdd3' }, steel)
  // the heat map: hot white-yellow at the core of a worked muscle, cooling to the body's orange
  const heat = el('radialGradient', { id: k + 'h' }, defs)
  ;[[0, '#fffbe6', 1], [0.3, '#ffe066', 0.95], [0.62, '#ffa62b', 0.55], [1, '#ff6b00', 0]].forEach(([o, c, a]) =>
    el('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, heat))
  return { steel: 'url(#' + k + 'st)', heat: 'url(#' + k + 'h)' }
}

// ---------- what the hands hold ----------
// Seen end on, the way a bar or a dumbbell held across the body looks from the side.
function heldProp(parent, prop, c) {
  const g = el('g', {}, parent)
  if (prop === 'bar') {
    el('circle', { r: 34, fill: c.steel }, g)
    el('circle', { r: 24, fill: 'none', stroke: 'rgba(0,0,0,.10)', 'stroke-width': 3 }, g)
    el('circle', { r: 6, fill: '#9aa0a8' }, g)
  } else if (prop === 'plate') {
    el('circle', { r: 24, fill: c.steel }, g)
    el('circle', { r: 6, fill: '#9aa0a8' }, g)
  } else if (prop === 'db') {
    el('circle', { r: 16, fill: c.steel }, g)
    el('circle', { r: 4.5, fill: '#9aa0a8' }, g)
  } else if (prop === 'kb') {
    el('path', { d: 'M-9 4C-9 -10 9 -10 9 4', fill: 'none', stroke: '#d5d8dd', 'stroke-width': 5, 'stroke-linecap': 'round' }, g)
    el('circle', { cx: 0, cy: 20, r: 17, fill: c.steel }, g)
  } else if (prop === 'ball') {
    el('circle', { r: 22, fill: c.steel }, g)
    el('path', { d: 'M-22 0Q0 9 22 0', fill: 'none', stroke: 'rgba(0,0,0,.14)', 'stroke-width': 2 }, g)
  } else if (prop === 'cable') {
    el('rect', { x: -4, y: -11, width: 8, height: 22, rx: 3, fill: '#d5d8dd' }, g)
  } else return null
  return g
}
// A dumbbell seen from the front, the bar across the hand.
function dumbbellSide(parent, steel) {
  const g = el('g', {}, parent)
  el('rect', { x: -27, y: -4, width: 54, height: 8, rx: 4, fill: steel }, g)
  ;[-1, 1].forEach(q => {
    el('rect', { x: q * 22 - 6.5, y: -21, width: 13, height: 42, rx: 4.5, fill: steel }, g)
    el('rect', { x: q * 33 - 4, y: -14, width: 8, height: 28, rx: 3, fill: steel }, g)
  })
  return g
}

// ---------- the scenery a movement needs ----------
function scene(svg, kind, q) {
  const r = (x, y, w, h, fill, rx = 4) => el('rect', { x, y, width: w, height: h, rx, fill }, svg)
  if (kind === 'bench') { r(78, 444, 12, 138, POST, 3); r(262, 444, 12, 138, POST, 3); r(40, 430, 268, 18, SEAT, 6) }
  else if (kind === 'incline') {
    r(250, 444, 12, 138, POST, 3); r(92, 470, 12, 112, POST, 3)
    el('rect', { x: 0, y: 0, width: 190, height: 18, rx: 6, fill: SEAT, transform: 'translate(296 430) rotate(' + (q || 205) + ')' }, svg)
    r(220, 430, 90, 18, SEAT, 6)
  } else if (kind === 'prone') { r(150, 540, 12, 42, POST, 3); r(380, 540, 12, 42, POST, 3); r(110, 526, 330, 18, SEAT, 6) }
  else if (kind === 'seat') { r(164, 506, 14, 76, POST, 3); r(112, 494, 128, 16, SEAT, 6); r(96, 300, 16, 210, SEAT, 6) }
  else if (kind === 'thrust') { r(30, 444, 12, 138, POST, 3); r(10, 426, 120, 18, SEAT, 6) }
  else if (kind === 'legpress') {
    el('rect', { x: -10, y: -10, width: 210, height: 20, rx: 6, fill: SEAT, transform: 'translate(160 492) rotate(-140)' }, svg)
    r(120, 492, 110, 16, SEAT, 6); r(166, 506, 14, 76, POST, 3)
  } else if (kind === 'box') { r(236, 500, 120, 80, SEAT, 6); r(236, 500, 120, 6, '#4a4a4a', 3) }
}
// The machine a cable or lever exercise works against: a weight stack behind the figure.
function stack(svg, x, top) {
  el('rect', { x, y: top, width: 46, height: 582 - top, rx: 6, fill: POST }, svg)
  for (let i = 0; i < 9; i++) el('rect', { x: x + 7, y: 470 + i * 12, width: 32, height: 9, rx: 2, fill: '#4a4a4a' }, svg)
  el('circle', { cx: x + 23, cy: top + 16, r: 9, fill: '#4a4a4a' }, svg)
}

// ---------- the front rig ----------
// the figure's left half from the neck to the crotch; the right half is its mirror
const HALF = [[188, 106], [178, 118], [158, 128], [140, 138], [133, 152], [140, 170], [149, 184], [151, 214], [158, 250], [165, 278], [158, 304], [151, 332], [148, 372], [152, 418], [158, 446], [152, 478], [151, 510], [160, 545], [164, 562], [146, 571], [149, 581], [186, 581], [184, 565], [180, 530], [179, 498], [183, 462], [187, 440], [192, 400], [195, 362], [200, 344]]
const OUTLINE = HALF.concat(HALF.map(p => [400 - p[0], p[1]]).reverse().slice(1))
const SH = { L: [148, 150], R: [252, 150] }
const F_UPPER = 80, F_FORE = 78
// Muscles as seen from the front, in the picture's own coordinates; the left side is mirrored.
const FRONT_BODY = {
  trapezius: [[200, 130, 58, 26]], chest: [[172, 176, 28, 19], [228, 176, 28, 19]],
  serratus: [[156, 206, 10, 16], [244, 206, 10, 16]], 'upper-back': [[150, 214, 12, 34], [250, 214, 12, 34]],
  abs: [[200, 252, 26, 52]], obliques: [[164, 262, 13, 32], [236, 262, 13, 32]],
  gluteal: [[160, 330, 14, 18], [240, 330, 14, 18]], 'hip-flexors': [[178, 344, 12, 12], [222, 344, 12, 12]],
  quadriceps: [[170, 420, 18, 48], [230, 420, 18, 48]], adductors: [[188, 400, 8, 30], [212, 400, 8, 30]],
  hamstring: [[160, 430, 8, 26], [240, 430, 8, 26]], calves: [[164, 505, 10, 26], [236, 505, 10, 26]],
  tibialis: [[173, 512, 6, 22], [227, 512, 6, 22]], 'lower-back': [[200, 300, 30, 12]],
}
const FRONT_UPPER = { deltoids: [[6, 0, 34, 26]], biceps: [[50, -6, 28, 10]], triceps: [[52, 8, 30, 10]] }
const FRONT_FORE = { forearm: [[30, 0, 30, 9]] }

function spots(parent, table, weights, fill) {
  let any = false
  for (const m in table) {
    const w = weights[m]
    if (!(w > 0)) continue
    any = true
    table[m].forEach(s => el('ellipse', { cx: s[0], cy: s[1], rx: s[2], ry: s[3], fill, opacity: Math.min(1, w).toFixed(2) }, parent))
  }
  return any
}

function frontRig(svg, defs, k, c, mv, prop, weights) {
  const shadow = el('ellipse', { cx: 200, cy: 586, rx: 64, ry: 9, fill: 'rgba(0,0,0,.5)' }, svg)
  if (mv.hang) { shadow.remove(); el('rect', { x: 40, y: -14, width: 320, height: 9, rx: 4.5, fill: '#d5d8dd' }, svg) }
  const all = el('g', {}, svg)
  const fig = el('g', { fill: ORANGE }, all)
  el('path', { d: smooth(OUTLINE) }, fig)
  const clip = el('clipPath', { id: k + 'tc' }, defs)
  el('path', { d: smooth(OUTLINE) }, clip)
  const heats = []
  const bodyHeat = el('g', { 'clip-path': 'url(#' + k + 'tc)' }, fig)
  spots(bodyHeat, FRONT_BODY, weights, c.heat)
  heats.push(bodyHeat)
  el('ellipse', { cx: 200, cy: 70, rx: 23, ry: 28 }, fig)
  const bar = prop === 'bar' ? el('g', {}, all) : null
  if (bar) {
    el('rect', { x: -150, y: -4, width: 300, height: 8, rx: 4, fill: c.steel }, bar)
    ;[-1, 1].forEach(q => el('rect', { x: q * 128 - 7, y: -30, width: 14, height: 60, rx: 5, fill: c.steel }, bar))
  }
  const arms = {}
  ;['L', 'R'].forEach(s => {
    const upper = el('g', {}, fig), fore = el('g', {}, fig)
    el('path', { d: limb(F_UPPER, 18, 12, 5, 4) }, upper)
    el('circle', { cx: 2, cy: 0, r: 19 }, upper)
    const ac = el('clipPath', { id: k + 'ac' + s }, defs)
    el('path', { d: limb(F_UPPER, 18, 12, 5, 4) }, ac)
    el('circle', { cx: 2, cy: 0, r: 19 }, ac)
    const uh = el('g', { 'clip-path': 'url(#' + k + 'ac' + s + ')' }, upper)
    spots(uh, FRONT_UPPER, weights, c.heat)
    el('path', { d: limb(F_FORE, 12.5, 8, 3, 2) }, fore)
    el('ellipse', { cx: F_FORE + 6, cy: 0, rx: 11, ry: 9.5 }, fore)
    const fc = el('clipPath', { id: k + 'fc' + s }, defs)
    el('path', { d: limb(F_FORE, 12.5, 8, 3, 2) }, fc)
    const fh = el('g', { 'clip-path': 'url(#' + k + 'fc' + s + ')' }, fore)
    spots(fh, FRONT_FORE, weights, c.heat)
    heats.push(uh, fh)
    let held = null
    if (prop === 'db') held = mv.endOn ? heldProp(all, 'db', c) : dumbbellSide(all, c.steel)
    else if (prop === 'kb' || prop === 'plate' || prop === 'ball' || prop === 'cable') held = heldProp(all, prop === 'ball' || prop === 'plate' ? 'db' : prop, c)
    const cable = prop === 'cable' ? el('line', { stroke: '#8a8f96', 'stroke-width': 2.5 }, all) : null
    if (cable) all.insertBefore(cable, all.firstChild)
    arms[s] = { upper, fore, held, cable }
  })
  const handOf = (q, s) => {
    const m = s === 'L' ? 1 : -1, sh = SH[s], a = q.up * rad, b = (q.up + q.fore) * rad
    const e = [sh[0] - m * F_UPPER * Math.sin(a), sh[1] + F_UPPER * Math.cos(a)]
    return [e, [e[0] - m * (F_FORE + 6) * Math.sin(b), e[1] + (F_FORE + 6) * Math.cos(b)]]
  }
  // hanging from a bar, the hands stay where they hold it and the body is what moves
  const grip = mv.hang ? handOf(mv.pose(0), 'L')[1][1] : 0
  const vb = mv.box.split(' ').map(Number)
  return p => {
    const q = mv.pose(p)
    heats.forEach(h => h.setAttribute('opacity', (0.5 + 0.5 * p).toFixed(3)))
    const lift = mv.hang ? grip - handOf(q, 'L')[1][1] : (q.lift || 0)
    all.setAttribute('transform', 'translate(0 ' + lift.toFixed(2) + ')' + (q.tilt ? ' rotate(' + q.tilt.toFixed(2) + ' 200 340)' : ''))
    const hands = {}
    ;['L', 'R'].forEach(s => {
      const A = arms[s], m = s === 'L' ? 1 : -1, sh = [SH[s][0], SH[s][1] + (q.shrug || 0)]
      const [e0, h0] = handOf(q, s)
      const e = [e0[0], e0[1] + (q.shrug || 0)], h = [h0[0], h0[1] + (q.shrug || 0)]
      place(A.upper, sh, ang(sh, e), -m)
      place(A.fore, e, ang(e, h), -m)
      if (A.held) A.held.setAttribute('transform', 'translate(' + h[0].toFixed(1) + ' ' + h[1].toFixed(1) + ')')
      if (A.cable) {
        A.cable.setAttribute('x1', h[0].toFixed(1)); A.cable.setAttribute('y1', h[1].toFixed(1))
        A.cable.setAttribute('x2', 200 - m * 150); A.cable.setAttribute('y2', (mv.cableHigh ? vb[1] + 8 : vb[1] + vb[3] - 8) - lift)
      }
      hands[s] = h
    })
    if (bar) bar.setAttribute('transform', 'translate(200 ' + ((hands.L[1] + hands.R[1]) / 2).toFixed(1) + ')')
  }
}

// ---------- the side rig ----------
const T = 170, THIGH = 100, SHIN = 96, UPPER = 74, FORE = 70
// the trunk in its own frame: u runs up the spine from the hip joint, v points to the front
const TORSO = [[-4, 18], [10, 26], [40, 25], [70, 22], [95, 27], [115, 33], [135, 34], [152, 28], [164, 18], [172, 11], [180, 8], [180, -10],
  [170, -15], [158, -24], [135, -29], [108, -26], [80, -19], [55, -17], [35, -24], [15, -34], [-4, -34], [-16, -22], [-18, -4], [-12, 10]]
// Muscles on each piece, in that piece's own frame.
const SIDE = {
  torso: {
    trapezius: [[162, -16, 22, 12]], chest: [[128, 24, 32, 16]], 'upper-back': [[108, -22, 44, 14]], serratus: [[112, 14, 18, 10]],
    abs: [[70, 20, 36, 10]], obliques: [[70, 4, 30, 12]], 'lower-back': [[52, -17, 26, 9]], gluteal: [[4, -26, 30, 24]], 'hip-flexors': [[4, 18, 14, 10]],
  },
  thigh: { quadriceps: [[50, -9, 46, 14]], hamstring: [[50, 10, 42, 11]], adductors: [[40, 0, 30, 8]] },
  shin: { calves: [[30, 8, 30, 10]], tibialis: [[36, -6, 28, 6]] },
  upper: { deltoids: [[4, 0, 22, 18]], biceps: [[42, -8, 30, 10]], triceps: [[42, 8, 30, 10]] },
  fore: { forearm: [[22, 0, 26, 9]] },
}

// Where the joints of one leg and one arm land for a pose.
const legOf = (L, hip) => {
  let knee, ankle
  if (L.thigh != null) { knee = along(hip, L.thigh, THIGH); ankle = along(knee, L.shin, SHIN) }
  else {
    knee = ik(hip, L.ankle, THIGH, SHIN, L.knee || -1)
    if (!kneeBends(hip, knee, L.ankle)) knee = ik(hip, L.ankle, THIGH, SHIN, -(L.knee || -1))
    ankle = along(knee, ang(knee, L.ankle), SHIN)
  }
  const foot = L.foot != null ? L.foot : L.thigh != null ? ang(knee, ankle) - 90 : 0
  return { knee, ankle, foot }
}
const armOf = (A, sh) => {
  let elbow, hand
  if (A.hand && A.straight) { const d = ang(sh, A.hand); elbow = along(sh, d, UPPER); hand = along(elbow, d, FORE + 4) }
  else if (A.hand) {
    elbow = ik(sh, A.hand, UPPER, FORE + 4, A.elbow || 1)
    if (!elbowBends(sh, elbow, A.hand)) elbow = ik(sh, A.hand, UPPER, FORE + 4, -(A.elbow || 1))
    hand = along(elbow, ang(elbow, A.hand), FORE + 4)
  }
  else { elbow = along(sh, A.up, UPPER); hand = along(elbow, A.fore, FORE + 4) }
  return { elbow, hand }
}

function sideRig(svg, defs, k, c, mv, prop, weights) {
  if (mv.scene) scene(svg, mv.scene, mv.sceneAngle)
  else if (!mv.hang && !mv.noShadow) el('ellipse', { cx: mv.shadowX || 205, cy: 586, rx: mv.shadowW || 80, ry: 9, fill: 'rgba(0,0,0,.5)' }, svg)
  if (mv.hang) el('rect', { x: 120, y: mv.barY - 4, width: 180, height: 9, rx: 4.5, fill: '#d5d8dd' }, svg)
  // everything stays inside the frame: [x, y, width, height]
  const vb = mv.box.split(' ').map(Number), top = vb[1] + 6, bottom = vb[1] + vb[3] - 6
  if (mv.machine) stack(svg, mv.machine, top)
  const rail = mv.rail ? el('rect', { y: top, width: 8, height: 582 - top, rx: 3, fill: '#4a4a4a' }, svg) : null
  const dip = mv.dipBar ? el('rect', { width: 150, height: 9, rx: 4.5, fill: '#d5d8dd' }, svg) : null
  const cable = prop === 'cable' ? el('line', { stroke: '#8a8f96', 'stroke-width': 2.5 }, svg) : null
  // the far arm and leg, a shade darker behind the body
  const far = el('g', { fill: FAR }, svg)
  const farLeg = { thigh: el('path', { d: limb(THIGH, 25, 15, 6, 4) }, el('g', {}, far)), shin: el('path', { d: limb(SHIN, 15, 9, 2, 7) }, el('g', {}, far)) }
  const farFoot = el('g', {}, far); el('path', { d: limb(48, 9, 6.5, 1, 0), transform: 'translate(-12 6)' }, farFoot)
  const farUpper = el('g', {}, far); el('path', { d: limb(UPPER, 16, 11, 4, 3) }, farUpper)
  const farFore = el('g', {}, far); el('path', { d: limb(FORE, 11, 7.5, 3, 2) }, farFore); el('ellipse', { cx: FORE + 4, cy: 0, rx: 10, ry: 9 }, farFore)
  const farHeld = prop && prop !== 'bar' && prop !== 'cable' ? heldProp(svg, prop, c) : null
  // the body, then its heat; the near arm, then its heat, so an arm across the trunk stays in front
  const layer = (name, pieces) => {
    const g = el('g', { fill: ORANGE }, svg)
    const fig = el('g', { id: k + name }, g)
    const parts = {}
    pieces(fig, parts)
    const mask = el('mask', { id: k + name + 'm', maskUnits: 'userSpaceOnUse', x: -400, y: -400, width: 1400, height: 1400 }, defs)
    el('use', { href: '#' + k + name, fill: '#fff' }, mask)
    const heat = el('g', { mask: 'url(#' + k + name + 'm)' }, svg)
    const heatOf = {}
    for (const part in parts) {
      if (!SIDE[part]) continue
      const h = el('g', {}, heat)
      if (spots(h, SIDE[part], weights, c.heat)) heatOf[part] = h
      else h.remove()
    }
    return { parts, heatOf, heat }
  }
  const body = layer('b', (fig, parts) => {
    parts.thigh = el('g', {}, fig); el('path', { d: limb(THIGH, 25, 15, 6, 4) }, parts.thigh)
    parts.shin = el('g', {}, fig); el('path', { d: limb(SHIN, 15, 9, 2, 7) }, parts.shin)
    parts.foot = el('g', {}, fig); el('path', { d: limb(48, 9, 6.5, 1, 0), transform: 'translate(-12 6)' }, parts.foot)
    parts.torso = el('g', {}, fig); el('path', { d: smooth(TORSO) }, parts.torso)
    el('ellipse', { cx: T + 26, cy: 6, rx: 27, ry: 23 }, parts.torso)
  })
  const arm = layer('a', (fig, parts) => {
    parts.upper = el('g', {}, fig); el('path', { d: limb(UPPER, 16, 11, 4, 3) }, parts.upper); el('circle', { r: 17 }, parts.upper)
    parts.fore = el('g', {}, fig); el('path', { d: limb(FORE, 11, 7.5, 3, 2) }, parts.fore); el('ellipse', { cx: FORE + 4, cy: 0, rx: 10, ry: 9 }, parts.fore)
  })
  // a plate or a dumbbell on the near side is nearer than the body, so it is drawn over it
  const held = prop ? heldProp(svg, prop, c) : null
  // the leg press sled, square to the push, rides on the feet
  const sled = mv.sled ? el('rect', { x: 8, y: -46, width: 14, height: 92, rx: 5, fill: '#5a5a5a' }, svg) : null

  const put = (L, part, at, deg) => { place(L.parts[part], at, deg); if (L.heatOf[part]) place(L.heatOf[part], at, deg) }
  const moveHeld = (g, at) => g && g.setAttribute('transform', 'translate(' + at[0].toFixed(1) + ' ' + at[1].toFixed(1) + ')')

  return p => {
    const q = mv.pose(p, prop)
    const heatLevel = (0.5 + 0.5 * p).toFixed(3)
    body.heat.setAttribute('opacity', heatLevel); arm.heat.setAttribute('opacity', heatLevel)
    const hip = q.hip
    const near = legOf(q.leg, hip), farL = legOf(q.farLeg || q.leg, hip)
    put(body, 'thigh', hip, ang(hip, near.knee)); put(body, 'shin', near.knee, ang(near.knee, near.ankle))
    place(body.parts.foot, near.ankle, near.foot)
    place(farLeg.thigh.parentNode, hip, ang(hip, farL.knee)); place(farLeg.shin.parentNode, farL.knee, ang(farL.knee, farL.ankle))
    place(farFoot, farL.ankle, farL.foot)
    if (sled) place(sled, near.ankle, mv.sled)
    put(body, 'torso', hip, q.torso)
    const sh = local(hip, q.torso, T - 20, -4)
    const a = armOf(q.arm, sh), fa = armOf(q.farArm || q.arm, sh)
    put(arm, 'upper', sh, ang(sh, a.elbow)); put(arm, 'fore', a.elbow, ang(a.elbow, a.hand))
    place(farUpper, sh, ang(sh, fa.elbow)); place(farFore, fa.elbow, ang(fa.elbow, fa.hand))
    moveHeld(held, a.hand); moveHeld(farHeld, fa.hand)
    if (cable) {
      const at = q.anchor || mv.anchor || (mv.machine ? [mv.machine + 23, top + 16] : [a.hand[0] + 90, bottom])
      const anchor = [Math.min(Math.max(at[0], vb[0] + 6), vb[0] + vb[2] - 6), Math.min(Math.max(at[1], top), bottom)]
      cable.setAttribute('x1', a.hand[0].toFixed(1)); cable.setAttribute('y1', a.hand[1].toFixed(1))
      cable.setAttribute('x2', anchor[0]); cable.setAttribute('y2', anchor[1])
    }
    if (rail) rail.setAttribute('x', (a.hand[0] - 4).toFixed(1))
    if (dip) { dip.setAttribute('x', (a.hand[0] - 90).toFixed(1)); dip.setAttribute('y', (a.hand[1] + 4).toFixed(1)) }
  }
}

// ---------- the movements ----------
// pose(p): p runs 0 → 1 and back; at 1 the working muscle is at its hardest, and the heat with it.
const HIP0 = [198, 371], ANK = [200, 565]
const STAND = '10 100 400 500'
const hang = { up: 90, fore: 90 }
const onBack = (hip, torso) => local(hip, torso, T - 14, -30)
// where the shoulder sits for a hip and a trunk angle, and the hip that puts a shoulder at a point
const shoulderOf = (hip, torso) => local(hip, torso, T - 20, -4)
const hipFor = (sh, torso) => { const c = Math.cos(torso * rad), s = Math.sin(torso * rad); return [sh[0] - (150 * c + 4 * s), sh[1] - (150 * s - 4 * c)] }
const straightLegs = deg => ({ thigh: deg, shin: deg })

const MOVES = {
  breathe: { view: 'front', box: '50 -70 300 680', pose: p => ({ up: 6, fore: 4, shrug: lerp(0, -3, p) }) },
  press: { view: 'front', box: '10 -70 380 680', pose: p => ({ up: lerp(80, 166, p), fore: lerp(100, 8, p) }) },
  raise: { view: 'front', box: '-45 20 490 590', endOn: true, pose: p => ({ up: lerp(14, 88, p), fore: lerp(10, 6, p) }) },
  upright: { view: 'front', box: '-30 -20 460 630', pose: p => ({ up: lerp(10, 92, p), fore: lerp(-4, 118, p) }) },
  shrug: { view: 'front', box: '10 -20 380 630', pose: p => ({ up: 6, fore: 2, shrug: lerp(0, -16, p) }) },
  fly: { view: 'front', box: '-45 20 490 590', endOn: true, cableHigh: true, pose: p => ({ up: lerp(84, 40, p), fore: lerp(12, 34, p) }) },
  pull: { view: 'front', box: '20 -110 360 770', hang: true, pose: p => ({ up: lerp(160, 30, p), fore: lerp(0, 140, p) }) },
  deadhang: { view: 'front', box: '30 -60 340 720', hang: true, pose: p => ({ up: lerp(160, 158, p), fore: 0, shrug: lerp(0, -6, p) }) },
  circles: { view: 'front', box: '-45 -70 490 680', pose: p => ({ up: lerp(8, 176, p), fore: 2 }) },
  // a lean to one side and back; the figure tips about its hips
  sidebend: { view: 'front', box: '-60 -60 520 680', pose: p => ({ up: 8, fore: 4, tilt: lerp(-16, 16, p) }) },

  squat: { view: 'side', box: STAND, pose: (p, prop) => {
    const hip = lerp2([198, 372], [124, 476], p), torso = lerp(-88, -52, p)
    const arm = prop === 'bar' ? { hand: onBack(hip, torso), elbow: -1 }
      : prop ? { hand: local(hip, torso, T - 46, 44), elbow: 1 }
        : { up: lerp(30, -2, p), fore: lerp(10, -4, p) }
    return { hip, torso, leg: { ankle: ANK }, arm }
  } },
  jump: { view: 'side', box: '10 30 400 570', pose: p => {
    const d = 1 - Math.min(1, p * 1.6), air = Math.max(0, (p - 0.55) / 0.45) * 70
    const hip = lerp2([198, 372 - air], [140, 462], d), torso = lerp(-86, -55, d)
    return { hip, torso, leg: { ankle: [200, 565 - air], foot: air ? 22 : 0 }, arm: { up: lerp(-40, 150, d), fore: lerp(-50, 150, d) } }
  } },
  lunge: { view: 'side', box: STAND, pose: (p, prop) => {
    const hip = [198, lerp(384, 452, p)]
    const arm = prop === 'bar' ? { hand: onBack(hip, -88), elbow: -1 } : hang
    return { hip, torso: -88, leg: { ankle: [262, 565] }, farLeg: { ankle: [134, 548], foot: 48 }, arm }
  } },
  deadlift: { view: 'side', box: STAND, pose: p => {
    const hip = lerp2([196, 371], [104, 470], p), torso = lerp(-88, -30, p)
    return { hip, torso, leg: { ankle: ANK }, arm: { hand: [226, lerp(362, 544, p)], straight: true } }
  } },
  hinge: { view: 'side', box: STAND, pose: p => {
    const hip = lerp2([198, 371], [150, 390], p), torso = lerp(-88, -12, p)
    return { hip, torso, leg: { ankle: ANK }, arm: { hand: along(shoulderOf(hip, torso), 90, 150), straight: true } }
  } },
  goodmorning: { view: 'side', box: STAND, pose: p => {
    const hip = lerp2([198, 371], [156, 386], p), torso = lerp(-88, -10, p)
    return { hip, torso, leg: { ankle: ANK }, arm: { hand: onBack(hip, torso), elbow: -1 } }
  } },
  swing: { view: 'side', box: STAND, pose: p => {
    const hip = lerp2([198, 371], [150, 392], p), torso = lerp(-88, -20, p), a = lerp(-4, 112, p)
    return { hip, torso, leg: { ankle: ANK }, arm: { up: a, fore: a } }
  } },
  bridge: { view: 'side', box: '0 330 420 270', shadowX: 220, shadowW: 170, pose: p => {
    const torso = lerp(178, 160, p), hip = hipFor([112, 552], torso)
    return { hip, torso, leg: { ankle: [312, 565] }, arm: { hand: [210, 574], straight: true } }
  } },
  thrust: { view: 'side', box: '0 260 420 340', scene: 'thrust', pose: (p, prop) => {
    const torso = lerp(212, 182, p), hip = hipFor([104, 412], torso)
    const arm = prop ? { hand: [hip[0], hip[1] - 34], elbow: 1 } : { hand: [hip[0] - 20, hip[1] - 6], elbow: 1 }
    return { hip, torso, leg: { ankle: [318, 565] }, arm }
  } },
  bench: { view: 'side', box: '20 190 400 410', scene: 'bench', pose: p => {
    const hip = [272, 402], sh = shoulderOf(hip, 180)
    return { hip, torso: 180, leg: { ankle: [352, 565] }, arm: { hand: [sh[0] + 22, lerp(sh[1] - 138, sh[1] - 50, p)], elbow: 1 } }
  } },
  incline: { view: 'side', box: '20 150 400 450', scene: 'incline', sceneAngle: 208, pose: p => {
    const hip = [262, 414], torso = 208, sh = shoulderOf(hip, torso)
    return { hip, torso, leg: { ankle: [352, 565] }, arm: { hand: [sh[0] + 10, lerp(sh[1] - 140, sh[1] - 50, p)], elbow: 1 } }
  } },
  pullover: { view: 'side', box: '-80 170 510 430', scene: 'bench', pose: p => {
    const a = lerp(268, 172, p)
    return { hip: [272, 402], torso: 180, leg: { ankle: [352, 565] }, arm: { up: a, fore: a } }
  } },
  skull: { view: 'side', box: '0 170 430 430', scene: 'bench', pose: p =>
    ({ hip: [272, 402], torso: 180, leg: { ankle: [352, 565] }, arm: { up: -100, fore: lerp(260, 172, p) } }) },
  seatpress: { view: 'side', box: STAND, scene: 'seat', pose: p => {
    const hip = [176, 470], torso = -95, sh = shoulderOf(hip, torso)
    return { hip, torso, leg: { ankle: [262, 565] }, arm: { hand: lerp2(local(hip, torso, 132, 60), [sh[0] + 140, sh[1] + 8], p), elbow: 1 } }
  } },
  pushup: { view: 'side', box: '-10 320 490 280', shadowX: 220, shadowW: 170, pose: p => {
    const A = [66, 545], b0 = -20, b = lerp(b0, -6, p)
    const legHip = d => along(along(A, d, SHIN), d, THIGH)
    const s0 = shoulderOf(legHip(b0), b0)
    return { hip: legHip(b), torso: b, leg: straightLegs(b + 180), arm: { hand: [s0[0] + 4, 572], elbow: 1 } }
  } },
  plank: { view: 'side', box: '-10 320 490 280', shadowX: 220, shadowW: 170, pose: p => {
    const b = lerp(-9, -11, p), hip = hipFor([352, 494], b)
    return { hip, torso: b, leg: straightLegs(b + 180), arm: { up: 90, fore: 0 } }
  } },
  climber: { view: 'side', box: '-10 320 490 280', shadowX: 220, shadowW: 170, pose: p => {
    const A = [66, 545], b = -20, hip = along(along(A, b, SHIN), b, THIGH), s0 = shoulderOf(hip, b)
    return { hip, torso: b, farLeg: straightLegs(b + 180), leg: { thigh: lerp(b + 180, 32, p), shin: lerp(b + 180, 32, p) + lerp(0, 126, p) + 60 * Math.sin(Math.PI * p) }, arm: { hand: [s0[0] + 4, 572], elbow: -1 } }
  } },
  crunch: { view: 'side', box: '0 300 420 300', shadowX: 220, shadowW: 170, pose: p => {
    const hip = [242, 548], torso = lerp(180, 218, p)
    return { hip, torso, leg: { ankle: [330, 565] }, arm: { hand: local(hip, torso, T + 18, -16), elbow: 1 } }
  } },
  situp: { view: 'side', box: '0 300 420 300', shadowX: 220, shadowW: 170, pose: p => {
    const hip = [242, 548], torso = lerp(180, 250, p)
    return { hip, torso, leg: { ankle: [330, 565] }, arm: { hand: local(hip, torso, T + 18, -16), elbow: 1 } }
  } },
  legraise: { view: 'side', box: '-30 280 480 320', shadowX: 200, shadowW: 170, pose: p => {
    const a = lerp(-2, -80, p)
    return { hip: [200, 548], torso: 180, leg: straightLegs(a), arm: { up: 2, fore: 2 } }
  } },
  hangraise: { view: 'side', box: '10 -40 400 560', hang: true, barY: 2, pose: p => {
    const t = lerp(90, 2, p)
    return { hip: [200, 300], torso: -90, leg: { thigh: t, shin: t }, arm: { up: -92, fore: -92 } }
  } },
  kneeraise: { view: 'side', box: '10 -40 400 560', hang: true, barY: 2, pose: p =>
    ({ hip: [200, 300], torso: -90, leg: { thigh: lerp(90, -6, p), shin: lerp(92, 84, p) }, arm: { up: -92, fore: -92 } }) },
  row: { view: 'side', box: '10 100 410 500', pose: p => {
    const hip = [160, 392], torso = -32, sh = shoulderOf(hip, torso)
    return { hip, torso, leg: { ankle: ANK }, arm: { hand: lerp2([sh[0] + 6, sh[1] + 140], local(hip, torso, 92, 44), p), elbow: 1 } }
  } },
  seatrow: { view: 'side', box: '20 160 420 440', scene: 'seat', anchor: [440, 452], pose: p => {
    const hip = [176, 470], torso = lerp(-72, -96, p), sh = shoulderOf(hip, torso)
    return { hip, torso, leg: { ankle: [348, 470] }, arm: { hand: lerp2([sh[0] + 140, sh[1] + 30], local(hip, torso, 86, 44), p), elbow: 1 } }
  } },
  facepull: { view: 'side', box: STAND, anchor: [440, 214], pose: p => {
    const sh = shoulderOf(HIP0, -90)
    return { hip: HIP0, torso: -90, leg: { ankle: ANK }, arm: { hand: lerp2([sh[0] + 140, sh[1] - 8], local(HIP0, -90, T + 16, 40), p), elbow: -1 } }
  } },
  curl: { view: 'side', box: STAND, anchor: [262, 600], pose: p => ({ hip: HIP0, torso: -90, leg: { ankle: ANK }, arm: { up: 88, fore: lerp(84, -64, p) } }) },
  preacher: { view: 'side', box: STAND, pose: p => ({ hip: HIP0, torso: -84, leg: { ankle: ANK }, arm: { up: 46, fore: lerp(44, -96, p) } }) },
  wrist: { view: 'side', box: STAND, pose: p => ({ hip: HIP0, torso: -90, leg: { ankle: ANK }, arm: { up: 92, fore: lerp(8, -24, p) } }) },
  pushdown: { view: 'side', box: STAND, anchor: [262, 106], pose: p => ({ hip: HIP0, torso: -88, leg: { ankle: ANK }, arm: { up: 94, fore: lerp(-24, 86, p) } }) },
  overhead: { view: 'side', box: '10 0 400 600', pose: p => ({ hip: HIP0, torso: -90, leg: { ankle: ANK }, arm: { up: -100, fore: lerp(100, 262, p) } }) },
  kickback: { view: 'side', box: STAND, pose: p => ({ hip: [160, 392], torso: -22, leg: { ankle: ANK }, arm: { up: 166, fore: lerp(94, 168, p) } }) },
  frontraise: { view: 'side', box: STAND, pose: p => { const a = lerp(88, -8, p); return { hip: HIP0, torso: -90, leg: { ankle: ANK }, arm: { up: a, fore: a } } } },
  dip: { view: 'side', box: '-10 30 440 570', noShadow: true, dipBar: true, pose: p => {
    const torso = -80, s0 = shoulderOf([200, 371], torso), hip = [200, lerp(371, 430, p)]
    return { hip, torso, leg: { thigh: 104, shin: 150 }, arm: { hand: [s0[0] + 6, s0[1] + 142], elbow: -1 } }
  } },
  calf: { view: 'side', box: STAND, pose: p => {
    const th = lerp(0, 32, p), c = Math.cos(th * rad), s = Math.sin(th * rad)
    const ankle = [236 - (36 * c - 6 * s), 571 - (36 * s + 6 * c)]
    return { hip: [HIP0[0] + ankle[0] - 200, HIP0[1] + ankle[1] - 565], torso: -90, leg: { ankle, foot: th }, arm: hang }
  } },
  legext: { view: 'side', box: STAND, scene: 'seat', pose: p => ({ hip: [176, 470], torso: -95, leg: { thigh: 2, shin: lerp(90, 4, p) }, arm: { up: 98, fore: 70 } }) },
  legcurl: { view: 'side', box: '-60 280 580 320', scene: 'prone', pose: p => {
    const hip = [240, 498]
    return { hip, torso: 0, leg: { thigh: 180, shin: lerp(182, 282, p) }, arm: { up: 60, fore: 0 } }
  } },
  legpress: { view: 'side', box: '-10 110 470 490', scene: 'legpress', sled: -38, pose: p => {
    const hip = [176, 480], ankle = along(hip, -38, lerp(190, 108, p))
    return { hip, torso: -140, leg: { ankle, knee: -1, foot: -128 }, arm: { up: 70, fore: 20 } }
  } },
  donkey: { view: 'side', box: '0 300 440 300', shadowX: 220, shadowW: 170, pose: p => {
    const hip = [180, 462], torso = -12
    return { hip, torso, farLeg: { thigh: 90, shin: 180 }, leg: { thigh: lerp(90, 202, p), shin: lerp(180, 290, p) }, arm: hang }
  } },
  run: { view: 'side', box: STAND, pose: p => runPose(2 * p - 1, 38, -82) },
  walk: { view: 'side', box: STAND, pose: p => runPose(2 * p - 1, 20, -88, true) },
  // quick, light steps on the balls of the feet: agility drills, ladders, shuffles
  steps: { view: 'side', box: STAND, pose: p => runPose(Math.sin(p * Math.PI * 4), 12, -80, false, 0.4) },
  boxjump: { view: 'side', box: '-10 0 450 600', scene: 'box', pose: p => {
    const arc = Math.sin(p * Math.PI)
    const ankle = [lerp(150, 292, p), lerp(565, 485, p) - 96 * arc]
    const hip = [lerp(146, 288, p) - 26 * arc, lerp(371, 291, p) - 50 * arc]
    const up = lerp(90, -10, arc)
    return { hip, torso: -86 + 30 * arc, leg: { ankle, foot: 18 * arc }, arm: { up, fore: up - 20 * arc } }
  } },
  stepup: { view: 'side', box: '10 40 400 560', scene: 'box', pose: (p, prop) => {
    const far = [lerp(180, 300, p), lerp(565, 485, p) - 40 * Math.sin(p * Math.PI)]
    return { hip: lerp2([206, 404], [282, 291], p), torso: lerp(-80, -88, p), leg: { ankle: [268, 485] }, farLeg: { ankle: far, foot: 30 * Math.sin(p * Math.PI) },
      arm: prop ? hang : { up: lerp(70, 92, p), fore: lerp(-10, 90, p) } }
  } },
  // ---- holds and stretches: a held position that breathes ----
  fold: { view: 'side', box: STAND, pose: p => {
    const torso = lerp(18, 44, p)
    return { hip: [lerp(184, 176, p), 371], torso, leg: { ankle: ANK }, arm: { hand: [lerp(262, 246, p), lerp(540, 572, p)], elbow: -1 } }
  } },
  seatedfold: { view: 'side', box: '0 290 450 310', shadowX: 220, shadowW: 170, pose: p => {
    const reach = lerp(30, 6, p)
    return { hip: [140, 548], torso: lerp(-50, -16, p), leg: straightLegs(0), arm: { up: reach, fore: reach } }
  } },
  quadstretch: { view: 'side', box: STAND, pose: p => {
    const shinA = lerp(-104, -114, p), ankle = along(along(HIP0, 92, THIGH), shinA, SHIN)
    return { hip: HIP0, torso: -90, leg: { thigh: 92, shin: shinA }, farLeg: { ankle: ANK }, arm: { hand: ankle, elbow: 1 }, farArm: { up: 100, fore: 96 } }
  } },
  lungehold: { view: 'side', box: STAND, pose: p =>
    ({ hip: [196, lerp(468, 480, p)], torso: -90, leg: { ankle: [276, 565] }, farLeg: { ankle: [100, 556], foot: 62 }, arm: { up: 96, fore: 90 } }) },
  reach: { view: 'front', box: '50 -70 300 680', pose: p => ({ up: lerp(160, 176, p), fore: lerp(6, 0, p) }) },
  crossarm: { view: 'front', box: '50 -20 300 630', pose: p => ({ up: lerp(42, 50, p), fore: lerp(118, 134, p) }) },
  cobra: { view: 'side', box: '0 320 470 280', shadowX: 220, shadowW: 170, pose: p => {
    const hip = [214, 552], torso = lerp(-8, -30, p), sh = shoulderOf(hip, torso)
    return { hip, torso, leg: straightLegs(180), arm: { hand: [sh[0] + 14, 574], elbow: -1 } }
  } },
  downdog: { view: 'side', box: '0 260 460 340', shadowX: 240, shadowW: 190, pose: p => {
    const hip = [200, lerp(398, 386, p)], torso = 40, sh = shoulderOf(hip, torso)
    return { hip, torso, leg: straightLegs(lerp(124, 122, p)), arm: { hand: along(sh, torso, 160), straight: true } }
  } },
  child: { view: 'side', box: '-20 320 490 280', shadowX: 240, shadowW: 190, pose: p => {
    const hip = [170, lerp(530, 524, p)], torso = lerp(14, 10, p), sh = shoulderOf(hip, torso)
    return { hip, torso, leg: { thigh: ang(hip, [262, 562]), shin: 180, foot: 176 }, arm: { hand: [sh[0] + 132, 572], straight: true } }
  } },
  kneehug: { view: 'side', box: '0 330 440 270', shadowX: 220, shadowW: 170, pose: p => {
    const hip = [240, 548], th = lerp(-112, -132, p)
    return { hip, torso: 180, leg: { thigh: th, shin: th + 108 }, farLeg: straightLegs(0), arm: { hand: along(hip, th, THIGH), elbow: 1 } }
  } },
  legswing: { view: 'side', box: STAND, pose: p => { const a = lerp(126, 44, p); return { hip: HIP0, torso: -90, leg: { thigh: a, shin: a + 4 }, farLeg: { ankle: ANK }, arm: { up: 100, fore: 70 } } } },
  kneedrive: { view: 'side', box: STAND, pose: p => { const a = lerp(92, 2, p); return { hip: HIP0, torso: -88, leg: { thigh: a, shin: lerp(96, 92, p) }, farLeg: { ankle: ANK }, arm: { up: lerp(70, 120, p), fore: lerp(-10, 40, p) } } } },
  quadruped: { view: 'side', box: '0 300 440 300', shadowX: 220, shadowW: 170, pose: p =>
    ({ hip: [180, 462], torso: lerp(-12, -16, p), farLeg: { thigh: 90, shin: 180 }, leg: { thigh: 90, shin: 180 }, arm: hang }) },
}

function runPose(s, amp, torso, carry, bounce = 0) {
  const legAt = th => ({ thigh: th, shin: th + 12 + (carry ? 20 : 62) * Math.max(0, (th - 90) / amp) })
  const near = legAt(90 - amp * s), far = legAt(90 + amp * s)
  // the hip sits where the lower foot just meets the ground
  const low = L => along(along([0, 0], L.thigh, THIGH), L.shin, SHIN)[1]
  const hip = [200, 562 - Math.max(low(near), low(far)) + bounce * 30]
  const swing = carry ? 8 : bounce ? 18 : 46
  const armAt = d => carry ? { up: 90 + d, fore: 90 + d } : { up: 90 + d, fore: 90 + d - 82 }
  return { hip, torso, leg: near, farLeg: far, arm: armAt(swing * s), farArm: armAt(-swing * s) }
}

// ---------- which movement an exercise is ----------
// Read from the name first; the written instructions (the build reads them out of catalogue/,
// scripts/carga-moves.mjs) settle what the name leaves open, like whether a press is done lying
// on a bench or a jump lands on a box.
const RULES = [
  [/drill|ladder|shuffle|carioca|agility|quick feet|fast feet|cone/, 'steps'],
  [/box jump|jump box|jump onto|onto (a |the )?box|\bbox\b/, (ex, t) => /jump|hop/.test(ex.n + ' ' + t) ? 'boxjump' : 'stepup'],
  [/step-?\s?ups?\b|step onto/, 'stepup'],
  [/mountain climber/, 'climber'],
  [/side bend|wood ?chop|windmill|standing.*twist|oblique twist|lateral bend/, 'sidebend'],
  [/knee drive|knee to butt|butt kick/, 'kneedrive'],
  [/leg swing|hip swirl|hip circle/, 'legswing'],
  [/dead hang|bar suspension|hangback/, 'deadhang'],
  [/arm circl|shoulder circl|arms? circling|circles arm|pass through|pass around/, 'circles'],
  [/push-?\s?ups?\b|press-?\s?ups?\b|burpee/, 'pushup'],
  [/plank/, 'plank'],
  [/pull-?\s?ups?\b|chin-?\s?ups?\b|pull-?\s?down|muscle-?\s?up/, 'pull'],
  [/\bdips?\b/, 'dip'],
  [/pullover/, 'pullover'],
  [/skull|lying (triceps?|tricep) ext|french press/, 'skull'],
  [/overhead (triceps?|tricep)|(triceps?|tricep) (extension|ext)/, (ex, t) => /\blie |lying|on (a |the )?bench/.test(t) && !/overhead/.test(ex.n) ? 'skull' : 'overhead'],
  [/push-?\s?down|pressdown/, 'pushdown'],
  [/donkey|fire hydrant|glute kick/, 'donkey'],
  [/bird dog|quadruped|all fours/, 'quadruped'],
  [/kick-?\s?back/, ex => /glute/.test(ex.tg) ? 'donkey' : 'kickback'],
  [/leg curl|hamstring curl|nordic/, 'legcurl'],
  [/wrist|reverse curl/, 'wrist'],
  [/preacher|scott|concentration/, 'preacher'],
  [/curl/, 'curl'],
  [/leg extension/, 'legext'],
  [/leg press|sled press/, 'legpress'],
  [/calf|calves|heel raise|toe raise|tibialis/, 'calf'],
  [/hip thrust/, 'thrust'],
  [/bridge/, 'bridge'],
  [/good morning/, 'goodmorning'],
  [/swing/, 'swing'],
  [/romanian|stiff|hyperextension|back extension|single leg deadlift/, 'hinge'],
  [/deadlift|clean|snatch|rack pull/, 'deadlift'],
  [/jump|\bhops?\b|bound|skip|jack/, 'jump'],
  [/squat|thruster|wall sit|pistol/, 'squat'],
  [/lunge|split/, 'lunge'],
  [/hanging.*knee|knee raise|knee tuck/, 'kneeraise'],
  [/hanging (leg|straight|toes)|leg raise|captain/, ex => /hanging|captain/.test(ex.n) ? 'hangraise' : 'legraise'],
  [/incline.*(press|fly)|(press|fly).*incline/, 'incline'],
  [/reverse fly|rear delt|lateral raise|side raise|\by raise|lateral/, 'raise'],
  [/fly|flye|crossover|pec deck/, 'fly'],
  [/bench press|floor press|decline press|close grip press/, 'bench'],
  [/chest press/, ex => /machine|lever|cable/.test(ex.eq) ? 'seatpress' : 'bench'],
  [/front raise/, 'frontraise'],
  [/upright row/, 'upright'],
  [/shrug/, 'shrug'],
  [/face pull/, 'facepull'],
  [/\brow\b|rowing/, (ex, t) => /seated|cable|machine|lever|band/.test(ex.n + ' ' + ex.eq) || /\bsit /.test(t) ? 'seatrow' : 'row'],
  [/press|jerk/, (ex, t) => ex.bp === 'chest' || /lie (flat |back )?on (a |the )?bench|lie on your back/.test(t) ? 'bench' : 'press'],
  [/sit-?\s?up|v-?\s?up|jackknife/, 'situp'],
  [/crunch|toe touch|twist|russian/, 'crunch'],
  [/carry|farmer|walk|march/, 'walk'],
  [/run|sprint|jog|high knee|bike|cycl|elliptical|stepmill|skierg|ergometer/, 'run'],
]
// Stretches, yoga and mobility work hold a position; these are the ones the figure can take.
const HOLD_POSES = [
  [/side bend|lateral stretch|lateral bend|windmill|twist|rotation stretch|side lean/, 'sidebend'],
  [/arm circl|shoulder circl|arms? circling|circles arm|pass through|pass around|circling/, 'circles'],
  [/leg swing|hip swirl|hip circle/, 'legswing'],
  [/knee drive|knee to butt|butt kick|high knee/, 'kneedrive'],
  [/dead hang|hang|bar suspension|hangback/, 'deadhang'],
  [/downward dog|down dog|dog pose|pike/, 'downdog'],
  [/child'?s? pose/, 'child'],
  [/cobra|upward dog|up dog|sphinx|seal/, 'cobra'],
  [/plank/, 'plank'],
  [/bridge/, 'bridge'],
  [/quad(riceps)? stretch|heel (toward|to) (your )?(glute|butt)/, 'quadstretch'],
  [/knees? (to|toward) (your )?chest|knee hug|\bhug/, 'kneehug'],
  [/lunge|hip flexor|split|warrior|calf stretch/, 'lungehold'],
  [/cross.?body|across (your |the )?chest|shoulder stretch|triceps stretch/, 'crossarm'],
  [/overhead|reach|arms up|lat stretch|side bend|side stretch|mountain pose|tree/, 'reach'],
  [/hamstring|forward fold|forward bend|toe touch/, (ex, t) => /\bsit|seated/.test(ex.n + ' ' + t) ? 'seatedfold' : 'fold'],
  [/squat/, 'squat'],
]
const HOLD_BY_TEXT = [
  [/hands and knees|all fours|tabletop/, 'quadruped'],
  [/lie (face down|on your stomach|prone)|lying face down/, 'cobra'],
  [/lie on your back|lying on your back|supine/, 'kneehug'],
  [/kneel/, 'child'],
  [/\bsit\b|seated|sitting/, 'seatedfold'],
]
const BY_TARGET = {
  biceps: 'curl', triceps: 'pushdown', forearms: 'wrist', pectorals: 'bench', delts: 'press', lats: 'seatrow', 'upper back': 'row',
  traps: 'shrug', quads: 'squat', glutes: 'bridge', hamstrings: 'hinge', calves: 'calf', abs: 'crunch', adductors: 'squat',
  abductors: 'bridge', spine: 'hinge', 'serratus anterior': 'pushup', 'levator scapulae': 'shrug',
}
const QUIET = new Set(['stretching', 'yoga', 'mobility', 'rehab'])
const lower = s => String(s || '').toLowerCase()
const pick = (rules, ex, text) => {
  for (const [re, to] of rules) if (re.test(ex.n)) return typeof to === 'function' ? to(ex, text) : to
  return null
}

// The movement for an exercise from its name, its catalogue fields and, when given, its
// written instructions. Accepts the app's short fields (n, eq, tg) or the catalogue's long ones.
export function classifyMove(ex, text = '') {
  if (!ex) return 'breathe'
  const e = { n: lower(ex.n ?? ex.name), tg: lower(ex.tg ?? ex.target), eq: lower(ex.eq ?? ex.equipment), bp: lower(ex.bp ?? ex.bodyPart) }
  const t = lower(text)
  if (QUIET.has(ex.cat ?? ex.category)) {
    const hold = pick(HOLD_POSES, e, t)
    if (hold) return hold
    for (const [re, to] of HOLD_BY_TEXT) if (re.test(t)) return to
    return 'breathe'
  }
  const named = pick(RULES, e, t)
  if (named) return named
  if (e.tg === 'cardiovascular system') return /sprint|\brun|jog/.test(t) ? 'run' : /jump|hop/.test(t) ? 'jump' : 'steps'
  if (/\bbox\b/.test(t) && /jump|hop/.test(t)) return 'boxjump'
  return BY_TARGET[e.tg] || 'breathe'
}
// Built-in exercises were sorted once with their instructions at build time (carga-moves.json,
// scripts/carga-moves.mjs); anything else, a custom exercise among them, by its name alone.
export function moveOf(ex) {
  const known = ex?.id != null && MOVE_TABLE[ex.id]
  return known && MOVES[known] ? known : classifyMove(ex)
}

export function propOf(ex) {
  const eq = lower(ex?.eq)
  if (/barbell|smith|trap bar|landmine/.test(eq)) return 'bar'
  if (eq === 'dumbbell') return 'db'
  if (eq === 'kettlebell') return 'kb'
  if (/cable|band|rope|suspension|leverage machine|sled/.test(eq)) return 'cable'
  if (eq === 'weight plate') return 'plate'
  if (/medicine ball|sandbag/.test(eq)) return 'ball'
  return null
}
// Movements whose hands are on the floor, a bar, a seat or nothing: they hold no equipment.
const EMPTY_HANDS = new Set(['breathe', 'deadhang', 'circles', 'legswing', 'kneedrive', 'pushup', 'plank', 'climber', 'donkey', 'quadruped', 'bridge', 'legraise', 'hangraise', 'kneeraise', 'pull', 'dip',
  'legcurl', 'legext', 'legpress', 'run', 'steps', 'jump', 'boxjump', 'situp', 'fold', 'seatedfold', 'quadstretch', 'lungehold', 'reach', 'crossarm',
  'cobra', 'downdog', 'child', 'kneehug'])
// Where the weight stack stands for the movements done standing at a cable or a machine.
const STACK_AT = { curl: 320, pushdown: 300, facepull: 356, row: 360, overhead: 330, kickback: 40, frontraise: 330, wrist: 320, calf: 320,
  squat: 340, lunge: 340, hinge: 340, deadlift: 340, goodmorning: 340, swing: 340 }

// Draws the exercise into holder and returns set(p), which poses the figure at p (0 → 1).
export function drawExercise(holder, ex, weights = musclesOf(ex)) {
  const k = 'cf' + (uid++) + '-'
  const move = moveOf(ex)
  let mv = MOVES[move] || MOVES.breathe
  let prop = EMPTY_HANDS.has(move) ? null : propOf(ex)
  const eq = lower(ex?.eq)
  if (prop === 'bar' && (move === 'raise' || move === 'fly')) prop = 'db'
  // a cable would swing loose as the figure tips over
  if (prop === 'cable' && move === 'sidebend') prop = null
  // a cable or a machine shows its weight stack, a Smith machine its rail
  if (mv.view === 'side' && /cable|leverage machine|sled/.test(eq) && !mv.scene && STACK_AT[move]) mv = { ...mv, machine: STACK_AT[move] }
  // on a lever machine the load sits on the shoulders or under the feet, not in the hands
  if (/leverage machine|sled/.test(eq) && ['calf', 'squat', 'lunge', 'hinge', 'deadlift', 'goodmorning', 'crunch'].includes(move)) prop = null
  if (mv.view === 'side' && eq === 'smith machine') mv = { ...mv, rail: true }
  const svg = el('svg', { viewBox: mv.box, 'aria-hidden': 'true', class: 'cf-svg' }, holder)
  const defs = el('defs', {}, svg)
  const c = paints(defs, k)
  const set = (mv.view === 'front' ? frontRig : sideRig)(svg, defs, k, c, mv, prop, weights || {})
  return { move, set }
}

export const MOVE_NAMES = Object.keys(MOVES)

// Every joint of a side-view pose, near limbs and far, for checking that none bends backwards.
export function sideJoints(move, p, prop = null) {
  const mv = MOVES[move]
  if (!mv || mv.view !== 'side') return null
  const q = mv.pose(p, prop)
  const sh = local(q.hip, q.torso, T - 20, -4)
  const legs = [legOf(q.leg, q.hip), legOf(q.farLeg || q.leg, q.hip)]
  const arms = [armOf(q.arm, sh), armOf(q.farArm || q.arm, sh)]
  return { hip: q.hip, shoulder: sh, legs, arms }
}
export { elbowBends, kneeBends }
