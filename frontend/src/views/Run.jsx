import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import StatusReveal, { StatusBadge } from '../components/StatusReveal.jsx'
import { runStatus } from '../lib/activity-status.js'
import ShareActivity, { runShareData } from '../components/ShareActivity.jsx'
import { useUI } from '../store/useUI.js'
import { useStore } from '../store/useStore.js'
import Icon from '../components/Icon.jsx'
import RunMap from '../components/RunMap.jsx'
import { useRun, watchGps, releaseGps, startRun, pauseRun, resumeRun, finishRun, discardRun, setPrefs, lockOn } from '../lib/run-recorder.js'
import { SPORTS, hasGps, elapsedMs, movingMsNow, currentPace, paceOf, fmtClock, fmtPace, fmtKm, fmtSpeed,
  pointsOf, segmentsOf, bestEfforts, runDay } from '../lib/run-track.js'

/* CARGA runs: start, record and look back on a run, a walk or a ride, with the GPS. Three screens:
   the start (the map where you are, the GPS signal, the sport, and the runs so far), the live
   recording (full screen: time, distance, pace, the line growing on the map) and the run itself
   (map, numbers, splits per km, best efforts, the pace along the way).

   Written in Portuguese only for now, like the Personal. */

const useNow = (on, ms = 1000) => {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { if (!on) return; const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id) }, [on, ms])
  return now
}
const dateLine = ms => new Date(ms).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) + ' às ' + new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const hm = sec => { const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60); return h ? `${h}h ${m}min` : `${m}min` }

/** A run's route drawn small, for the list. */
export function RouteThumb({ run, size = 64 }) {
  const d = useMemo(() => {
    const pts = pointsOf(run)
    if (pts.length < 2) return ''
    const k = Math.cos((pts[0].lat * Math.PI) / 180)
    const xs = pts.map(p => p.lng * k), ys = pts.map(p => -p.lat)
    const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0 || 1e-9, h = Math.max(...ys) - y0 || 1e-9
    const s = (size - 12) / Math.max(w, h), ox = (size - w * s) / 2, oy = (size - h * s) / 2
    const cuts = new Set(run.brk || [])
    return pts.map((p, i) => (i === 0 || cuts.has(i) ? 'M' : 'L') + (ox + (xs[i] - x0) * s).toFixed(1) + ' ' + (oy + (ys[i] - y0) * s).toFixed(1)).join('')
  }, [run.trk, size])
  return <svg className="run-thumb" viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
    {d ? <path d={d} fill="none" stroke="var(--run-acc)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" /> : <Icon name={SPORTS[run.type]?.icon || 'cargaRun'} />}
  </svg>
}

const gpsLabel = (gps, fix) => ({
  off: 'GPS desligado', searching: 'Procurando GPS…', denied: 'Sem permissão de localização', unsupported: 'Este aparelho não tem GPS',
  ok: 'GPS pronto' + (fix ? ` · ±${Math.round(fix.acc)} m` : ''), weak: 'Sinal fraco' + (fix ? ` · ±${Math.round(fix.acc)} m` : ''),
}[gps] || '')

function weekTotals(runs) {
  const now = new Date()
  const dow = (now.getDay() + 6) % 7
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow).getTime()
  const wk = runs.filter(r => r.start >= from)
  return { n: wk.length, km: wk.reduce((a, r) => a + r.distM, 0), sec: wk.reduce((a, r) => a + r.movingSec, 0), gain: wk.reduce((a, r) => a + (r.gainM || 0), 0) }
}

