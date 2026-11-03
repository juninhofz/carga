import { useMemo } from 'react'
import { markSVG } from '../lib/carga-mark.js'

// The CARGA mark, still: the loaded bar bent into a C (lib/carga-mark.js). By default it follows
// the theme: the accent bar, plates in the text colour, hairlines in the page's background.
export default function CargaMark({ height = 64, ground = 'var(--bg)', bar = 'var(--acc)', plate = 'var(--label)', className = '' }) {
  const html = useMemo(() => markSVG({ ground, bar, plate }), [ground, bar, plate])
  return <span className={'carga-mark ' + className} style={{ height }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
}
