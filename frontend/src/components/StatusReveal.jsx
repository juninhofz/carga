import { useEffect, useRef, useState } from 'react'
import { STATUS_ART, STATUS_DEFS } from '../lib/status-art.js'
import './status-reveal.css'

// CARGA: the status of a finished activity (lib/activity-status.js) as it is revealed: the level's
// animation (a feather falling, plates locking on, the bar bending, the strike, the fire), then
// the badge with its name, then why. A tap on the drawing plays it again. Shared images keep the
// badge still; this is the app only.
export default function StatusReveal({ status, small = false }) {
  const [run, setRun] = useState(0)
  const box = useRef(null)
  useEffect(() => {
    const el = box.current
    if (!el) return
    el.classList.remove('go')
    void el.offsetWidth
    el.classList.add('go')
  }, [run, status?.id])
  if (!status) return null
  const art = STATUS_ART[status.id] || STATUS_ART.firme
  const n = ['pena', 'firme', 'pesado', 'brutal', 'max'].indexOf(status.id) + 1
  return <div ref={box} className={'sr' + (small ? ' sr-small' : '')} style={{ '--nd': art.badgeAt + 's' }}>
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: '<defs>' + STATUS_DEFS + '</defs>' }} />
    <button type="button" className="sr-stage-btn" onClick={() => setRun(r => r + 1)} aria-label={'Status: ' + status.name + '. Tocar de novo'}>
      <svg className="stage" viewBox="0 0 170 170" aria-hidden="true" dangerouslySetInnerHTML={{ __html: art.svg }} />
    </button>
    <span className={'sr-badge sr-b' + n}><svg><use href={'#i-' + status.id} /></svg>{status.name}</span>
    {status.reason && <p className="sr-why">{status.reason}</p>}
  </div>
}

/** The badge alone, still: lists and headers. */
export function StatusBadge({ status }) {
  if (!status) return null
  const n = ['pena', 'firme', 'pesado', 'brutal', 'max'].indexOf(status.id) + 1
  return <span className={'sr-chip sr-b' + n}><svg viewBox="0 0 24 24" aria-hidden="true"><use href={'#i-' + status.id} /></svg>{status.name}</span>
}
