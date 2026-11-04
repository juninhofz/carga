import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import Icon from '../components/Icon.jsx'
import { useCloud } from '../components/CloudAccount.jsx'
import { CLOUD_ON } from '../lib/cloud.js'
import { StatusBadge } from '../components/StatusReveal.jsx'
import { PersonPhoto } from '../components/ProfilePhoto.jsx'
import { NotesBell } from '../components/Notes.jsx'
import { poke } from '../lib/notifications.js'
import CargaMark from '../components/CargaMark.jsx'
import { RankCard } from '../components/RankCard.jsx'
import { TIERS, levelFor } from '../lib/carga-level.js'
import { t } from '../lib/i18n.js'
import { createPortal } from 'react-dom'
import { useUI } from '../store/useUI.js'
import { medalSVG, medalKind, medalName } from '../lib/medals.js'
import { LEVELS, runStatus, workoutStatus } from '../lib/activity-status.js'
import { sessionVolume } from '../lib/history.js'
import { EXIDX } from '../lib/exercises.js'
import { exerciseNameFor } from '../lib/i18n.js'
import {
  COVERS, coverCss, SCORING, REACTIONS, leaderboard, teamScores, progressOf, runActivity, workoutActivity, myChallenges,
  createChallenge, joinChallenge, manualActivity, DUEL_LIFTS, liftsOf, liftBoards, leaveChallenge, deleteChallenge, loadChallenge, postCheckin, deleteCheckin, setReaction,
  addComment, loadMessages, sendMessage, watchChallenge, shrinkPhoto, routeOf,
} from '../lib/challenges-group.js'

/* CARGA group challenges (approved mockup, 2026-11-04): your challenges, create one, join by code
   or link, a challenge's leaderboard, feed and chat, and posting an activity as a check-in.
   Portuguese only for now, like the Personal and the runs. */

