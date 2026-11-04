import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { MODELS, drawShare } from '../lib/share-card.js'
import { shareImage } from '../lib/share-image.js'
import { SPORTS, hasGps, segmentsOf, fmtKm, fmtClock, fmtPace, fmtSpeed, paceOf } from '../lib/run-track.js'

// CARGA: share an activity as a picture (lib/share-card.js): the models side by side, a preview of
// the chosen one, a photo for the photo model, and Share (the phone's share sheet, or a download).
const PREF = 'carga.share.model'
const readPref = () => { try { return localStorage.getItem(PREF) || '' } catch { return '' } }
const writePref = v => { try { localStorage.setItem(PREF, v) } catch { /* private mode */ } }

const SPORT_ICON = 'M12 3.5a2 2 0 1 0 0 .01M12 7v7M7 9.5h10M12 14l-3 6M12 14l3 6M8 9.5 6 12M16 9.5l2 2.5'

/** What a run, walk, ride or class shows on its picture. */
export function runShareData(run, status) {
  const gps = hasGps(run.type)
  const sport = SPORTS[run.type]
  if (!gps) {
    const h = run.movingSec >= 3600
    return {
      title: sport.name, status, statusLabel: status ? status.name : '',
      big: { v: h ? fmtClock(run.movingSec * 1000).replace(/:\d\d$/, '') : String(Math.round(run.movingSec / 60)), u: h ? 'h' : 'min' },
      stats: [['Calorias', String(run.kcal)], ['Início', new Date(run.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })], ['Tempo', fmtClock(run.movingSec * 1000)]],
      segments: null, icon: SPORT_ICON,
    }
  }
  const ride = run.type === 'ride'
  return {
    title: '', status, statusLabel: status ? status.name : '',
    big: { v: fmtKm(run.distM), u: 'km' },
    stats: [['Tempo', fmtClock(run.movingSec * 1000)], ride ? ['Km/h', fmtSpeed(run.distM, run.movingSec)] : ['Pace', fmtPace(paceOf(run.movingSec, run.distM))], ['Elev.', (run.gainM || 0) + ' m']],
    segments: segmentsOf(run),
  }
}

export default function ShareActivity({ data, name = 'carga.png', close }) {
  const models = MODELS.filter(m => !m.needsRoute || data.segments?.length)
  const [model, setModel] = useState(() => { const p = readPref(); return models.some(m => m.id === p) ? p : models[0].id })
  const [photo, setPhoto] = useState(null)
  const [img, setImg] = useState(null)
  const [busy, setBusy] = useState(false)
  const shown = useRef(null)
  const file = useRef(null)
  useEffect(() => {
    let alive = true
    setImg(prev => (prev ? { ...prev, loading: true } : prev))
    drawShare(data, model, photo).then(blob => {
      if (!alive || !blob) return
      if (shown.current) URL.revokeObjectURL(shown.current)
      shown.current = URL.createObjectURL(blob)
      setImg({ blob, url: shown.current })
    }).catch(() => {})
    return () => { alive = false }
  }, [model, photo])
  useEffect(() => () => { if (shown.current) URL.revokeObjectURL(shown.current) }, [])
  const pick = m => { setModel(m); writePref(m); if (m === 'photo' && !photo) file.current?.click() }
  const onPhoto = e => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const i = new Image()
    i.onload = () => setPhoto(i)
    i.src = URL.createObjectURL(f)
  }
  const share = async () => { setBusy(true); await shareImage(img.blob, name, 'CARGA'); setBusy(false); close?.() }
  return <div className="sha">
    <div className="sha-h"><b>Compartilhar</b><button type="button" className="iconbtn" onClick={close} aria-label="Fechar"><Icon name="xmark" /></button></div>
    <div className="sha-models" role="radiogroup" aria-label="Modelo">
      {models.map(m => <button key={m.id} type="button" role="radio" aria-checked={model === m.id} className={'sha-m' + (model === m.id ? ' on' : '')} onClick={() => pick(m.id)}>{m.name}</button>)}
    </div>
    <div className={'sha-prev' + (model === 'sticker' ? ' clear' : '')}>{img?.url ? <img src={img.url} alt="Prévia da imagem" className={img.loading ? 'loading' : ''} /> : <div className="sha-ph" />}</div>
    {model === 'photo' && <button type="button" className="sha-photo" onClick={() => file.current?.click()}><Icon name="camera" />{photo ? 'Trocar a foto' : 'Escolher uma foto'}</button>}
    <input ref={file} type="file" accept="image/*" hidden onChange={onPhoto} />
    <button type="button" className="sha-go" disabled={!img?.blob || busy} onClick={share}><Icon name="share" />Compartilhar</button>
  </div>
}
