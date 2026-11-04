// CARGA: the medals a challenge's top three take to their profile (approved style, 2026-11-04: the
// hexagon, its challenge icon big in the middle, the place small under it). The kind follows how the
// challenge scored: km or a race → run, CARGA points → CARGA, anything else → gym. Gold, silver,
// bronze by place.
const MET = {
  1: ['#fff6cf', '#ffd54a', '#c99400', '#7a5600', '#4a3300'],
  2: ['#ffffff', '#dfe5ec', '#9aa6b4', '#5d6875', '#2e3540'],
  3: ['#ffe0c2', '#e08a3c', '#a65314', '#6b3008', '#3d1a04'],
}
const KIND = {
  run: { name: 'Corrida', enamel: '#2f8cff', deep: '#0b4fa8', icon: '<circle cx="15.6" cy="4.6" r="1.9"/><path d="M14.2 8.2 11.4 13.2M14.2 8.2l2.4 2.2 2.2-1M14.2 8.2l-3 .4-1.8 2.4M11.4 13.2l3.2 2-.8 4.6h1.8M11.4 13.2l-1.8 3.4-3.8.8M2.8 9.6h3.4M2.2 12.6h3.2"/>' },
  gym: { name: 'Academia', enamel: '#ff6b00', deep: '#a33c00', icon: '<path d="M3 12h18M6 7v10M9 9v6M18 7v10M15 9v6"/>' },
  carga: { name: 'CARGA', enamel: '#1c1c1c', deep: '#000000', icon: '<path d="M16.5 6A7.5 7.5 0 1 0 16.5 18" stroke-width="3.2"/><path d="M15 3.5v4M18.5 3.5v4M15 16.5v4M18.5 16.5v4"/>' },
}
export const medalKind = scoring => (scoring === 'km' || scoring === 'race' ? 'run' : scoring === 'carga' ? 'carga' : 'gym')
export const medalName = kind => KIND[kind]?.name || 'Academia'

const hex = (r, cy = 92) => [-90, -30, 30, 90, 150, 210].map(t => `${(60 + r * Math.cos(t * Math.PI / 180)).toFixed(1)},${(cy + r * Math.sin(t * Math.PI / 180)).toFixed(1)}`).join(' ')
/**
 * How many 1st, 2nd and 3rd places, each shown as the kind it was won in most (5 golds in runs and 2
 * at the gym show a run gold): [{ place, n, kind }]. A tie goes to the kind with more medals overall.
 */
export function medalSummary(medals) {
  const all = Array.isArray(medals) ? medals : []
  const total = k => all.filter(m => m.kind === k).length
  return [1, 2, 3].map(place => {
    const here = all.filter(m => m.place === place)
    const by = ['run', 'gym', 'carga'].map(k => [k, here.filter(m => m.kind === k).length])
    by.sort((x, y) => y[1] - x[1] || total(y[0]) - total(x[0]))
    const kind = here.length ? by[0][0] : (['run', 'gym', 'carga'].sort((x, y) => total(y) - total(x))[0] || 'carga')
    return { place, n: here.length, kind }
  })
}

let n = 0
/** The medal as SVG markup. */
export function medalSVG(kind, place) {
  const [hi, a, b, c, d] = MET[place] || MET[3]
  const k = KIND[kind] || KIND.gym
  const g1 = 'mdA' + (++n), g2 = 'mdB' + n, ge = 'mdE' + n
  return `<svg viewBox="0 0 120 160" class="medal" role="img" aria-label="${place}º lugar · ${k.name}"><defs>`
    + `<linearGradient id="${g1}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".35" stop-color="${a}"/><stop offset=".7" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`
    + `<linearGradient id="${g2}" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${hi}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${d}"/></linearGradient>`
    + `<linearGradient id="${ge}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${k.enamel}"/><stop offset="1" stop-color="${k.deep}"/></linearGradient></defs>`
    // the ribbon
    + `<path d="M44 0h32v40l-16 8-16-8z" fill="${kind === 'carga' ? '#ff6b00' : k.enamel}"/><path d="M44 0h32v40l-16 8-16-8z" fill="none" stroke="url(#${g1})" stroke-width="2"/>`
    // the bevelled metal and the enamel
    + `<polygon points="${hex(52)}" fill="url(#${g2})"/><polygon points="${hex(47)}" fill="url(#${g1})"/><polygon points="${hex(38)}" fill="url(#${ge})"/>`
    + `<polygon points="${hex(38)}" fill="none" stroke="${hi}" stroke-opacity=".5" stroke-width="1.5"/><path d="M30 70 L60 54 L90 70 L90 80 Q60 66 30 80z" fill="#fff" opacity=".16"/>`
    // the challenge's icon, big, in metal with a dark edge
    + `<g transform="translate(36 62) scale(2)" fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="${d}" stroke-width="3.6">${k.icon}</g><g stroke="url(#${g1})" stroke-width="2.2">${k.icon}</g></g>`
    // the place, small, on a plate under the icon
    + `<rect x="46" y="111" width="28" height="16" rx="5" fill="${d}" stroke="url(#${g1})" stroke-width="1.5"/>`
    + `<text x="60" y="123.5" text-anchor="middle" font-family="Barlow Condensed,Impact,sans-serif" font-style="italic" font-weight="900" font-size="13" fill="${a}">${place}º</text></svg>`
}
