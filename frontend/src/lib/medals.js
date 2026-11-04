// CARGA: the medals a challenge's top three take to their profile (approved style: the medal on a
// ribbon). The kind follows how the challenge scored: km → a run medal, CARGA points → a CARGA
// medal, anything else (days, workouts, minutes) → a gym medal. Gold, silver, bronze by place.
const PLACE = {
  1: ['#fff1b8', '#ffd166', '#b8860b', '#5a3d00'],
  2: ['#f3f4f6', '#cbd5e1', '#64748b', '#1f2937'],
  3: ['#ffd2a8', '#d97706', '#7c3a0a', '#3b1a04'],
}
const KIND = {
  run: { name: 'Corrida', ribbon: '#3fa9ff', icon: '<circle cx="15.6" cy="4.6" r="1.9"/><path d="M14.2 8.2 11.4 13.2M14.2 8.2l2.4 2.2 2.2-1M14.2 8.2l-3 .4-1.8 2.4M11.4 13.2l3.2 2-.8 4.6h1.8M11.4 13.2l-1.8 3.4-3.8.8M2.8 9.6h3.4M2.2 12.6h3.2"/>' },
  gym: { name: 'Academia', ribbon: '#ff6b00', icon: '<path d="M3 12h18M6 7v10M9 9v6M18 7v10M15 9v6"/>' },
  carga: { name: 'CARGA', ribbon: '#ffd166', icon: '<path d="M16.5 6A7.5 7.5 0 1 0 16.5 18" stroke-width="3.2"/><path d="M15 3.5v4M18.5 3.5v4M15 16.5v4M18.5 16.5v4"/>' },
}
export const medalKind = scoring => (scoring === 'km' || scoring === 'race' ? 'run' : scoring === 'carga' ? 'carga' : 'gym')
export const medalName = kind => KIND[kind]?.name || 'Academia'

let n = 0
/** The medal as SVG markup. */
export function medalSVG(kind, place) {
  const [hi, mid, lo, ink] = PLACE[place] || PLACE[3]
  const k = KIND[kind] || KIND.gym
  const g = 'md' + (++n)
  return `<svg viewBox="0 0 120 150" class="medal" role="img" aria-label="${place}º lugar · ${k.name}"><defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".5" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient></defs>`
    + `<path d="M38 0h18l12 46H50zM64 0h18L70 46H52z" fill="${k.ribbon}"/><path d="M38 0h18l12 46H50z" fill="rgba(0,0,0,.18)"/>`
    + `<circle cx="60" cy="92" r="46" fill="url(#${g})"/><circle cx="60" cy="92" r="38" fill="none" stroke="${lo}" stroke-width="2" opacity=".6"/><circle cx="60" cy="92" r="30" fill="rgba(0,0,0,.18)"/>`
    + `<g transform="translate(42 74) scale(1.5)" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${k.icon}</g>`
    + `<circle cx="94" cy="128" r="16" fill="#111" stroke="${mid}" stroke-width="3"/><text x="94" y="134" text-anchor="middle" font-family="Barlow Condensed,Impact,sans-serif" font-weight="900" font-size="18" fill="${mid}">${place}º</text></svg>`
}