function RunStart() {
  const nav = useNavigate()
  const runs = useStore(s => s.S.runs) || []
  const { gps, fix, prefs } = useRun()
  const [count, setCount] = useState(0)
  useEffect(() => { watchGps(); return () => releaseGps() }, [])
  useEffect(() => {
    if (!count) return
    if (count === 1) { const id = setTimeout(() => { setCount(0); startRun(prefs.type) }, 900); return () => clearTimeout(id) }
    const id = setTimeout(() => setCount(count - 1), 900)
    return () => clearTimeout(id)
  }, [count])
  const wk = weekTotals(runs)
  const ready = gps === 'ok' || gps === 'weak'
  return <div className="narrow run">
    <div className="hdr"><div><h1>Corrida</h1><div className="sub">GPS, pace e parciais por km</div></div>
      <button className="iconbtn" onClick={() => nav(-1)} aria-label="Fechar"><Icon name="xmark" /></button></div>

    <div className="card run-startcard">
      <RunMap segments={[]} here={fix} live className="run-map-start" />
      <div className={'run-gps ' + gps}><i />{gpsLabel(gps, fix)}</div>
      <div className="run-sports" role="radiogroup" aria-label="Atividade">
        {Object.entries(SPORTS).filter(([k]) => hasGps(k)).map(([k, s]) => <button key={k} type="button" role="radio" aria-checked={prefs.type === k}
          className={'run-sport' + (prefs.type === k ? ' on' : '')} onClick={() => setPrefs({ type: k })}><Icon name={s.icon} />{s.name}</button>)}
      </div>
      <button type="button" className="run-go" disabled={gps === 'denied' || gps === 'unsupported'} onClick={() => { lockOn(); setCount(3) }}>
        {ready ? 'Iniciar' : 'Iniciar sem esperar o GPS'}</button>
      <label className="run-opt"><input type="checkbox" checked={!!prefs.voice} onChange={e => setPrefs({ voice: e.target.checked })} /> Avisos por voz a cada km</label>
      {gps === 'denied' && <p className="muted small">Libere a localização para este site nas configurações do navegador e abra esta tela de novo.</p>}
      <p className="muted small run-tip">Deixe o CARGA aberto na tela durante a atividade: com a tela bloqueada o navegador para de receber o GPS. A tela fica acesa sozinha enquanto grava.</p>
    </div>

    <div className="card">
      <div className="run-h"><span className="lv-h">Esta semana</span></div>
      <div className="run-week">
        <div><b>{fmtKm(wk.km)}</b><span>km</span></div>
        <div><b>{wk.n}</b><span>atividades</span></div>
        <div><b>{hm(wk.sec)}</b><span>tempo</span></div>
        <div><b>{wk.gain}</b><span>m subidos</span></div>
      </div>
    </div>

    {runs.length > 0 && <div className="card">
      <div className="run-h"><span className="lv-h">Atividades</span></div>
      {runs.map(r => <button key={r.id} type="button" className="run-row" onClick={() => nav('/corrida/' + r.id)}>
        <RouteThumb run={r} />
        <div className="run-row-t"><b>{r.name}</b><small className="muted">{new Date(r.start).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} · {SPORTS[r.type]?.name}</small>
          <span className="run-row-n">{hasGps(r.type) ? <><em>{fmtKm(r.distM)} km</em><em>{fmtClock(r.movingSec * 1000)}</em><em>{r.type === 'ride' ? fmtSpeed(r.distM, r.movingSec) + ' km/h' : fmtPace(paceOf(r.movingSec, r.distM)) + ' /km'}</em></> : <><em>{fmtClock(r.movingSec * 1000)}</em><em>{r.kcal} kcal</em></>}</span></div>
        <Icon name="chevronRight" />
      </button>)}
    </div>}

    {count > 0 && <div className="run-count" aria-live="assertive"><b key={count}>{count}</b></div>}
  </div>
}

function HoldButton({ onDone, children, className }) {
  const [p, setP] = useState(0)
  const [down, setDown] = useState(false)
  useEffect(() => {
    if (!down) { setP(0); return }
    const t0 = Date.now()
    const id = setInterval(() => { const v = Math.min(1, (Date.now() - t0) / 900); setP(v); if (v >= 1) { clearInterval(id); setDown(false); onDone() } }, 30)
    return () => clearInterval(id)
  }, [down])
  return <button type="button" className={className} style={{ '--hold': p }}
    onPointerDown={() => setDown(true)} onPointerUp={() => setDown(false)} onPointerLeave={() => setDown(false)} onPointerCancel={() => setDown(false)}
    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onDone() }}>{children}</button>
}

