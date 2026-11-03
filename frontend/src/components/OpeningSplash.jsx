import { useEffect, useRef, useState } from 'react'
import { buildOpening, openingScene, CUTS } from '../lib/carga-opening.js'
import { APP_NAME } from '../lib/brand.js'

// The opening over everything while the app starts (lib/carga-opening.js). The full cut plays on
// the first launch and on the first after an update, the quick one on every other launch; a tap
// skips it, and with reduced motion there is none. It sits above the boot screen (index.html), so
// whichever of the two is up the user sees one dark screen, never a flash between them.
const SEEN_KEY = 'carga_opening_v'
const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'

export function openingCut(seen, version = VERSION) {
  return seen === version ? 'quick' : 'full'
}

function readSeen() { try { return localStorage.getItem(SEEN_KEY) } catch { return null } }
function markSeen() { try { localStorage.setItem(SEEN_KEY, VERSION) } catch { /* private mode: the full cut again next time */ } }
const reducedMotion = () => { try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches } catch { return false } }

export default function OpeningSplash() {
  const [phase, setPhase] = useState(() => (reducedMotion() ? 'gone' : 'playing'))
  const svg = useRef(null)
  const word = useRef(null)
  useEffect(() => {
    if (phase !== 'playing' || !svg.current) return
    const cut = openingCut(readSeen())
    markSeen()
    const pose = buildOpening(svg.current)
    const total = CUTS[cut].total
    let raf = 0, start = null
    const tick = now => {
      if (start === null) start = now
      const t = Math.min(now - start, total)
      const sc = openingScene(t, cut)
      pose(sc)
      if (word.current) {
        word.current.style.opacity = sc.word
        word.current.style.transform = `translateY(${((1 - sc.word) * 12).toFixed(1)}px)`
      }
      if (t < total) raf = requestAnimationFrame(tick)
      else setTimeout(() => setPhase('leaving'), 250)     // a beat on the finished mark
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])
  useEffect(() => {
    if (phase !== 'leaving') return
    const id = setTimeout(() => setPhase('gone'), 260)
    return () => clearTimeout(id)
  }, [phase])
  if (phase === 'gone') return null
  return (
    <div className={'opening' + (phase === 'leaving' ? ' out' : '')} onClick={() => setPhase('leaving')} aria-hidden="true">
      <svg ref={svg} viewBox="0 0 240 240" />
      <div ref={word} className="opening-word" style={{ opacity: 0 }}>{APP_NAME}</div>
    </div>
  )
}