const todayIso = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
const shortDate = iso => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
const ago = ts => {
  const s = (Date.now() - Date.parse(ts)) / 1000
  if (s < 60) return 'agora'
  if (s < 3600) return 'há ' + Math.floor(s / 60) + ' min'
  if (s < 86400) return 'há ' + Math.floor(s / 3600) + ' h'
  const d = Math.floor(s / 86400)
  return d === 1 ? 'ontem' : 'há ' + d + ' dias'
}
const initials = name => (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
// half points (a photo-only check-in) show as ½, km with one decimal
const clock = sec => { const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = Math.round(sec % 60); return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0') }
const fmtScore = (n, scoring) => scoring === 'race' ? (n ? clock(n) : '–') : (scoring === 'km' ? n.toFixed(1).replace('.', ',') : Number.isInteger(n) ? String(n) : (Math.floor(n) ? Math.floor(n) : '') + (Math.abs(n % 1 - 0.5) < 0.01 ? '½' : ',' + String(Math.round((n % 1) * 10))))
export const inviteLink = code => location.origin + location.pathname + '#/desafios/entrar/' + code

function useMyName() {
  const { user, profile } = useCloud()
  return profile?.name || user?.user_metadata?.name || (user?.email || '').split('@')[0] || ''
}

/** Someone in a challenge: their profile photo and rank when their profile is visible, else initials. */
function Avatar({ name, person, size = 30, uid }) {
  const photo = <PersonPhoto name={person?.name || name} avatar={person?.avatar} rank={person ? person.rank : null} letter={false} size={size} />
  if (!uid) return photo
  return <button type="button" className="cg-face-btn" onClick={e => { e.stopPropagation(); openPerson(uid, person, name) }} aria-label={'Perfil de ' + (person?.name || name)}>{photo}</button>
}

/* ---------- a person's profile: their card and their medals ---------- */

// A challenge counts (podium and medals) only when at least two people scored in it: alone, nobody
// wins anything, so a challenge of one cannot be used to collect medals.
export const MIN_RIVALS = 2
const disputed = rows => rows.filter(r => r.score > 0).length >= MIN_RIVALS

// every challenge I am in, with its leaderboard, read once per visit (the profiles' feed)
let boardsCache = null
async function allBoards() {
  if (boardsCache) return boardsCache
  const boards = []
  for (const c of (await myChallenges()).slice(0, 30)) {
    try { const d = await loadChallenge(c.id); if (d) boards.push({ c: d.challenge, rows: leaderboard(d.challenge, d.members, d.checkins), count: d.members.length }) } catch { /* skip */ }
  }
  boardsCache = boards
  setTimeout(() => { boardsCache = null }, 60000)
  return boards
}
/** Someone's challenges that I can see, newest first: [{ c, row, count, over, medal }]. */
export async function historyOf(uid) {
  const today = todayIso()
  const out = []
  for (const { c, rows, count } of await allBoards()) {
    const row = rows.find(x => x.user_id === uid)
    if (!row) continue
    const over = c.ends < today
    out.push({ c, row, count, over, medal: over && disputed(rows) && row.place <= 3 && row.score > 0 ? { kind: medalKind(c.scoring), place: row.place } : null })
  }
  return out.sort((x, y) => (x.c.ends < y.c.ends ? 1 : -1))
}
/** The medals someone took in the finished challenges I can see. */
export async function medalsOf(uid) {
  return (await historyOf(uid)).filter(h => h.medal).map(h => ({ ...h.medal, name: h.c.name, ends: h.c.ends }))
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V']
function PersonSheet({ uid, person, name, close }) {
  const [items, setItems] = useState(null)
  useEffect(() => { historyOf(uid).then(setItems, () => setItems([])) }, [uid])
  const shown = person?.name || name || 'Sem nome'
  const rank = person?.rank ?? 0, level = person?.level || 1
  const L = levelFor(Number(person?.carga) || 0)
  const tier = TIERS[Math.max(0, Math.min(TIERS.length - 1, rank))]
  const counts = [1, 2, 3].map(pl => (items || []).filter(h => h.medal?.place === pl).length)
  return <div className="pf">
    <div className="pf-h"><button type="button" className="iconbtn" onClick={close} aria-label="Fechar"><Icon name="xmark" /></button></div>
    {/* the Home's orange card */}
    <div className="pf-hero">
      <RankCard rank={rank} level={level} name={shown} size="sm" />
      <div className="pf-info">
        <span className="pf-chip">Rank {tier.r}</span>
        <b className="pf-tier">{t(tier.name)} {ROMAN[(level - 1) % 5]}</b>
        <div className="pf-who"><PersonPhoto name={shown} avatar={person?.avatar} rank={null} size={34} /><span><b>{shown}</b>Nível {level}</span></div>
        {person?.carga != null && <><div className="pf-bar"><i style={{ width: Math.round(Math.min(1, L.into / L.step) * 100) + '%' }} /></div>
          <span className="pf-pts">{Number(person.carga).toLocaleString('pt-BR')} pts</span></>}
      </div>
    </div>
    {/* how many 1st, 2nd and 3rd places */}
    <div className="pf-counts">{[1, 2, 3].map((pl, i) => <div key={pl}><span dangerouslySetInnerHTML={{ __html: medalSVG('carga', pl) }} /><b>{counts[i]}</b><small>{pl}º lugar</small></div>)}</div>
    {/* every challenge, newest first, with the medal and the result */}
    <div className="pf-k">Desafios</div>
    {items === null ? <p className="muted small">Carregando…</p> : !items.length ? <p className="muted small">Nenhum desafio em comum ainda.</p>
      : <div className="pf-feed">{items.map(h => <div key={h.c.id} className="pf-item">
        <span className="pf-med">{h.medal ? <span dangerouslySetInnerHTML={{ __html: medalSVG(h.medal.kind, h.medal.place) }} /> : <span className="pf-cov" style={{ background: coverCss(h.c.cover) }}><Icon name={h.c.scoring === 'km' || h.c.scoring === 'race' ? 'cargaRun' : 'trophy'} /></span>}</span>
        <span className="pf-t"><b>{h.c.name}</b><small>{h.over ? 'Encerrado' : 'Em andamento'} · {shortDate(h.c.starts)}{h.c.ends !== h.c.starts ? ' a ' + shortDate(h.c.ends) : ''}</small>
          <em>{h.row.score > 0 ? h.row.place + 'º de ' + h.count + ' · ' + fmtScore(h.row.score, h.c.scoring) + ' ' + SCORING[h.c.scoring].unit(h.row.score) : 'Ainda sem resultado'}</em></span>
      </div>)}</div>}
  </div>
}
function openPerson(uid, person, name) {
  useUI.getState().openSheet(close => <PersonSheet uid={uid} person={person} name={name} close={close} />)
}

/* ---------- the end of a challenge: the podium, then my medal ---------- */

const PODIUM_SEEN = 'carga.podium.'
const podiumSeen = id => { try { return !!localStorage.getItem(PODIUM_SEEN + id) } catch { return true } }
const markPodium = id => { try { localStorage.setItem(PODIUM_SEEN + id, '1') } catch { /* fine */ } }

function PodiumReveal({ c, rows, people, me, onClose }) {
  const top = rows.filter(r => r.score > 0).slice(0, 3)
  const mine = top.find(r => r.user_id === me)
  const [step, setStep] = useState('podium')
  useEffect(() => { if (!mine) return undefined; const t = setTimeout(() => setStep('medal'), 4200); return () => clearTimeout(t) }, [])
  const unit = SCORING[c.scoring].unit
  const champ = top[0]
  const conf = useMemo(() => Array.from({ length: 40 }, (_, i) => ({ x: Math.random() * 100, dx: Math.random() * 80 - 40, r: Math.random() * 720 - 360, d: 1.6 + Math.random() * 0.9, c: ['#ff6b00', '#ffd166', '#fff', '#ff8a3d', '#3fa9ff'][i % 5], w: 5 + Math.random() * 5 })), [])
  const nm = r => (r.user_id === me ? 'Você' : nameOf(people, r))
  return createPortal(<div className="pd" role="dialog" aria-label="Resultado do desafio" onClick={onClose}>
    {step === 'podium' ? <div className="pd-stage go" onClick={e => e.stopPropagation()}>
      {conf.map((p, i) => <i key={i} className="pd-conf" style={{ left: p.x + '%', '--dx': p.dx + 'px', '--r': p.r + 'deg', '--d': p.d + 's', background: p.c, width: p.w }} />)}
      <div className="pd-pod">
        {[top[1], top[0], top[2]].map((r, i) => r ? <div key={r.user_id} className={'pd-col p' + r.place}>
          {r.place === 1 && <span className="pd-crown"><Icon name="crown" /></span>}
          <span className="pd-face" style={{ '--d2': [1.0, 1.2, 0.9][i] + 's' }}><PersonPhoto name={nm(r)} avatar={people[r.user_id]?.avatar} rank={people[r.user_id]?.rank ?? null} letter={false} size={r.place === 1 ? 72 : 56} /></span>
          <div className="pd-stand" style={{ '--d': [0.2, 0.35, 0.1][i] + 's' }}><b>{r.place}</b><small>{nm(r).split(' ')[0]}</small></div>
        </div> : <div key={i} />)}
      </div>
      {champ && <div className="pd-cap"><span>{champ.user_id === me ? 'Você venceu o desafio' : 'Campeão do desafio'}</span><b>{nm(champ)}</b><small>{fmtScore(champ.score, c.scoring)} {unit(champ.score)} · {c.name}</small></div>}
      <button type="button" className="cg-btn pd-ok" onClick={() => (mine ? setStep('medal') : onClose())}>{mine ? 'Ver minha medalha' : 'Fechar'}</button>
    </div> : <div className="pd-stage pd-medal go" onClick={e => e.stopPropagation()}>
      <div className="pd-rays" />
      <div className="pd-m" dangerouslySetInnerHTML={{ __html: medalSVG(medalKind(c.scoring), mine.place) }} />
      <div className="pd-cap"><span>Nova medalha!</span><b>{mine.place}º lugar</b><small>{medalName(medalKind(c.scoring))} · {c.name}</small></div>
      <button type="button" className="cg-btn pd-ok" onClick={onClose}>Guardar no perfil</button>
    </div>}
  </div>, document.body)
}
/** The person's rank card, tiny, to sit beside their name. */
function MiniCard({ person, size = 'xs' }) {
  if (!person || person.rank == null) return null
  return <span className={'cg-mc ' + size}><RankCard rank={person.rank} level={person.level || 1} size={size} /></span>
}
/** A name with the rank card beside it. */
function Who({ name, person, size }) {
  return <span className="cg-who"><b>{name}</b><MiniCard person={person} size={size} /></span>
}
const nameOf = (people, m) => people?.[m.user_id]?.name || m.name || 'Sem nome'

function Header({ title, back, right }) {
  const nav = useNavigate()
  return <div className="hdr">
    {back && <button className="iconbtn" onClick={() => nav(back === true ? -1 : back)} aria-label="Voltar"><Icon name="chevronLeft" /></button>}
    <div style={{ flex: 1 }}><h1>{title}</h1></div>
    {right}
  </div>
}

/** Signed out: what the challenges need. */
function NeedAccount() {
  const nav = useNavigate()
  return <div className="card cg-need">
    <span className="cg-need-ic"><Icon name="trophy" /></span>
    <h2>Desafie os amigos</h2>
    <p className="muted">Para criar ou entrar num desafio em grupo você precisa de uma conta CARGA. Seus treinos continuam no aparelho e passam a ficar salvos na nuvem também.</p>
    {CLOUD_ON ? <button type="button" className="cg-btn" onClick={() => nav('/settings/account')}>Entrar ou criar conta</button>
      : <p className="muted small">As contas ainda não estão ligadas nesta versão.</p>}
  </div>
}

/* ---------- the list ---------- */

export function ChallengesHome() {
  const nav = useNavigate()
  const user = useCloud(s => s.user)
  const [list, setList] = useState(null)
  const [err, setErr] = useState('')
  const [joining, setJoining] = useState(false)
  const [code, setCode] = useState('')
  const myName = useMyName()
  useEffect(() => { if (user) myChallenges().then(setList, e => setErr(e.message)) }, [user?.id])
  if (!user) return <div className="narrow cg"><Header title="Desafios" /><NeedAccount /></div>
  const today = todayIso()
  const live = (list || []).filter(c => c.ends >= today)
  const over = (list || []).filter(c => c.ends < today)
  const join = async () => {
    setErr('')
    try {
      const id = await joinChallenge(code, myName)
      if (!id) { setErr('Código não encontrado. Confira e tente de novo.'); return }
      nav('/desafios/' + id)
    } catch (e) { setErr(e.message) }
  }
  return <div className="narrow cg">
    <Header title="Desafios" right={<NotesBell />} />
    <div className="cg-btns">
      <button type="button" className="cg-btn" onClick={() => nav('/desafios/novo')}><Icon name="plus" />Criar</button>
      <button type="button" className="cg-btn ghost" onClick={() => setJoining(j => !j)}><Icon name="key" />Entrar com código</button>
    </div>
    {joining && <div className="card cg-join">
      <input className="cg-in" placeholder="CRG-XXXX" value={code} autoFocus onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === 'Enter') join() }} />
      <button type="button" className="cg-btn" disabled={code.trim().length < 6} onClick={join}>Entrar</button>
    </div>}
    {err && <p className="cg-err">{err}</p>}
    {list === null && !err && <p className="muted">Carregando…</p>}
    {list && !list.length && <div className="card"><p className="muted" style={{ margin: 0 }}>Você ainda não está em nenhum desafio. Crie um e mande o código para os amigos, ou entre com o código de alguém.</p></div>}
    {live.length > 0 && <div className="cg-k">Em andamento</div>}
    {live.map(c => <ChallengeCard key={c.id} c={c} today={today} />)}
    {over.length > 0 && <div className="cg-k">Encerrados</div>}
    {over.map(c => <ChallengeCard key={c.id} c={c} today={today} />)}
  </div>
}

