import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import Icon from '../components/Icon.jsx'
import { useCloud } from '../components/CloudAccount.jsx'
import { CLOUD_ON } from '../lib/cloud.js'
import { StatusBadge } from '../components/StatusReveal.jsx'
import { PersonPhoto } from '../components/ProfilePhoto.jsx'
import { LEVELS, runStatus, workoutStatus } from '../lib/activity-status.js'
import { sessionVolume } from '../lib/history.js'
import {
  COVERS, coverCss, SCORING, REACTIONS, leaderboard, teamScores, progressOf, runActivity, workoutActivity, myChallenges,
  createChallenge, joinChallenge, leaveChallenge, deleteChallenge, loadChallenge, postCheckin, deleteCheckin, setReaction,
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
const fmtScore = (n, scoring) => (scoring === 'km' ? n.toFixed(1).replace('.', ',') : String(Math.round(n)))
export const inviteLink = code => location.origin + location.pathname + '#/desafios/entrar/' + code

function useMyName() {
  const { user, profile } = useCloud()
  return profile?.name || user?.user_metadata?.name || (user?.email || '').split('@')[0] || ''
}

/** Someone in a challenge: their profile photo and rank when their profile is visible, else initials. */
function Avatar({ name, person, size = 30 }) {
  return <PersonPhoto name={person?.name || name} avatar={person?.avatar} rank={person ? person.rank : null} size={size} />
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
    <Header title="Desafios" />
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
  const [f, setF] = useState({ name: '', cover: 0, starts: today, ends: addDays(today, 29), scoring: 'days', photo: true, teams: false })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  if (!user) return <div className="narrow cg"><Header title="Criar desafio" back="/desafios" /><NeedAccount /></div>
  const set = patch => setF(p => ({ ...p, ...patch }))
  const ok = f.name.trim() && f.ends >= f.starts
  const go = async () => {
    setBusy(true); setErr('')
    try { const id = await createChallenge({ ...f, name: f.name.trim(), memberName: myName }); nav('/desafios/' + id, { replace: true, state: { created: true } }) }
    catch (e) { setErr(e.message); setBusy(false) }
  }
  return <div className="narrow cg">
    <Header title="Criar desafio" back="/desafios" />
    <div className="card cg-form">
      <label className="cg-f"><span>Nome</span><input className="cg-in" maxLength={60} placeholder="Novembro Sem Desculpa" value={f.name} onChange={e => set({ name: e.target.value })} /></label>
      <div className="cg-f"><span>Capa</span><div className="cg-covers">{COVERS.map((_, i) => <button key={i} type="button" aria-label={'Capa ' + (i + 1)} className={f.cover === i ? 'on' : ''} style={{ background: coverCss(i) }} onClick={() => set({ cover: i })} />)}</div></div>
      <div className="cg-two">
        <label className="cg-f"><span>Começa</span><input type="date" className="cg-in" value={f.starts} onChange={e => set({ starts: e.target.value })} /></label>
        <label className="cg-f"><span>Termina</span><input type="date" className="cg-in" value={f.ends} min={f.starts} onChange={e => set({ ends: e.target.value })} /></label>
      </div>
      <div className="cg-f"><span>Como pontua</span><div className="cg-score" role="radiogroup">
        {Object.entries(SCORING).map(([k, s]) => <button key={k} type="button" role="radio" aria-checked={f.scoring === k} className={f.scoring === k ? 'on' : ''} onClick={() => set({ scoring: k })}>
          <i className="cg-dot" /><span><b>{s.name}</b><small>{s.help}</small></span></button>)}
      </div></div>
      <label className="cg-tog"><span><b>Foto obrigatória</b><small>Cada check-in precisa de uma foto</small></span><input type="checkbox" checked={f.photo} onChange={e => set({ photo: e.target.checked })} /></label>
      <label className="cg-tog"><span><b>Em equipes</b><small>Divide o grupo em dois times</small></span><input type="checkbox" checked={f.teams} onChange={e => set({ teams: e.target.checked })} /></label>
      {err && <p className="cg-err">{err}</p>}
      <button type="button" className="cg-btn" disabled={!ok || busy} onClick={go}>{busy ? 'Criando…' : 'Criar e convidar'}</button>
    </div>
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
  return <div className="narrow cg">
    <div className="cg-top">
      <button className="iconbtn" onClick={() => nav('/desafios')} aria-label="Voltar"><Icon name="chevronLeft" /></button>
      <div className="cg-top-t"><b>{c.name}</b><small>{p.over ? 'Encerrado' : !p.started ? 'Começa ' + shortDate(c.starts) : `Dia ${p.day} de ${p.total}`} · {members.length} {members.length === 1 ? 'pessoa' : 'pessoas'}</small></div>
      <button className="iconbtn" onClick={invite} aria-label="Convidar"><Icon name="share" /></button>
      <button className="iconbtn" onClick={() => setMenu(m => !m)} aria-label="Mais"><Icon name="more" /></button>
    </div>
    <div className="cg-line" style={{ background: coverCss(c.cover) }}><i style={{ width: Math.round((p.day / p.total) * 100) + '%' }} /></div>
    {menu && <div className="card cg-menu">
      <button type="button" className="plain" onClick={invite}>Convidar · código {c.code}</button>
      <button type="button" onClick={leave}>{mine ? 'Apagar desafio' : 'Sair do desafio'}</button>
    </div>}
    {loc.state?.created && <div className="card cg-created"><b>Desafio criado!</b><p className="muted small">Mande o código <b>{c.code}</b> ou o link para os amigos entrarem.</p><button type="button" className="cg-btn" onClick={invite}><Icon name="share" />Convidar</button></div>}
    <div className="cg-stats">
      <div><b>{meRow ? meRow.place + 'º' : '–'}</b><span>sua posição</span></div>
      <div><b>{meRow ? fmtScore(meRow.score, c.scoring) : 0}</b><span>{c.scoring === 'days' ? 'dias ativos' : SCORING[c.scoring].name.toLowerCase()}</span></div>
      <div><b>{p.over ? 0 : p.left}</b><span>{p.left === 1 ? 'dia restante' : 'dias restantes'}</span></div>
    </div>
    {leader && <button type="button" className="cg-leader" onClick={() => setTab('ranking')} style={{ '--cv': coverCss(c.cover) }}>
      <Avatar name={leader.name} person={people[leader.user_id]} size={62} />
      <span className="t"><small>{leader.user_id === data.me ? 'Você está na liderança' : tie ? 'Empatados na liderança' : 'Na liderança'}</small><b>{leader.user_id === data.me ? 'Você' : nameOf(people, leader)}</b>
        <em>{fmtScore(leader.score, c.scoring)} {unit(leader.score)}{tie ? ' · com você' : meRow && leader.user_id !== data.me ? ' · você está a ' + fmtScore(leader.score - meRow.score, c.scoring) + ' ' + unit(leader.score - meRow.score) : ''}</em></span>
      <span className="cg-crown"><Icon name="crown" /></span>
    </button>}
    <button type="button" className="cg-btn" onClick={() => nav('/desafios/postar', { state: { only: c.id } })}><Icon name="camera" />Postar uma atividade</button>
    <div className="cg-seg" role="tablist">
      {[['feed', 'Feed'], ['ranking', 'Ranking'], ['chat', 'Chat']].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
    </div>
    {tab === 'feed' && <Feed data={data} people={people} reload={reload} />}
    {tab === 'ranking' && <Ranking c={c} rows={rows} me={data.me} people={people} />}
    {tab === 'chat' && <Chat c={c} members={members} me={data.me} people={people} />}
  </div>
}

function Ranking({ c, rows, me, people }) {
  const unit = SCORING[c.scoring].unit
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
        <span className="small">{r.user_id === me ? 'Você' : nameOf(people, r).split(' ')[0]}</span>
        <div className="stand"><b>{r.place}</b><small>{fmtScore(r.score, c.scoring)} {unit(r.score)}</small></div>
      </div> : <div key={i} />)}
    </div>}
    <div className="card cg-rows">
      {rows.map(r => <div key={r.user_id} className={'cg-row' + (r.user_id === me ? ' me' : '')}>
        <span className="n">{r.place}</span><Avatar name={r.name} person={people[r.user_id]} size={38} />
        <span className="t"><b>{r.user_id === me ? 'Você' : nameOf(people, r)}{c.teams && r.team != null ? <i className={'cg-team t' + r.team} /> : null}</b><small className="muted">{r.last ? 'última ' + ago(r.last) : 'ainda não postou'}</small></span>
        <span className="pts">{fmtScore(r.score, c.scoring)}<small>{unit(r.score)}</small></span>
      </div>)}
    </div>
  </>
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
        <div className="cg-post-top"><Avatar name={names[c.user_id]} person={people[c.user_id]} size={38} />
          <span className="t"><b>{c.user_id === me ? 'Você' : names[c.user_id]}</b><small className="muted">{ago(c.created_at)} · {c.title || KIND_NAME[c.kind]}</small></span>
          {st && <StatusBadge status={st} />}
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
      {m.user_id !== me && <b>{names[m.user_id]}</b>}<span>{m.body}</span><small>{ago(m.created_at)}</small>
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
        return workoutActivity(w, st, { volume: sessionVolume(w, S), sets })
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
  const activity = useMemo(() => given || recent[pick]?.act() || null, [given, pick, recent])
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
  const fits = c => !(c.scoring === 'km' && !['run', 'walk', 'ride'].includes(activity?.kind))
  const targets = (list || []).filter(c => chosen[c.id] && fits(c))
  const needsPhoto = targets.some(c => c.photo_required) && !photo
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
    {!given && recent.length > 1 && <div className="cg-picks">{recent.slice(0, 8).map((r, i) => <button key={i} type="button" className={'lv-chip' + (i === pick ? ' hot' : '')} onClick={() => setPick(i)}>{r.label} · {new Date(r.at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</button>)}</div>}
    {!activity ? <div className="card"><p className="muted" style={{ margin: 0 }}>Nenhuma atividade nos últimos dias. Termine um treino, uma corrida ou uma aula e poste aqui.</p></div> : <>
      <div className="card cg-act"><span className="cg-act-ic"><Icon name={activity.kind === 'gym' ? 'dumbbell' : activity.kind === 'sport' ? 'stopwatch' : 'cargaRun'} /></span>
        <span className="t"><b>{activity.title}</b><small className="muted">{activity.minutes} min{Number(activity.km) > 0 ? ' · ' + String(activity.km).replace('.', ',') + ' km' : ''}{activity.stats?.sets ? ' · ' + activity.stats.sets + ' séries' : ''}</small></span>
        {st && <StatusBadge status={st} />}</div>
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
      {needsPhoto && <p className="muted small">Um dos desafios marcados pede foto.</p>}
      {err && <p className="cg-err">{err}</p>}
      <button type="button" className="cg-btn" disabled={busy || !targets.length || needsPhoto} onClick={post}>{busy ? 'Postando…' : 'Postar'}</button>
    </>}
  </div>
}
