import { useEffect, useMemo, useRef } from 'react'
import BodyMap from './BodyMap.jsx'
import { musclesOf } from '../lib/muscles.js'
import { OWN_FIGURES } from '../lib/brand.js'
import { drawExercise } from '../lib/carga-figure.js'

// Stands in for a built-in exercise's picture while the build ships no media of its own. CARGA
// draws its own figure doing the movement, with the worked muscles glowing (lib/carga-figure.js);
// otherwise it is the body map with those muscles lit up (BodyMap's geometry is MIT, NOTICE.md).
// Media.jsx falls back to it once the still will not load, so dropping real files into
// catalogue/media/still and /clip brings them back with no code change.
export default function ExerciseFigure({ ex, body, className = '', animate = false }) {
  const load = useMemo(() => musclesOf(ex), [ex])
  if (OWN_FIGURES) return <CargaFigure ex={ex} load={load} className={className} animate={animate} />
  return <div className={'exfig ' + className} aria-hidden="true"><BodyMap load={load} body={body} /></div>
}

// One repetition, down and back, in this many milliseconds.
const PERIOD = 2800

// The figure is drawn straight into the DOM and posed every frame; React only owns the holder.
// Still (a thumbnail, a paused card, reduced motion) it holds the hardest point of the movement,
// where the pose says the most and the heat is at its brightest.
function CargaFigure({ ex, load, className, animate }) {
  const ref = useRef(null)
  useEffect(() => {
    const holder = ref.current
    if (!holder) return undefined
    const { set } = drawExercise(holder, ex, load)
    const still = !animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    if (still) set(1)
    else {
      const t0 = performance.now()
      const tick = now => {
        set(0.5 - 0.5 * Math.cos(2 * Math.PI * (((now - t0) % PERIOD) / PERIOD)))
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }
    return () => { cancelAnimationFrame(raf); holder.textContent = '' }
  }, [ex, load, animate])
  return <div ref={ref} className={'exfig cfig ' + className} aria-hidden="true" />
}