function ChallengeCard({ c, today }) {
  const nav = useNavigate()
  const p = progressOf(c, today)
  return <button type="button" className="cg-card" onClick={() => nav('/desafios/' + c.id)}>
    <span className="cg-cover" style={{ background: coverCss(c.cover) }}><b>{c.name}</b></span>
    <span className="cg-meta">
      <span className="cg-avs">{c.members.slice(0, 5).map(m => <Avatar key={m.user_id} name={m.name} person={c.people?.[m.user_id]} size={26} />)}<span className="small muted">{c.members.length} {c.members.length === 1 ? 'pessoa' : 'pessoas'}</span></span>
      <span className={'lv-chip ' + (p.over ? '' : 'hot')}>{p.over ? 'encerrado' : !p.started ? 'começa ' + shortDate(c.starts) : p.left === 0 ? 'último dia' : 'faltam ' + p.left + ' dias'}</span>
    </span>
  </button>
}

/* ---------- create ---------- */

export function CreateChallenge() {
  const nav = useNavigate()
  const user = useCloud(s => s.user)
  const myName = useMyName()
  const today = todayIso()
  const [f, setF] = useState({ name: '', cover: 0, starts: today, ends: addDays(today, 29), scoring: 'days', photo: true, teams: false, event: false, km: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  if (!user) return <div className="narrow cg"><Header title="Criar desafio" back="/desafios" /><NeedAccount /></div>
  const set = patch => setF(p => ({ ...p, ...patch }))
  const ok = f.name.trim() && f.ends >= f.starts && (f.scoring !== 'race' || Number(String(f.km).replace(',', '.')) > 0) && (f.scoring !== 'lifts' || (f.lifts || []).length > 0)
  const setEvent = ev => set(ev ? { event: true, ends: f.starts, scoring: 'race', photo: false } : { event: false, ends: addDays(f.starts, 29), scoring: 'days', photo: true })
  const scorings = f.event ? ['race', 'lifts', 'km', 'minutes', 'workouts'].map(k => [k, SCORING[k]]) : Object.entries(SCORING).filter(([k]) => k !== 'race')
  const go = async () => {
    setBusy(true); setErr('')
    try {
      const km = Number(String(f.km).replace(',', '.'))
      const rules = f.scoring === 'lifts' ? { lifts: (f.lifts || []).map(l => ({ id: l.id, name: l.name, pts: Math.max(1, Math.min(20, Number(l.pts) || 1)) })) } : null
      const id = await createChallenge({ ...f, ends: f.event ? f.starts : f.ends, name: f.name.trim(), memberName: myName, targetKm: f.scoring === 'race' && km > 0 ? km : null, event: f.event, rules })
      nav('/desafios/' + id, { replace: true, state: { created: true } })
    }
    catch (e) { setErr(e.message); setBusy(false) }
  }
  return <div className="narrow cg">
    <Header title="Criar desafio" back="/desafios" />
    <div className="card cg-form">
      <div className="cg-modes" role="radiogroup" style={{ marginBottom: 0 }}>
        <button type="button" role="radio" aria-checked={!f.event} className={!f.event ? 'on' : ''} onClick={() => setEvent(false)}><b>Desafio longo</b><small>Dias ou semanas de treino</small></button>
        <button type="button" role="radio" aria-checked={f.event} className={f.event ? 'on' : ''} onClick={() => setEvent(true)}><b>Evento de um dia</b><small>Uma corrida, um treino, um dia</small></button>
      </div>
      <label className="cg-f"><span>Nome</span><input className="cg-in" maxLength={60} placeholder={f.event ? 'Corrida de rua do bairro' : 'Novembro Sem Desculpa'} value={f.name} onChange={e => set({ name: e.target.value })} /></label>
      <div className="cg-f"><span>Capa</span><div className="cg-covers">{COVERS.map((_, i) => <button key={i} type="button" aria-label={'Capa ' + (i + 1)} className={f.cover === i ? 'on' : ''} style={{ background: coverCss(i) }} onClick={() => set({ cover: i })} />)}</div></div>
      {f.event ? <div className="cg-two">
        <label className="cg-f"><span>Dia do evento</span><input type="date" className="cg-in" value={f.starts} onChange={e => set({ starts: e.target.value, ends: e.target.value })} /></label>
        {f.scoring === 'race' && <label className="cg-f"><span>Distância (km)</span><input className="cg-in" inputMode="decimal" placeholder="10" value={f.km} onChange={e => set({ km: e.target.value })} /></label>}
      </div> : <div className="cg-two">
        <label className="cg-f"><span>Começa</span><input type="date" className="cg-in" value={f.starts} onChange={e => set({ starts: e.target.value })} /></label>
        <label className="cg-f"><span>Termina</span><input type="date" className="cg-in" value={f.ends} min={f.starts} onChange={e => set({ ends: e.target.value })} /></label>
      </div>}
      <div className="cg-f"><span>Como pontua</span><div className="cg-score" role="radiogroup">
        {scorings.map(([k, s]) => <button key={k} type="button" role="radio" aria-checked={f.scoring === k} className={f.scoring === k ? 'on' : ''} onClick={() => set({ scoring: k })}>
          <i className="cg-dot" /><span><b>{s.name}</b><small>{s.help}</small></span></button>)}
      </div></div>
      {f.scoring === 'lifts' && <LiftPicker value={f.lifts || []} onChange={lifts => set({ lifts })} />}
      <label className="cg-tog"><span><b>Foto obrigatória</b><small>Cada check-in precisa de uma foto</small></span><input type="checkbox" checked={f.photo} onChange={e => set({ photo: e.target.checked })} /></label>
      <label className="cg-tog"><span><b>Em equipes</b><small>Divide o grupo em dois times</small></span><input type="checkbox" checked={f.teams} onChange={e => set({ teams: e.target.checked })} /></label>
      {err && <p className="cg-err">{err}</p>}
      <button type="button" className="cg-btn" disabled={!ok || busy} onClick={go}>{busy ? 'Criando…' : 'Criar e convidar'}</button>
    </div>
  </div>
}

const exName = id => { const ex = EXIDX[id]; const n = ex ? exerciseNameFor(ex) : id; return n.charAt(0).toUpperCase() + n.slice(1) }

/** A lifting duel's exercises: the usual ones as chips, a search for the rest, the points of each. */
function LiftPicker({ value, onChange }) {
  const [q, setQ] = useState('')
  const has = id => value.some(l => l.id === id)
  const toggle = id => onChange(has(id) ? value.filter(l => l.id !== id) : [...value, { id, name: exName(id), pts: 3 }])
  const found = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (t.length < 3) return []
    return Object.keys(EXIDX).filter(id => exName(id).toLowerCase().includes(t)).slice(0, 8)
  }, [q])
  return <div className="cg-f"><span>Exercícios do duelo</span>
    <div className="cg-kinds">{DUEL_LIFTS.filter(id => EXIDX[id]).map(id => <button key={id} type="button" className={'lv-chip' + (has(id) ? ' hot' : '')} onClick={() => toggle(id)}>{exName(id)}</button>)}</div>
    <input className="cg-in" placeholder="Buscar outro exercício…" value={q} onChange={e => setQ(e.target.value)} />
    {found.length > 0 && <div className="cg-kinds">{found.map(id => <button key={id} type="button" className={'lv-chip' + (has(id) ? ' hot' : '')} onClick={() => { toggle(id); setQ('') }}>{exName(id)}</button>)}</div>}
    {value.length > 0 && <div className="cg-lifts">{value.map(l => <div key={l.id}>
      <span>{l.name}</span>
      <label>vale <input className="cg-in" type="number" inputMode="numeric" min="1" max="20" value={l.pts} onChange={e => onChange(value.map(x => (x.id === l.id ? { ...x, pts: e.target.value } : x)))} /> pts</label>
      <button type="button" className="iconbtn" aria-label={'Tirar ' + l.name} onClick={() => toggle(l.id)}><Icon name="xmark" /></button>
    </div>)}</div>}
    <small className="muted">Vale o peso mais alto de cada um nos treinos gravados pelo app durante o desafio.</small>
  </div>
}

