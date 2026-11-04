import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../lib/i18n.js'
import { fmtNum } from '../lib/format.js'
import { markSVG } from '../lib/carga-mark.js'
import { TIERS } from '../lib/carga-level.js'

/* The rank card (lib/carga-level.js TIERS): the rank's letter as the emblem, leaning and
   metal-filled in the rank's colour with a slash of light through it, the CARGA mark as the seal
   in the corner, and the owner's numbers below. The frame gets finer as the rank climbs (sparks,
   a foil sheen, holographic, living fire). The big card leans after the finger and throws sparks
   when tapped (useLively). RankUp plays it turning over into the next rank; CardView just shows it. */

const ROMAN = ['I', 'II', 'III', 'IV', 'V']
const MARK = markSVG({ ground: 'none' })
// '#rrggbb' at an alpha, for the glows (no color-mix: older Android WebViews lack it)
const alpha = (hex, a) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
const vars = k => ({ '--c': k.c, '--c2': k.c2, '--cg': alpha(k.c, 0.55), '--ct': alpha(k.c, 0.22) })
const stillMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }

let uid = 0
const FONT = '&quot;Barlow Condensed&quot;, &quot;Arial Narrow&quot;, Impact, sans-serif'
/** The rank's letter as SVG: a carved shadow below, the metal letter cut in two by a slash of light. */
function letterSVG(k) {
  const id = 'rl' + (uid++)
  const symbol = k.r === '★' || k.r === '∞'
  const len = [...k.r].length
  const size = symbol ? 150 : len === 1 ? 190 : len === 2 ? 128 : 92
  const font = symbol ? 'Arial, sans-serif' : FONT
  const y = k.r === '∞' ? 150 : k.r === '★' ? 158 : 168
  const text = (fill, extra = '') => `<text x="100" y="${y}" text-anchor="middle" font-family="${font}" font-style="italic" font-weight="900" font-size="${size}" letter-spacing="-4" fill="${fill}" ${extra}>${k.r}</text>`
  const metal = `url(#${id}m)`, edge = 'stroke="#0d0d0d" stroke-width="6" paint-order="stroke" stroke-linejoin="round"'
  return `<svg viewBox="0 0 200 200" aria-hidden="true"><defs>` +
    `<linearGradient id="${id}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".38" stop-color="${k.c}"/><stop offset=".52" stop-color="${k.c2}"/><stop offset=".6" stop-color="${k.c}"/><stop offset="1" stop-color="${k.c2}"/></linearGradient>` +
    `<clipPath id="${id}a"><polygon points="-20,0 146,0 26,200 -20,200"/></clipPath><clipPath id="${id}b"><polygon points="154,0 220,0 220,200 34,200"/></clipPath></defs>` +
    `<g transform="translate(6 0)">${text(k.c2, 'transform="translate(7 8)" opacity=".9"')}</g>` +
    `<g clip-path="url(#${id}a)">${text(metal, edge)}</g>` +
    `<g clip-path="url(#${id}b)" transform="translate(4 -3)">${text(metal, edge)}</g>` +
    `<line class="rc-slash" x1="156" y1="-6" x2="24" y2="206" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`
}

function Face({ rank, level, name, xp, stats }) {
  const k = TIERS[rank] || TIERS[0]
  const letter = useMemo(() => letterSVG(k), [k])
  const step = level <= TIERS.length * 5 ? ' ' + ROMAN[(level - 1) % 5] : ''
  return <div className="rc-in">
    <div className="rc-top">
      <span className="rc-seal"><span className="rc-m" dangerouslySetInnerHTML={{ __html: MARK }} /><b>CARGA</b></span>
      {/* the card's own number comes with accounts (who reached the rank first, CARGA-ROADMAP.md) */}
      <span className="rc-tag">Nº —</span>
    </div>
    <div className="rc-art"><span className="rc-aura" /><span className="rc-ring" /><span className="rc-letter" dangerouslySetInnerHTML={{ __html: letter }} /></div>
    <div className="rc-foot">
      <div className="rc-name">{t(k.name)}{step}</div>
      <div className="rc-lvl">{name ? name + ' · ' : ''}{t('Level {0}', level)}</div>
      {xp && <>
        <div className="rc-xp"><i style={{ width: Math.round(Math.min(1, xp.into / xp.step) * 100) + '%' }} /></div>
        <div className="rc-xpt"><span>{fmtNum(xp.into)} {t('pts')}</span><span>{t('level {0}', level + 1)}</span></div>
      </>}
      {stats && <div className="rc-stats">
        <div><b>{fmtNum(stats.workouts)}</b><span>{t('workouts')}</span></div>
        <div><b>{fmtNum(stats.prs)}</b><span>{t('records')}</span></div>
        <div><b>{fmtNum(stats.weeks)}</b><span>{t('weeks')}</span></div>
      </div>}
    </div>
    <span className="rc-holo" /><span className="rc-glare" />
  </div>
}

/** The card, still. `size` 'sm' for Home's card, 'lg' for the big one: the same card at two sizes. */
export function RankCard({ rank, level, name, xp, stats, risk = false, size = 'sm', twoFaced = false }) {
  const k = TIERS[rank] || TIERS[0]
  // the small card is the same card, only smaller: it shows everything the big one does
  const face = <Face rank={rank} level={level} name={name} xp={xp} stats={stats} />
  return <div className={`rc rc-${size} ${k.fx}${risk ? ' risk' : ''}`} style={vars(k)} role="img" aria-label={t('Rank {0}: {1}, level {2}', k.r, t(k.name), level)}>
    {twoFaced
      ? <><div className="rc-front">{face}</div><div className="rc-back"><span className="rc-m" dangerouslySetInnerHTML={{ __html: MARK }} /></div></>
      : face}
  </div>
}