function RunLive() {
  const nav = useNavigate()
  const { track, fix, gps } = useRun()
  const now = useNow(true, 500)
  const [view, setView] = useState('stats')
  useEffect(() => { if (track && hasGps(track.type)) watchGps() }, [])
  if (!track) return null
  const sport = SPORTS[track.type]
  const gpsOn = hasGps(track.type)
  const paused = track.status === 'paused'
  const moving = movingMsNow(track, now)
  const pace = currentPace(track, now)
  const avg = paceOf(moving / 1000, track.dist)
  const segs = []
  const cuts = [0, ...track.brk, track.pts.length]
  for (let i = 0; i + 1 < cuts.length; i++) segs.push(track.pts.slice(cuts[i], cuts[i + 1]).map(p => [p.lat, p.lng]))
  const finish = () => { const id = finishRun(); nav(id ? '/corrida/' + id : '/corrida', { replace: true, state: { fresh: true } }) }
  const ride = track.type === 'ride'
  if (!gpsOn) return <div className={'run-live nogps' + (paused ? ' paused' : '')}>
    <div className="run-live-top"><span /><b>{sport.name}</b><span /></div>
    <div className="run-live-stats">
      {paused && <div className="run-paused">Pausado</div>}
      <span className="run-sport-ic"><Icon name={sport.icon} /></span>
      <div className="run-big main"><span>Tempo</span><b>{fmtClock(elapsedMs(track, now))}</b></div>
    </div>
    <div className="run-live-bar">
      {!paused && <button type="button" className="run-pause" onClick={() => { lockOn(); pauseRun() }} aria-label="Pausar"><Icon name="pause" /></button>}
      {paused && <>
        <button type="button" className="run-resume" onClick={() => { lockOn(); resumeRun() }}><Icon name="play" />Retomar</button>
        <HoldButton className="run-finish" onDone={finish}><Icon name="flag" />Segure p/ concluir</HoldButton>
      </>}
    </div>
    {paused && <button type="button" className="run-discard" onClick={() => { if (window.confirm('Descartar esta atividade? Ela não será salva.')) { discardRun(); nav('/corrida', { replace: true }) } }}>Descartar</button>}
  </div>
  return <div className={'run-live' + (paused ? ' paused' : '') + (view === 'map' ? ' mapview' : '')}>
    <div className="run-live-top">
      <span className={'run-gps ' + gps}><i />{gps === 'ok' ? 'GPS' : gps === 'weak' ? 'Sinal fraco' : 'Sem GPS'}</span>
      <b>{sport.name}</b>
      <button type="button" className="run-toggle" onClick={() => setView(view === 'map' ? 'stats' : 'map')}>{view === 'map' ? 'Números' : 'Mapa'}</button>
    </div>
    <RunMap segments={segs} here={fix} live className="run-map-live" />
    <div className="run-live-stats">
      {paused && <div className="run-paused">Pausado</div>}
      {!paused && !track.moving && track.pts.length > 1 && <div className="run-paused soft">Pausa automática</div>}
      <div className="run-big"><span>Tempo</span><b>{fmtClock(elapsedMs(track, now))}</b></div>
      <div className="run-big main"><span>Distância (km)</span><b>{fmtKm(track.dist)}</b></div>
      <div className="run-pair">
        <div><span>{ride ? 'Velocidade' : 'Pace atual'}</span><b>{ride ? (pace ? (3600 / pace).toFixed(1).replace('.', ',') : '0,0') : fmtPace(pace)}</b><small>{ride ? 'km/h' : '/km'}</small></div>
        <div><span>{ride ? 'Média' : 'Pace médio'}</span><b>{ride ? fmtSpeed(track.dist, moving / 1000) : fmtPace(avg)}</b><small>{ride ? 'km/h' : '/km'}</small></div>
        <div><span>Em movimento</span><b>{fmtClock(moving)}</b><small>{track.gain ? Math.round(track.gain) + ' m ↑' : ' '}</small></div>
      </div>
    </div>
    <div className="run-live-bar">
      {!paused && <button type="button" className="run-pause" onClick={() => { lockOn(); pauseRun() }} aria-label="Pausar"><Icon name="pause" /></button>}
      {paused && <>
        <button type="button" className="run-resume" onClick={() => { lockOn(); resumeRun() }}><Icon name="play" />Retomar</button>
        <HoldButton className="run-finish" onDone={finish}><Icon name="flag" />Segure p/ concluir</HoldButton>
      </>}
    </div>
    {paused && <button type="button" className="run-discard" onClick={() => { if (window.confirm('Descartar esta atividade? Ela não será salva.')) { discardRun(); nav('/corrida', { replace: true }) } }}>Descartar</button>}
  </div>
}