/* ---------- join by link ---------- */

export function JoinByLink() {
  const { code } = useParams()
  const nav = useNavigate()
  const user = useCloud(s => s.user)
  const myName = useMyName()
  const [err, setErr] = useState('')
  useEffect(() => {
    if (!user) return
    joinChallenge(code, myName).then(id => (id ? nav('/desafios/' + id, { replace: true }) : setErr('Este convite não existe mais.')), e => setErr(e.message))
  }, [user?.id, code])
  return <div className="narrow cg"><Header title="Convite" back="/desafios" />
    {!user ? <NeedAccount /> : err ? <p className="cg-err">{err}</p> : <p className="muted">Entrando no desafio…</p>}
  </div>
}

/* ---------- a challenge ---------- */

export function ChallengePage() {
  const { id } = useParams()
  const nav = useNavigate()
  const loc = useLocation()
  const user = useCloud(s => s.user)
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('feed')
  const [podium, setPodium] = useState(false)
  const myPhoto = useStore(s => s.S.avatar)
  const [menu, setMenu] = useState(false)
  const reload = () => loadChallenge(id).then(d => (d ? setData(d) : setErr('Desafio não encontrado.')), e => setErr(e.message))
  useEffect(() => { if (user) reload() }, [user?.id, id])
  useEffect(() => (user ? watchChallenge(id, () => reload()) : undefined), [user?.id, id])
  if (!user) return <div className="narrow cg"><Header title="Desafio" back="/desafios" /><NeedAccount /></div>
  if (err) return <div className="narrow cg"><Header title="Desafio" back="/desafios" /><p className="cg-err">{err}</p></div>
  if (!data) return <div className="narrow cg"><Header title="Desafio" back="/desafios" /><p className="muted">Carregando…</p></div>
  const { challenge: c, members, checkins } = data
  const p = progressOf(c, todayIso())
  const rows = leaderboard(c, members, checkins)
  const mine = c.owner === data.me
  const invite = async () => {
    const text = `Entra no meu desafio "${c.name}" no CARGA! Código ${c.code}`
    const url = inviteLink(c.code)
    try { if (navigator.share) { await navigator.share({ title: c.name, text, url }); return } } catch { return }
    try { await navigator.clipboard.writeText(text + ' ' + url); alert('Convite copiado.') } catch { prompt('Copie o convite:', text + ' ' + url) }
  }
  const leave = async () => {
    if (!window.confirm(mine ? 'Apagar este desafio para todos?' : 'Sair deste desafio?')) return
    try { await (mine ? deleteChallenge(c.id) : leaveChallenge(c.id)); nav('/desafios', { replace: true }) } catch (e) { alert(e.message) }
  }
  const meRow = rows.find(r => r.user_id === data.me)
  const leader = rows[0] && rows[0].score > 0 ? rows[0] : null
  const unit = SCORING[c.scoring].unit
  // my own photo straight from this device: it shows at once, before the profile has it
  const people = { ...(data.people || {}), [data.me]: { ...((data.people || {})[data.me] || { rank: null }), ...(myPhoto ? { avatar: myPhoto } : {}) } }
  const tie = leader && meRow && leader.user_id !== data.me && meRow.place === 1
  const coverPhoto = checkins.find(x => x.photo_url)?.photo_url
  const allIn = c.event && members.length > 1 && rows.every(r => r.score > 0)
  const finished = p.over || allIn
  const counts = disputed(rows)
  const showPodium = podium || (finished && counts && !podiumSeen(c.id))
  return <div className="narrow cg">
    <div className={'cg-head' + (coverPhoto ? ' photo' : '')} style={{ '--cover': coverPhoto ? `url(${coverPhoto})` : coverCss(c.cover) }}>
      <div className="cg-top">
        <button className="iconbtn" onClick={() => nav('/desafios')} aria-label="Voltar"><Icon name="chevronLeft" /></button>
        <div className="cg-top-t"><b>{c.name}</b><small>{p.over ? 'Encerrado' : !p.started ? 'Começa ' + shortDate(c.starts) : `Dia ${p.day} de ${p.total}`} · {members.length} {members.length === 1 ? 'pessoa' : 'pessoas'}</small></div>
        <button className="iconbtn" onClick={invite} aria-label="Convidar"><Icon name="share" /></button>
        <button className="iconbtn" onClick={() => setMenu(m => !m)} aria-label="Mais"><Icon name="more" /></button>
      </div>
      {leader && <button type="button" className="cg-lead" onClick={() => setTab('ranking')} aria-label={'Em primeiro lugar: ' + (leader.user_id === data.me ? 'você' : nameOf(people, leader))}>
        <span className="cg-lead-crown"><Icon name="crown" /></span>
        <Avatar name={leader.name} person={people[leader.user_id]} size={34} />
        <span className="t"><Who name={leader.user_id === data.me ? 'Você' : nameOf(people, leader)} person={people[leader.user_id]} size="mini" />
          <em>{fmtScore(leader.score, c.scoring)} {unit(leader.score)}{tie ? ' · empatado com você' : ''}</em></span>
      </button>}
      <div className="cg-glass">
        <div><b>{meRow ? meRow.place + 'º' : '–'}</b><span>sua posição</span></div>
        <div><b>{meRow ? fmtScore(meRow.score, c.scoring) : 0}</b><span>{c.scoring === 'race' ? 'seu tempo' : c.scoring === 'days' ? 'dias ativos' : SCORING[c.scoring].name.toLowerCase()}</span></div>
        {c.event ? <div><b>{c.scoring === 'race' && c.target_km ? String(c.target_km).replace('.', ',') : p.over ? '✓' : p.left === 0 ? 'Hoje' : p.left}</b><span>{c.scoring === 'race' && c.target_km ? 'km' : p.over ? 'encerrado' : p.left === 0 ? 'é o dia' : 'dias para o evento'}</span></div>
          : <div><b>{p.over ? 0 : p.left}</b><span>{p.left === 1 ? 'dia restante' : 'dias restantes'}</span></div>}
      </div>
    </div>
    {showPodium && <PodiumReveal c={c} rows={rows} people={people} me={data.me} onClose={() => { markPodium(c.id); setPodium(false); setMenu(m => m) ; reload() }} />}
    {finished && !counts && <div className="card cg-nocontest"><b>{c.event ? 'Evento' : 'Desafio'} sem disputa</b><small>Precisa de pelo menos 2 pessoas com resultado para valer pódio e medalha.</small></div>}
    {finished && counts && <button type="button" className="cg-final" onClick={() => setPodium(true)}><Icon name="trophy" /><span><b>{c.event ? 'Evento concluído' : 'Desafio encerrado'}</b><small>Ver o pódio final</small></span><Icon name="chevronRight" /></button>}
    {menu && <div className="card cg-menu">
      <button type="button" className="plain" onClick={invite}>Convidar · código {c.code}</button>
      <button type="button" onClick={leave}>{mine ? 'Apagar desafio' : 'Sair do desafio'}</button>
    </div>}
    {loc.state?.created && <div className="card cg-created"><b>Desafio criado!</b><p className="muted small">Mande o código <b>{c.code}</b> ou o link para os amigos entrarem.</p><button type="button" className="cg-btn" onClick={invite}><Icon name="share" />Convidar</button></div>}
    <button type="button" className="cg-btn" onClick={() => nav('/desafios/postar', { state: { only: c.id } })}><Icon name="camera" />Postar uma atividade</button>
    <div className="cg-seg" role="tablist">
      {[['feed', 'Feed'], ['ranking', 'Ranking'], ['chat', 'Chat']].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
    </div>
    {tab === 'feed' && <Feed data={data} people={people} reload={reload} />}
    {tab === 'ranking' && <Ranking c={c} rows={rows} me={data.me} people={people} members={members} checkins={checkins} />}
    {tab === 'chat' && <Chat c={c} members={members} me={data.me} people={people} />}
  </div>
}

function Ranking({ c, rows, me, people, members = [], checkins = [] }) {
  const unit = SCORING[c.scoring].unit
  const boards = c.scoring === 'lifts' ? liftBoards(c, members, checkins) : null
  const top = rows.slice(0, 3)
  const order = [top[1], top[0], top[2]]
  const teams = c.teams ? teamScores(rows) : null
  return <>
    {teams && <div className="card cg-teams">
      <div className={teams[0] >= teams[1] ? 'lead' : ''}><span>Time Laranja</span><b>{fmtScore(teams[0], c.scoring)}</b></div>
      <span className="cg-vs">x</span>
      <div className={teams[1] > teams[0] ? 'lead' : ''}><span>Time Azul</span><b>{fmtScore(teams[1], c.scoring)}</b></div>
    </div>}
    {rows.length >= 3 && <div className="cg-podium">
      {order.map((r, i) => r ? <div key={r.user_id} className={'p' + r.place}>
        <Avatar name={r.name} person={people[r.user_id]} size={i === 1 ? 60 : 46} />
        <Who name={r.user_id === me ? 'Você' : nameOf(people, r).split(' ')[0]} person={people[r.user_id]} />
        <div className="stand"><b>{r.place}</b><small>{fmtScore(r.score, c.scoring)} {unit(r.score)}</small></div>
      </div> : <div key={i} />)}
    </div>}
    {boards && <div className="cg-duel">{boards.map(b => <div key={b.id} className="card">
      <div className="cg-duel-h"><b>{b.name}</b><span className="lv-chip hot">{b.pts} pts</span></div>
      {!b.rows.length ? <p className="muted small" style={{ margin: 0 }}>Ninguém registrou ainda.</p>
        : b.rows.slice(0, 3).map((x, i) => <div key={x.user_id} className={'cg-duel-r' + (i === 0 ? ' win' : '')}>
          <span className="n">{i === 0 ? <Icon name="crown" /> : i + 1}</span><Avatar name={nameOf(people, x)} person={people[x.user_id]} size={28} />
          <span>{x.user_id === me ? 'Você' : nameOf(people, x)}</span><b>{String(x.kg).replace('.', ',')} kg</b></div>)}
    </div>)}</div>}
    <div className="card cg-rows">
      {rows.map(r => <div key={r.user_id} className={'cg-row' + (r.user_id === me ? ' me' : '')}>
        <span className="n">{r.place}</span><Avatar name={r.name} person={people[r.user_id]} size={38} uid={r.user_id} />
        <span className="t"><span className="cg-who"><b>{r.user_id === me ? 'Você' : nameOf(people, r)}</b>{c.teams && r.team != null ? <i className={'cg-team t' + r.team} /> : null}<MiniCard person={people[r.user_id]} /></span><small className="muted">{r.last ? 'última ' + ago(r.last) : 'ainda não postou'}</small></span>
        <span className="pts">{fmtScore(r.score, c.scoring)}<small>{unit(r.score)}</small></span>
        {r.user_id !== me && (!r.last || r.last.slice(0, 10) < todayIso()) && <PokeBtn cid={c.id} uid={r.user_id} />}
      </div>)}
    </div>
  </>
}

/** Poke someone who has not posted today ("bora treinar hoje!"). */
function PokeBtn({ cid, uid }) {
  const [state, setState] = useState('')
  const go = async () => { setState('…'); try { setState((await poke(cid, uid)) ? 'Cutucado!' : 'Já cutucou') } catch { setState('Erro') } }
  return <button type="button" className="cg-poke" disabled={!!state} onClick={go}>{state || 'Cutucar'}</button>
}

function MiniRoute({ points }) {
  const d = useMemo(() => {
    if (!points || points.length < 2) return ''
    const k = Math.cos((points[0][0] * Math.PI) / 180)
    const xs = points.map(p => p[1] * k), ys = points.map(p => -p[0])
    const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0 || 1e-9, h = Math.max(...ys) - y0 || 1e-9
    const s = Math.min(280 / w, 160 / h)
    return points.map((p, i) => (i ? 'L' : 'M') + (20 + (xs[i] - x0) * s + (280 - w * s) / 2).toFixed(1) + ' ' + (20 + (ys[i] - y0) * s + (160 - h * s) / 2).toFixed(1)).join('')
  }, [points])
  return <svg className="cg-route" viewBox="0 0 320 200" aria-hidden="true"><path d={d} fill="none" stroke="#ff6b00" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

const KIND_NAME = { gym: 'Academia', run: 'Corrida', walk: 'Caminhada', ride: 'Pedal', sport: 'Aula' }
const REACT_ICON = { fire: 'flame', strong: 'arm', clap: 'sparkles' }

function Feed({ data, people: given, reload }) {
  const { checkins, members, reactions, comments, me } = data
  const people = given || data.people || {}
  const names = Object.fromEntries(members.map(m => [m.user_id, nameOf(people, m)]))
  const [open, setOpen] = useState({})
  const [draft, setDraft] = useState({})
  if (!checkins.length) return <div className="card"><p className="muted" style={{ margin: 0 }}>Ninguém postou ainda. Termine um treino e poste aqui!</p></div>
  const toggle = async (c, kind) => {
    const on = !reactions.some(r => r.checkin_id === c.id && r.user_id === me && r.kind === kind)
    try { await setReaction(c.id, kind, on); reload() } catch (e) { alert(e.message) }
  }
  const comment = async c => {
    const body = (draft[c.id] || '').trim()
    if (!body) return
    try { await addComment(c.id, body); setDraft(d => ({ ...d, [c.id]: '' })); reload() } catch (e) { alert(e.message) }
  }
  const remove = async c => { if (window.confirm('Apagar este check-in?')) { try { await deleteCheckin(c); reload() } catch (e) { alert(e.message) } } }
  return <div className="cg-feed">
    {checkins.map(c => {
      const st = LEVELS.find(l => l.id === c.status)
      const route = routeOf(c)
      const cs = comments.filter(x => x.checkin_id === c.id)
      const tags = [c.minutes ? (c.minutes >= 60 ? Math.floor(c.minutes / 60) + 'h ' + String(c.minutes % 60).padStart(2, '0') : c.minutes + ' min') : null,
        Number(c.km) > 0 ? String(c.km).replace('.', ',') + ' km' : null, c.stats?.pace ? 'pace ' + c.stats.pace : null,
        c.stats?.volume ? (c.stats.volume >= 1000 ? (c.stats.volume / 1000).toFixed(1).replace('.', ',') + ' t' : c.stats.volume + ' kg') : null,
        c.stats?.sets ? c.stats.sets + ' séries' : null].filter(Boolean)
      return <article key={c.id} className="cg-post">
        <div className="cg-post-top"><Avatar name={names[c.user_id]} person={people[c.user_id]} size={38} uid={c.user_id} />
          <span className="t"><Who name={c.user_id === me ? 'Você' : names[c.user_id]} person={people[c.user_id]} /><small className="muted">{ago(c.created_at)} · {c.title || KIND_NAME[c.kind]}</small></span>
          {/* the CARGA seal: this one was recorded in the app (a photo alone carries none) */}
          {c.verified !== false && <span className="cg-seal" title="Gravado no CARGA"><CargaMark height={16} />CARGA</span>}
          {c.verified !== false && st && <StatusBadge status={st} />}
          {c.user_id === me && <button type="button" className="iconbtn cg-del" onClick={() => remove(c)} aria-label="Apagar"><Icon name="trash" /></button>}
        </div>
        {(c.photo_url || route) && <div className="cg-ph">
          {c.photo_url ? <img src={c.photo_url} alt={'Foto de ' + names[c.user_id]} loading="lazy" /> : <MiniRoute points={route} />}
          {tags.length > 0 && <div className="cg-tags">{tags.map(t => <span key={t}>{t}</span>)}</div>}
        </div>}
        {!c.photo_url && !route && tags.length > 0 && <div className="cg-tags inline">{tags.map(t => <span key={t}>{t}</span>)}</div>}
        {c.caption && <p className="cg-cap">{c.caption}</p>}
        <div className="cg-react">
          {REACTIONS.map(([k, label]) => {
            const n = reactions.filter(r => r.checkin_id === c.id && r.kind === k).length
            const on = reactions.some(r => r.checkin_id === c.id && r.kind === k && r.user_id === me)
            return <button key={k} type="button" className={on ? 'on' : ''} aria-pressed={on} aria-label={label} onClick={() => toggle(c, k)}><Icon name={REACT_ICON[k]} />{n || ''}</button>
          })}
          <button type="button" className="cg-cm-btn" onClick={() => setOpen(o => ({ ...o, [c.id]: !o[c.id] }))}><Icon name="chat" />{cs.length || ''}</button>
        </div>
        {cs.slice(open[c.id] ? 0 : -2).map(x => <p key={x.id} className="cg-cm"><b>{x.user_id === me ? 'Você' : names[x.user_id]}</b> {x.body}</p>)}
        {open[c.id] && <div className="cg-cm-in"><input className="cg-in" placeholder="Comentar…" maxLength={500} value={draft[c.id] || ''} onChange={e => setDraft(d => ({ ...d, [c.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') comment(c) }} /><button type="button" className="cg-btn" onClick={() => comment(c)}>Enviar</button></div>}
      </article>
    })}
  </div>
}

function Chat({ c, members, me, people = {} }) {
  const [msgs, setMsgs] = useState(null)
  const [text, setText] = useState('')
  const end = useRef(null)
  const names = Object.fromEntries(members.map(m => [m.user_id, nameOf(people, m)]))
  const load = () => loadMessages(c.id).then(setMsgs, () => setMsgs([]))
  useEffect(() => { load(); return watchChallenge(c.id, load) }, [c.id])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs?.length])
  const send = async () => { const b = text.trim(); if (!b) return; setText(''); try { await sendMessage(c.id, b); load() } catch (e) { alert(e.message) } }
  return <div className="card cg-chat">
    {msgs === null ? <p className="muted">Carregando…</p> : !msgs.length ? <p className="muted">Comece a conversa. Vale provocar.</p> : null}
    {(msgs || []).map(m => <div key={m.id} className={'cg-msg' + (m.user_id === me ? ' me' : '')}>
      {m.user_id !== me && <Who name={names[m.user_id]} person={people[m.user_id]} />}<span>{m.body}</span><small>{ago(m.created_at)}</small>
    </div>)}
    <div ref={end} />
    <div className="cg-cm-in"><input className="cg-in" placeholder="Mensagem…" maxLength={1000} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }} /><button type="button" className="cg-btn" onClick={send}>Enviar</button></div>
  </div>
}

/* ---------- posting a check-in ---------- */

/** The activities of the last week that can be posted, newest first. */
function useRecentActivities() {
  const S = useStore(s => s.S)
  return useMemo(() => {
    const from = Date.now() - 8 * 86400000
    const out = []
    for (const r of (S.runs || []).filter(r => r.start >= from)) out.push({ at: r.start, label: r.name, act: () => runActivity(r, runStatus(S.runs, r)) })
    for (const w of (S.workouts || []).filter(w => (w.start || 0) >= from)) {
      out.push({ at: w.start, label: w.name || 'Treino', act: () => {
        const st = workoutStatus(S.workouts, w, x => sessionVolume(x, S), Array.isArray(w.prs) ? w.prs : [])
        const sets = (w.entries || []).reduce((n, e) => n + (e.sets || []).filter(s => s && s.done).length, 0)
        return workoutActivity(w, st, { volume: sessionVolume(w, S), sets, lifts: liftsOf(w, S.unit) })
      } })
    }
    return out.sort((a, b) => b.at - a.at)
  }, [S.runs, S.workouts])
}

export function PostCheckin() {
  const nav = useNavigate()
  const loc = useLocation()
  const user = useCloud(s => s.user)
  const recent = useRecentActivities()
  const [pick, setPick] = useState(0)
  const given = loc.state?.activity || null
  // 'app': an activity recorded in CARGA, counts whole; 'photo': a photo and what was done, counts half
  const [mode, setMode] = useState('app')
  const [man, setMan] = useState({ title: '', kind: 'gym', minutes: '', km: '' })
  const fromApp = useMemo(() => given || recent[pick]?.act() || null, [given, pick, recent])
  useEffect(() => { if (!given && !recent.length) setMode('photo') }, [recent.length])
  const activity = mode === 'photo' ? manualActivity(man) : fromApp
  const [list, setList] = useState(null)
  const [chosen, setChosen] = useState({})
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState(null)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const file = useRef(null)
  useEffect(() => {
    if (!user) return
    myChallenges().then(all => {
      const today = todayIso()
      const live = all.filter(c => c.ends >= today && c.starts <= today)
      setList(live)
      setChosen(Object.fromEntries(live.map(c => [c.id, loc.state?.only ? c.id === loc.state.only : true])))
    }, e => setErr(e.message))
  }, [user?.id])
  if (!user) return <div className="narrow cg"><Header title="Postar" back /><NeedAccount /></div>
  const fits = c => !((c.scoring === 'km' && !['run', 'walk', 'ride'].includes(activity?.kind)) || (c.scoring === 'race' && !['run', 'walk'].includes(activity?.kind)) || (c.scoring === 'lifts' && (activity?.kind !== 'gym' || activity?.verified === false)))
  const targets = (list || []).filter(c => chosen[c.id] && fits(c))
  // a photo-only check-in always needs its photo: it is the only proof
  const needsPhoto = (mode === 'photo' || targets.some(c => c.photo_required)) && !photo
  const onPhoto = async e => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try { const b = await shrinkPhoto(f); setPhoto(b); setPreview(URL.createObjectURL(b)) } catch (x) { setErr(x.message) }
  }
  const post = async () => {
    setBusy(true); setErr('')
    try {
      await postCheckin(targets.map(c => c.id), activity, { caption, photo })
      nav(targets.length === 1 ? '/desafios/' + targets[0].id : '/desafios', { replace: true })
    } catch (e) { setErr(e.message); setBusy(false) }
  }
  const st = activity && LEVELS.find(l => l.id === activity.status)
  return <div className="narrow cg">
    <Header title="Postar nos desafios" back />
    {!given && <div className="cg-modes" role="radiogroup">
      <button type="button" role="radio" aria-checked={mode === 'app'} className={mode === 'app' ? 'on' : ''} onClick={() => setMode('app')}><b>Atividade do CARGA</b><small>Gravada no app, com o selo CARGA</small></button>
      <button type="button" role="radio" aria-checked={mode === 'photo'} className={mode === 'photo' ? 'on' : ''} onClick={() => setMode('photo')}><b>Só a foto</b><small>Sem atividade gravada</small></button>
    </div>}
    {mode === 'photo' && <div className="card cg-form cg-man">
      <p className="muted small" style={{ margin: 0 }}>Treinou sem gravar no app? Poste a foto e conte o que fez.</p>
      <div className="cg-kinds">{[['gym', 'Academia'], ['run', 'Corrida'], ['walk', 'Caminhada'], ['ride', 'Pedal'], ['sport', 'Aula'], ['other', 'Outro']].map(([k, l]) =>
        <button key={k} type="button" className={'lv-chip' + (man.kind === k ? ' hot' : '')} onClick={() => setMan(m => ({ ...m, kind: k }))}>{l}</button>)}</div>
      <label className="cg-f"><span>O que você fez</span><input className="cg-in" maxLength={80} placeholder="Ex.: Treino de perna" value={man.title} onChange={e => setMan(m => ({ ...m, title: e.target.value }))} /></label>
      <div className="cg-two">
        <label className="cg-f"><span>Minutos</span><input className="cg-in" type="number" inputMode="numeric" min="0" max="600" placeholder="60" value={man.minutes} onChange={e => setMan(m => ({ ...m, minutes: e.target.value }))} /></label>
        {['run', 'walk', 'ride'].includes(man.kind) && <label className="cg-f"><span>Km</span><input className="cg-in" type="number" inputMode="decimal" min="0" step="0.1" placeholder="5" value={man.km} onChange={e => setMan(m => ({ ...m, km: e.target.value }))} /></label>}
      </div>
      {['run', 'walk'].includes(man.kind) && (list || []).some(c => c.scoring === 'race') && <label className="cg-f"><span>Tempo da prova</span><input className="cg-in" inputMode="numeric" placeholder="42:15 ou 1:02:30" value={man.time || ''} onChange={e => setMan(m => ({ ...m, time: e.target.value }))} /></label>}
    </div>}
    {mode === 'app' && !given && recent.length > 1 && <div className="cg-picks">{recent.slice(0, 8).map((r, i) => <button key={i} type="button" className={'lv-chip' + (i === pick ? ' hot' : '')} onClick={() => setPick(i)}>{r.label} · {new Date(r.at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</button>)}</div>}
    {!activity ? <div className="card"><p className="muted" style={{ margin: 0 }}>Nenhuma atividade gravada nos últimos dias. Termine um treino, uma corrida ou uma aula no CARGA, ou poste só a foto.</p></div> : <>
      {mode === 'app' && <div className="card cg-act"><span className="cg-act-ic"><Icon name={activity.kind === 'gym' ? 'dumbbell' : activity.kind === 'sport' ? 'stopwatch' : 'cargaRun'} /></span>
        <span className="t"><b>{activity.title}</b><small className="muted">{activity.minutes} min{Number(activity.km) > 0 ? ' · ' + String(activity.km).replace('.', ',') + ' km' : ''}{activity.stats?.sets ? ' · ' + activity.stats.sets + ' séries' : ''}</small></span>
        {st && <StatusBadge status={st} />}</div>}
      <button type="button" className={'cg-photo' + (preview ? ' has' : '')} onClick={() => file.current?.click()} style={preview ? { backgroundImage: `url(${preview})` } : undefined}>
        {!preview && <><Icon name="camera" /><span>Tirar foto ou escolher da galeria</span></>}
      </button>
      <input ref={file} type="file" accept="image/*" hidden onChange={onPhoto} />
      <label className="cg-f"><span>Legenda</span><input className="cg-in" maxLength={500} placeholder="Como foi?" value={caption} onChange={e => setCaption(e.target.value)} /></label>
      <div className="cg-f"><span>Postar em</span>
        {list === null ? <p className="muted">Carregando…</p> : !list.length ? <p className="muted">Você não está em nenhum desafio em andamento.</p>
          : <div className="cg-checks">{list.map(c => <label key={c.id} className={fits(c) ? '' : 'off'}>
            <input type="checkbox" disabled={!fits(c)} checked={!!chosen[c.id] && fits(c)} onChange={e => setChosen(x => ({ ...x, [c.id]: e.target.checked }))} />
            <span>{c.name}</span><small className="muted">{fits(c) ? SCORING[c.scoring].name : 'só corrida'}{c.photo_required ? ' · foto' : ''}</small></label>)}</div>}
      </div>
      {needsPhoto && <p className="muted small">{mode === 'photo' ? 'Escolha a foto do treino.' : 'Um dos desafios marcados pede foto.'}</p>}
      {err && <p className="cg-err">{err}</p>}
      <button type="button" className="cg-btn" disabled={busy || !targets.length || needsPhoto} onClick={post}>{busy ? 'Postando…' : 'Postar'}</button>
    </>}
  </div>
}