/**
 * The big card answers touch: it leans after the finger (or the mouse) with the light following,
 * and a quick tap pops it and throws sparks in the rank's colour. `locked` pauses it (mid-turn).
 */
function useLively(ref, colour, locked) {
  useEffect(() => {
    const holder = ref.current
    if (!holder || stillMotion()) return undefined
    const card = () => holder.querySelector('.rc')
    let down = null
    const move = e => {
      const c = card()
      if (!c || locked.current) return
      const r = c.getBoundingClientRect()
      const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
      c.classList.add('live')
      c.style.transform = `rotateY(${((x - 0.5) * 24).toFixed(1)}deg) rotateX(${((0.5 - y) * 24).toFixed(1)}deg)`
      c.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); c.style.setProperty('--my', (y * 100).toFixed(1) + '%')
    }
    const rest = () => { const c = card(); if (c) { c.classList.remove('live'); c.style.transform = '' } }
    const press = e => { down = { x: e.clientX, y: e.clientY, at: Date.now() } }
    const release = e => {
      const tap = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8 && Date.now() - down.at < 350
      if (e.pointerType !== 'mouse') rest()
      down = null
      const c = card()
      if (!tap || !c || locked.current) return
      c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop')
      const box = holder.getBoundingClientRect()
      for (let i = 0; i < 14; i++) {
        const s = document.createElement('span')
        s.className = 'rc-spark'
        const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70
        s.style.cssText = `--sc:${colour};left:${e.clientX - box.left}px;top:${e.clientY - box.top}px;--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d).toFixed(0)}px`
        holder.appendChild(s)
        setTimeout(() => s.remove(), 750)
      }
    }
    holder.addEventListener('pointermove', move)
    holder.addEventListener('pointerleave', rest)
    holder.addEventListener('pointercancel', rest)
    holder.addEventListener('pointerdown', press)
    holder.addEventListener('pointerup', release)
    return () => {
      holder.removeEventListener('pointermove', move); holder.removeEventListener('pointerleave', rest)
      holder.removeEventListener('pointercancel', rest); holder.removeEventListener('pointerdown', press); holder.removeEventListener('pointerup', release)
    }
  }, [ref, colour, locked])
}

function useEscape(onClose) {
  useEffect(() => {
    const key = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
}

/** The card shown big, to lean and admire; the button or Escape closes it. */
export function CardView({ rank, level, name, xp, stats, risk, onClose }) {
  const ref = useRef(null), locked = useRef(false)
  useLively(ref, (TIERS[rank] || TIERS[0]).c, locked)
  useEscape(onClose)
  return createPortal(<div className="rankup" role="dialog" aria-modal="true" aria-label={t('Your rank card')}>
    <div className="rankup-hold" ref={ref}><RankCard rank={rank} level={level} name={name} xp={xp} stats={stats} risk={risk} size="lg" /></div>
    <div className="rankup-hint">{t('Drag across the card · tap it')}</div>
    <button type="button" className="rankup-ok" onClick={onClose}>{t('Close')}</button>
  </div>, document.body)
}

/**
 * A new rank: the old card charges up, turns over and comes back as the new one, with a flash and
 * the system's line. `down` plays the same turn for a rank lost: the card dims instead of flashing.
 * Over the whole screen; the button or Escape closes it.
 */
export function RankUp({ from, to, down = false, level, name, xp, stats, onClose }) {
  const still = useMemo(stillMotion, [])
  const [phase, setPhase] = useState(still ? 'done' : 'charge')
  const [shown, setShown] = useState(still ? to : from)
  const ref = useRef(null), locked = useRef(!still)
  useLively(ref, (TIERS[to] || TIERS[0]).c, locked)
  useEscape(onClose)
  useEffect(() => {
    if (still) return undefined
    const tms = [
      setTimeout(() => setPhase('turn'), 900),
      // halfway round only the back faces the viewer: that is when the front becomes the new rank
      setTimeout(() => setShown(to), 1380),
      setTimeout(() => { setPhase('done'); locked.current = false }, 1900),
    ]
    return () => tms.forEach(clearTimeout)
  }, [still, to])
  const k = TIERS[to] || TIERS[0]
  return createPortal(<div className={'rankup' + (down ? ' down' : '')} role="dialog" aria-modal="true" aria-label={t('New rank')}>
    <div className="rankup-hold" ref={ref}>
      <div className={'rankup-flip ' + phase}><div className="rankup-flipper"><RankCard rank={shown} level={level} name={name} xp={xp} stats={stats} size="lg" twoFaced /></div></div>
    </div>
    {phase === 'done' && <div className="rankup-flash" />}
    <div className={'rankup-sys' + (phase === 'done' ? ' show' : '')} aria-live="polite">
      {phase === 'done' && <><small>{down ? t('SYSTEM · YOUR CARGA DROPPED') : t('SYSTEM · YOU AWOKE')}</small>{t('Rank {0} · {1}', k.r, t(k.name))}</>}
    </div>
    <button type="button" className="rankup-ok" onClick={onClose}>{t('Continue')}</button>
  </div>, document.body)
}
