import { useEffect, useRef, useState } from 'react'
import { handOff } from '../lib/post-handoff.js'
import { useCloud } from './CloudAccount.jsx'
import Icon from './Icon.jsx'
import { MODELS, GYM_MODELS, drawShare } from '../lib/share-card.js'
import { SHOW_ITEMS, SHOW_DEFAULT } from '../lib/share-gym.js'
import { shareImage } from '../lib/share-image.js'
import { SPORTS, hasGps, segmentsOf, fmtKm, fmtClock, fmtPace, fmtSpeed, paceOf } from '../lib/run-track.js'
import { useStore } from '../store/useStore.js'
import { levelCard, TIERS } from '../lib/carga-level.js'
import { t } from '../lib/i18n.js'

// CARGA: share an activity as a picture (lib/share-card.js): the models side by side, a preview of
// the chosen one, a photo for the photo model, and Share (the phone's share sheet, or a download).
const PREF = 'carga.share.model'
const readPref = () => { try { return localStorage.getItem(PREF) || '' } catch { return '' } }
const writePref = v => { try { localStorage.setItem(PREF, v) } catch { /* private mode */ } }
// what the person chose to show on a workout's picture, kept for next time
const SHOW = 'carga.share.show'
const readShow = () => { try { return { ...SHOW_DEFAULT, ...JSON.parse(localStorage.getItem(SHOW) || '{}') } } catch { return { ...SHOW_DEFAULT } } }
const writeShow = v => { try { localStorage.setItem(SHOW, JSON.stringify(v)) } catch { /* private mode */ } }

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
      segments: null, icon: SPORT_ICON, at: run.start,
    }
  }
  const ride = run.type === 'ride'
  return {
    title: '', status, statusLabel: status ? status.name : '',
    big: { v: fmtKm(run.distM), u: 'km' },
    stats: [['Tempo', fmtClock(run.movingSec * 1000)], ride ? ['Km/h', fmtSpeed(run.distM, run.movingSec)] : ['Pace', fmtPace(paceOf(run.movingSec, run.distM))], ['Elev.', (run.gainM || 0) + ' m']],
    segments: segmentsOf(run), at: run.start,
  }
}

export default function ShareActivity({ data: given, name = 'carga.png', close, postKey = '' }) {
  const signedIn = !!useCloud(c => c.user)
  // the rank card model draws this person's card as it stands now
  const S = useStore(s => s.S)
  const userName = useStore(s => s.user?.name || '')
  const cloudName = useCloud(c => c.profile?.name || '')
  const numbers = useCloud(c => c.numbers)
  const data = useRef(null)
  if (!data.current) {
    // the rank card as it stands now (components/RankCard.jsx draws the same), and for a workout
    // the points it brought and the level it made: the card with it against the card without it
    let card = null, pts = 0, levelUp = null
    try {
      const now = new Date()
      const L = levelCard(S, now), k = TIERS[L.rank] || TIERS[0]
      card = { tier: { ...k, label: t(k.name) }, level: L.level, name: userName || cloudName, xp: { into: L.into, step: L.step }, stats: L.stats, number: numbers?.[L.rank] }
      if (given.wid) {
        const B = levelCard({ ...S, workouts: (S.workouts || []).filter(x => x.id !== given.wid) }, now)
        pts = Math.max(0, L.total - B.total)
        if (L.level > B.level) levelUp = { from: B.level, to: L.level, rankFrom: B.rank, rankTo: L.rank }
      }
    } catch { /* no card */ }
    data.current = { ...given, card, pts, levelUp }
  }
  const gym = !!data.current.list?.length
  // a gym workout (it lists its exercises) gets the gym's models; a run or a class keeps its own
  const models = (gym ? GYM_MODELS : MODELS).filter(m => (!m.needsRoute || data.current.segments?.length) && (!m.needs || data.current[m.needs]))
  const [show, setShow] = useState(readShow)
  const [model, setModel] = useState(() => { const p = readPref(); return models.some(m => m.id === p) ? p : models[0].id })
  const [photo, setPhoto] = useState(null)
  const [img, setImg] = useState(null)
  const [busy, setBusy] = useState(false)
  const shown = useRef(null)
  const file = useRef(null)
  useEffect(() => {
    let alive = true
    setImg(prev => (prev ? { ...prev, loading: true } : prev))
    drawShare(data.current, model, photo, show).then(blob => {
      if (!alive || !blob) return
      if (shown.current) URL.revokeObjectURL(shown.current)
      shown.current = URL.createObjectURL(blob)
      setImg({ blob, url: shown.current })
    }).catch(() => {})
    return () => { alive = false }
  }, [model, photo, show])
  useEffect(() => () => { if (shown.current) URL.revokeObjectURL(shown.current) }, [])
  const pick = m => { setModel(m); writePref(m); if ((m === 'photo' || m === 'band') && !photo) file.current?.click() }
  const toggle = id => setShow(v => { const n = { ...v, [id]: v[id] === false }; writeShow(n); return n })
  // the switches this model has, and only for what this workout has (a level it made, a record...)
  const cur = models.find(m => m.id === model)
  const has = { card: !!data.current.card, levelup: !!data.current.levelUp, pts: data.current.pts > 0, pr: !!data.current.prNames?.length }
  const switches = gym ? SHOW_ITEMS.filter(i => (!cur?.uses || cur.uses.includes(i.id)) && has[i.id] !== false) : []
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
    {switches.length > 0 && <div className="sha-show" role="group" aria-label="O que mostrar">
      <span>Mostrar</span>
      {switches.map(i => <button key={i.id} type="button" aria-pressed={show[i.id] !== false} className={'sha-t' + (show[i.id] !== false ? ' on' : '')} onClick={() => toggle(i.id)}>{show[i.id] !== false && <Icon name="check" />}{i.name}</button>)}
    </div>}
    {(model === 'photo' || model === 'band') && <button type="button" className="sha-photo" onClick={() => file.current?.click()}><Icon name="camera" />{photo ? 'Trocar a foto' : 'Escolher uma foto'}</button>}
    <input ref={file} type="file" accept="image/*" hidden onChange={onPhoto} />
    <button type="button" className="sha-go" disabled={!img?.blob || busy} onClick={share}><Icon name="share" />Compartilhar</button>
    {/* CARGA: the same activity straight into a challenge, this picture as its photo */}
    {postKey && signedIn && <button type="button" className="sha-post" disabled={!img?.blob} onClick={() => { handOff({ key: postKey, photo: img.blob }); close?.(); location.hash = '#/desafios/postar' }}><Icon name="trophy" />Postar num desafio</button>}
  </div>
}