function PaceChart({ run, pts }) {
  // pace (or speed) along the distance, smoothed over ~150 m
  const W = 320, H = 110
  const data = useMemo(() => {
    const cuts = new Set(run.brk || [])
    const out = []
    let d = 0
    for (let i = 1; i < pts.length; i++) {
      if (cuts.has(i)) continue
      const a = pts[i - 1], b = pts[i]
      const dd = Math.hypot((b.lat - a.lat) * 111195, (b.lng - a.lng) * 111195 * Math.cos((a.lat * Math.PI) / 180))
      d += dd
      out.push({ d, dd, ds: b.s - a.s, alt: b.alt })
    }
    const sm = []
    for (let i = 0; i < out.length; i++) {
      let dist = 0, sec = 0
      for (let j = i; j >= 0 && dist < 150; j--) { dist += out[j].dd; sec += out[j].ds }
      if (dist > 20 && sec > 0) sm.push({ d: out[i].d, v: dist / sec, alt: out[i].alt })
    }
    return sm
  }, [run.trk])
  if (data.length < 5) return null
  const ride = run.type === 'ride'
  const vs = data.map(x => x.v).sort((a, b) => a - b)
  const lo = vs[Math.floor(vs.length * 0.05)], hi = vs[Math.floor(vs.length * 0.95)] || lo + 1
  const maxD = data[data.length - 1].d
  const x = d => (d / maxD) * W, y = v => H - 6 - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1)) * (H - 16)
  const line = data.map((p, i) => (i ? 'L' : 'M') + x(p.d).toFixed(1) + ' ' + y(p.v).toFixed(1)).join('')
  const alts = data.filter(p => p.alt != null)
  let altPath = ''
  if (alts.length > 5) {
    const a0 = Math.min(...alts.map(p => p.alt)), a1 = Math.max(...alts.map(p => p.alt)) || a0 + 1
    const ya = a => H - ((a - a0) / (a1 - a0 || 1)) * (H * 0.45)
    altPath = 'M0 ' + H + alts.map(p => 'L' + x(p.d).toFixed(1) + ' ' + ya(p.alt).toFixed(1)).join('') + 'L' + W + ' ' + H + 'Z'
  }
  const fast = ride ? (hi * 3.6).toFixed(1).replace('.', ',') + ' km/h' : fmtPace(1000 / hi)
  const slow = ride ? (lo * 3.6).toFixed(1).replace('.', ',') + ' km/h' : fmtPace(1000 / lo)
  return <figure className="run-chart">
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={ride ? 'Velocidade ao longo do percurso' : 'Pace ao longo do percurso'}>
      {altPath && <path d={altPath} fill="var(--run-alt)" />}
      <path d={line} fill="none" stroke="var(--run-acc)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
    <figcaption><span>{fast}</span><span className="muted">{ride ? 'velocidade' : 'pace'} {altPath ? '· elevação ao fundo' : ''}</span><span>{slow}</span></figcaption>
  </figure>
}

const EFFORT_NAMES = { 400: '400 m', 1000: '1 km', 5000: '5 km', 10000: '10 km', 21097: 'Meia maratona' }

