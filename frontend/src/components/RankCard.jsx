import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../lib/i18n.js'
import { markSVG } from '../lib/carga-mark.js'
import { TIERS } from '../lib/carga-level.js'

/* The rank card (lib/carga-level.js TIERS): the CARGA mark in the rank's aura, the rank's letter
   and name, the level and the owner's name, on a frame that gets finer as the rank climbs (sparks,
   a foil sheen, holographic, living fire). RankUp plays the card turning over into the next rank. */

const ROMAN = ['I', 'II', 'III', 'IV', 'V']
const MARK = markSVG({ ground: 'none' })
// '#rrggbb' at an alpha, for the glows (no color-mix: older Android WebViews lack it)
const alpha = (hex, a) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
const vars = k => ({ '--c': k.c, '--c2': k.c2, '--cg': alpha(k.c, 0.55), '--ct': alpha(k.c, 0.22) })

function Face({ rank, level, name }) {
  const k = TIERS[rank] || TIERS[0]
  return <div className="rc-in">
    <div className="rc-top"><span className="rc-rank">{k.r}</span><span className="rc-brand">CARGA</span></div>
    <div className="rc-art"><span className="rc-aura" /><span className="rc-ring" /><span className="rc-mark" dangerouslySetInnerHTML={{ __html: MARK }} /></div>
    <div className="rc-foot">
      <div className="rc-name">{t(k.name)}</div>
      <div className="rc-lvl">{t('Level {0}', level)}{level <= TIERS.length * 5 ? ' · ' + t(k.name) + ' ' + ROMAN[(level - 1) % 5] : ''}</div>
      <div className="rc-meta"><span>{name || 'CARGA'}</span><span>Nº {String(level).padStart(3, '0')}</span></div>
    </div>
  </div>
}

/** The card, still. `size` 'sm' for Home's card, 'lg' on the level-up stage. */
export function RankCard({ rank, level, name, size = 'sm', twoFaced = false }) {
  const k = TIERS[rank] || TIERS[0]
  return <div className={`rc rc-${size} ${k.fx}`} style={vars(k)} role="img" aria-label={t('Rank {0}: {1}, level {2}', k.r, t(k.name), level)}>
    {twoFaced
      ? <><div className="rc-front"><Face rank={rank} level={level} name={name} /></div><div className="rc-back"><span className="rc-mark" dangerouslySetInnerHTML={{ __html: MARK }} /></div></>
      : <Face rank={rank} level={level} name={name} />}
  </div>
}

/**
 * A new rank: the old card charges up, turns over and comes back as the new one, with a flash and
 * the system's line. Over the whole screen; a tap anywhere, or the button, closes it.
 */
export function RankUp({ from, to, level, name, onClose }) {
  const still = useMemo(() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }, [])
  const [phase, setPhase] = useState(still ? 'done' : 'charge')
  const [shown, setShown] = useState(still ? to : from)
  useEffect(() => {
    if (still) return undefined
    const tms = [
      setTimeout(() => setPhase('turn'), 900),
      // halfway round only the back faces the viewer: that is when the front becomes the new rank
      setTimeout(() => setShown(to), 1380),
      setTimeout(() => setPhase('done'), 1900),
    ]
    return () => tms.forEach(clearTimeout)
  }, [still, to])
  useEffect(() => {
    const key = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  const k = TIERS[to] || TIERS[0]
  return createPortal(<div className="rankup" role="dialog" aria-modal="true" aria-label={t('New rank')} onClick={onClose}>
    <div className={'rankup-flip ' + phase}><div className="rankup-flipper"><RankCard rank={shown} level={level} name={name} size="lg" twoFaced /></div></div>
    {phase === 'done' && <div className="rankup-flash" />}
    <div className={'rankup-sys' + (phase === 'done' ? ' show' : '')} aria-live="polite">
      {phase === 'done' && <><small>{t('SYSTEM · YOU AWOKE')}</small>{t('Rank {0} · {1}', k.r, t(k.name))}</>}
    </div>
    <button type="button" className="rankup-ok" onClick={onClose}>{t('Continue')}</button>
  </div>, document.body)
}
