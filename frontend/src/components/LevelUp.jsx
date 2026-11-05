import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { vibrate } from '../lib/sound.js'
import './level-up.css'

// CARGA: a new level, said once over Home (components/LevelCard.jsx). Every level is one more plate
// on the bar: an orange plate slides on from each side, clanks into place, the collars lock and the
// count turns to the new level (approved 2026-11-05, option C). A tap anywhere, or a few seconds,
// closes it.
export const LEVEL_UP_MS = 4200

export default function LevelUp({ level, name, left, onClose }) {
  useEffect(() => {
    vibrate([14, 60, 30])
    const tm = setTimeout(onClose, LEVEL_UP_MS)
    return () => clearTimeout(tm)
  }, [level, onClose])
  return createPortal(<div className="lvup" role="status" onClick={onClose}>
    <div className="lvup-stage" aria-label={'Nível ' + level + '. ' + name}>
      <div className="lvup-count">Nível <b>{level}</b></div>
      <svg viewBox="0 0 300 220" aria-hidden="true">
        <g className="lvup-rig">
          <rect className="lvup-bar" x="6" y="104" width="288" height="12" rx="4" />
          <rect className="lvup-bar" x="96" y="99" width="108" height="22" rx="4" opacity=".55" />
          <rect className="lvup-old" x="70" y="58" width="16" height="104" rx="4" /><rect className="lvup-old" x="52" y="66" width="16" height="88" rx="4" />
          <rect className="lvup-old" x="214" y="58" width="16" height="104" rx="4" /><rect className="lvup-old" x="232" y="66" width="16" height="88" rx="4" />
          <g className="lvup-nl"><rect className="lvup-new" x="30" y="50" width="20" height="120" rx="5" /></g>
          <g className="lvup-nr"><rect className="lvup-new" x="250" y="50" width="20" height="120" rx="5" /></g>
          <rect className="lvup-collar lvup-cl" x="18" y="100" width="10" height="20" rx="2" />
          <rect className="lvup-collar lvup-cr" x="272" y="100" width="10" height="20" rx="2" />
          <circle className="lvup-hit" cx="50" cy="110" r="22" /><circle className="lvup-hit" cx="250" cy="110" r="22" />
        </g>
      </svg>
      <div className="lvup-plus" aria-hidden="true">+1 NÍVEL</div>
      <div className="lvup-cap">
        <div className="lvup-t">Mais <em>carga</em></div>
        <div className="lvup-s"><b>{name}</b>{left > 0 ? ' · faltam ' + left + ' pts para o ' + (level + 1) : ''}</div>
      </div>
    </div>
  </div>, document.body)
}