function RunDetail({ id }) {
  const nav = useNavigate()
  const run = useStore(s => (s.S.runs || []).find(r => r.id === id))
  const runs = useStore(s => s.S.runs)
  const fresh = !!useLocation().state?.fresh
  const status = useMemo(() => (run ? runStatus(runs, run) : null), [run?.id, runs?.length])
  const [editing, setEditing] = useState(false)
  const pts = useMemo(() => (run ? pointsOf(run) : []), [run?.trk])
  const segs = useMemo(() => (run ? segmentsOf(run, pts) : []), [pts])
  const best = useMemo(() => (run && run.type !== 'ride' ? bestEfforts(run, pts) : {}), [pts])
  if (!run) return <div className="narrow run"><div className="hdr"><div><h1>Atividade</h1></div>
    <button className="iconbtn" onClick={() => nav('/corrida')} aria-label="Fechar"><Icon name="xmark" /></button></div><p className="muted">Esta atividade não existe mais.</p></div>
  const ride = run.type === 'ride'
  const avg = paceOf(run.movingSec, run.distM)
  const fastest = run.splits?.length ? Math.min(...run.splits) : 0
  const slowest = run.splits?.length ? Math.max(...run.splits) : 0
  const rename = name => useStore.getState().update(s => { const r = (s.runs || []).find(x => x.id === id); if (r && name.trim()) { r.name = name.trim().slice(0, 80); r._ts = Date.now() } })
  const remove = () => { if (window.confirm('Apagar esta atividade?')) { useStore.getState().update(s => { s.runs = (s.runs || []).filter(x => x.id !== id) }); nav('/corrida', { replace: true }) } }
  const share = () => useUI.getState().openSheet(close => <ShareActivity data={runShareData(run, status)} name={'carga-' + run.type + '-' + runDay(run) + '.png'} close={close} />)
  const restKm = run.distM - (run.splits?.length || 0) * 1000
  const restSec = run.movingSec - (run.splits || []).reduce((a, b) => a + b, 0)
  return <div className="narrow run">
    <div className="hdr"><div><h1>{SPORTS[run.type]?.name}</h1><div className="sub">{dateLine(run.start)}</div></div>
      <button className="iconbtn" onClick={() => nav('/corrida')} aria-label="Fechar"><Icon name="xmark" /></button></div>

    {fresh && status && <div className="card run-status"><StatusReveal status={status} /></div>}
    <button type="button" className="sha-go run-share" onClick={share}><Icon name="share" />Compartilhar</button>

    <div className="card run-detail-head">
      {!fresh && status && <div className="run-status-chip"><StatusBadge status={status} /></div>}
      {editing
        ? <input className="run-name-in" defaultValue={run.name} autoFocus onBlur={e => { rename(e.target.value); setEditing(false) }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
        : <button type="button" className="run-name" onClick={() => setEditing(true)}>{run.name} <Icon name="pencil" /></button>}
      {!hasGps(run.type) ? <div className="run-stats">
        <div><span>Duração</span><b>{fmtClock(run.movingSec * 1000)}</b></div>
        <div><span>Calorias</span><b>{run.kcal} <small>kcal</small></b></div>
        <div><span>Início</span><b>{new Date(run.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</b></div>
      </div> : <div className="run-stats">
        <div><span>Distância</span><b>{fmtKm(run.distM)} <small>km</small></b></div>
        <div><span>{ride ? 'Velocidade média' : 'Pace médio'}</span><b>{ride ? fmtSpeed(run.distM, run.movingSec) : fmtPace(avg)} <small>{ride ? 'km/h' : '/km'}</small></b></div>
        <div><span>Tempo em movimento</span><b>{fmtClock(run.movingSec * 1000)}</b></div>
        <div><span>Ganho de elevação</span><b>{run.gainM || 0} <small>m</small></b></div>
        <div><span>Calorias</span><b>{run.kcal} <small>kcal</small></b></div>
        <div><span>Tempo total</span><b>{fmtClock(run.elapsedSec * 1000)}</b></div>
      </div>}
    </div>

    {segs.length > 0 && <div className="card run-mapcard"><RunMap segments={segs} className="run-map-detail" /></div>}

    <PaceChart run={run} pts={pts} />

    {!ride && run.splits?.length > 0 && <div className="card">
      <div className="run-h"><span className="lv-h">Parciais</span></div>
      <div className="run-splits">
        <div className="run-split head"><span>Km</span><span>Pace</span><span /></div>
        {run.splits.map((s, i) => <div key={i} className={'run-split' + (s === fastest && run.splits.length > 1 ? ' best' : '')}>
          <span>{i + 1}</span><span>{fmtPace(s)}</span>
          <span className="run-split-bar"><i style={{ width: Math.round(40 + 60 * ((slowest - s) / (slowest - fastest || 1))) + '%' }} /></span>
        </div>)}
        {restKm >= 50 && restSec > 0 && <div className="run-split rest"><span>{(restKm / 1000).toFixed(2).replace('.', ',')}</span><span>{fmtPace(paceOf(restSec, restKm))}</span><span /></div>}
      </div>
    </div>}

    {Object.keys(best).length > 0 && <div className="card">
      <div className="run-h"><span className="lv-h">Melhores esforços</span></div>
      {Object.entries(best).map(([m, sec]) => <div key={m} className="run-effort"><span>{EFFORT_NAMES[m]}</span><b>{fmtClock(sec * 1000)}</b></div>)}
    </div>}

    <button type="button" className="run-delete" onClick={remove}><Icon name="trash" /> Apagar atividade</button>
  </div>
}

export default function Run() {
  const { id } = useParams()
  const live = useRun(s => !!s.track)
  if (id) return <RunDetail id={id} />
  return live ? <RunLive /> : <RunStart />
}

/** Home: one tap to a run, the last one, or the one being recorded. */
export function RunCard() {
  const nav = useNavigate()
  const track = useRun(s => s.track)
  const type = useRun(s => s.prefs.type)
  const last = useStore(s => (s.S.runs || [])[0])
  if (track) return <button type="button" className="card run-card live" onClick={() => nav('/corrida')}>
    <span className="run-card-ic"><Icon name={SPORTS[track.type].icon} /></span>
    <span className="run-card-t"><b>{SPORTS[track.type].name} em andamento</b><small>{hasGps(track.type) ? fmtKm(track.dist) + ' km · ' : ''}{track.status === 'paused' ? 'pausada' : 'gravando'}</small></span>
    <span className="lv-chip hot">Voltar</span>
  </button>
  return <button type="button" className="card run-card" onClick={() => nav('/corrida')}>
    <span className="run-card-ic"><Icon name={SPORTS[type]?.icon || 'cargaRun'} /></span>
    <span className="run-card-t"><b>Corrida, caminhada ou pedal</b>
      <small>{last ? `Última: ${fmtKm(last.distM)} km em ${fmtClock(last.movingSec * 1000)} · ${new Date(last.start).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}` : 'Grave com o GPS: pace, parciais e mapa'}</small></span>
    <Icon name="chevronRight" />
  </button>
}

/** The tab bar's Start: what to start, instead of starting the gym workout straight away. */
const CLASS_SPORTS = ['bjj', 'muaythai', 'boxing', 'football', 'swim', 'other']
export function StartChooser({ onGym, onClose }) {
  const nav = useNavigate()
  const go = type => { onClose(); if (hasGps(type)) { setPrefs({ type }); nav('/corrida') } else { lockOn(); startRun(type); nav('/corrida') } }
  return createPortal(<div className="start-pick" role="dialog" aria-label="O que você vai fazer?" onClick={onClose}>
    <div className="start-pick-in" onClick={e => e.stopPropagation()}>
      <div className="start-pick-h"><b>O que você vai fazer?</b><button type="button" className="iconbtn" onClick={onClose} aria-label="Fechar"><Icon name="xmark" /></button></div>
      <button type="button" className="start-opt" onClick={() => { onClose(); onGym() }}>
        <span className="start-ic"><Icon name="dumbbell" /></span><span className="start-opt-t"><b>Treino na academia</b><small>Começar o treino de hoje</small></span><Icon name="chevronRight" />
      </button>
      <div className="start-sec">Com GPS</div>
      <div className="start-grid">
        {['run', 'walk', 'ride'].map(k => <button key={k} type="button" className="start-tile" onClick={() => go(k)}><Icon name={SPORTS[k].icon} />{SPORTS[k].name}</button>)}
      </div>
      <div className="start-sec">Esporte ou aula · cronômetro</div>
      <div className="start-grid">
        {CLASS_SPORTS.map(k => <button key={k} type="button" className="start-tile" onClick={() => go(k)}><Icon name={SPORTS[k].icon} />{SPORTS[k].name}</button>)}
      </div>
    </div>
  </div>, document.body)
}

/** The run in progress, for App.jsx (screen on) and the Home card. */
export const useRunLive = () => useRun(s => !!s.track)
export { runDay }
