import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import { cloud } from '../lib/cloud.js'

// CARGA: the owner's panel. How many people have joined, how many are using the app and what goes
// on in the challenges. The numbers come from owner_stats(), which answers only the owner's account;
// anyone else who finds this page gets nothing. People who use CARGA without an account are not
// counted (nothing of theirs leaves the phone).
export const OWNER_ID = 'ee7cc1fa-5d3a-4d42-a01f-bfc7b21af6e8'

const n = v => Number(v || 0).toLocaleString('pt-BR')
const day = iso => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
function ago(ts) {
  if (!ts) return 'nunca'
  const m = Math.round((Date.now() - Date.parse(ts)) / 60000)
  if (m < 60) return m <= 1 ? 'agora' : 'há ' + m + ' min'
  const h = Math.round(m / 60)
  if (h < 24) return 'há ' + h + ' h'
  const d = Math.round(h / 24)
  return d === 1 ? 'ontem' : 'há ' + d + ' dias'
}

export default function Owner() {
  const nav = useNavigate()
  const [s, setS] = useState(null)
  const [err, setErr] = useState('')
  const load = () => { setErr(''); cloud().rpc('owner_stats').then(({ data, error }) => (error ? setErr(error.message === 'not allowed' ? 'Este painel é só do dono do CARGA.' : 'Não foi possível carregar agora.') : setS(data))) }
  useEffect(load, [])
  const max = s ? Math.max(1, ...(s.signups || []).map(x => x.n)) : 1
  return <div className="narrow owner">
    <div className="hdr"><button className="iconbtn" data-back="/settings" onClick={() => nav('/settings')} aria-label="Voltar"><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1 }}><h1>Painel do dono</h1><div className="sub">Quem está entrando e usando o CARGA</div></div>
      <button className="iconbtn" onClick={load} aria-label="Atualizar"><Icon name="repeat" /></button></div>
    {err ? <p className="cg-err">{err}</p> : !s ? <p className="muted">Carregando…</p> : <>
      <div className="own-k">Pessoas</div>
      <div className="own-tiles">
        <div className="own-t big"><b>{n(s.people.total)}</b><span>contas criadas</span></div>
        <div className="own-t"><b>{n(s.people.today)}</b><span>novas hoje</span></div>
        <div className="own-t"><b>{n(s.people.week)}</b><span>nos últimos 7 dias</span></div>
        <div className="own-t"><b>{n(s.people.month)}</b><span>nos últimos 30 dias</span></div>
      </div>
      <div className="own-k">Usando o app</div>
      <div className="own-tiles">
        <div className="own-t"><b>{n(s.active.today)}</b><span>hoje</span></div>
        <div className="own-t"><b>{n(s.active.week)}</b><span>nos últimos 7 dias</span></div>
        <div className="own-t"><b>{n(s.active.month)}</b><span>nos últimos 30 dias</span></div>
        <div className="own-t"><b>{n(s.push_on)}</b><span>com avisos ligados</span></div>
      </div>
      <div className="card own-chart">
        <div className="own-k" style={{ margin: 0 }}>Contas novas por dia · 30 dias</div>
        <div className="own-bars" role="img" aria-label="Contas novas por dia nos últimos 30 dias">
          {(s.signups || []).map(x => <i key={x.d} title={day(x.d) + ': ' + x.n} style={{ height: Math.max(3, Math.round(x.n / max * 100)) + '%' }} className={x.n ? 'on' : ''} />)}
        </div>
        <div className="own-axis"><span>{s.signups?.[0] && day(s.signups[0].d)}</span><span>maior dia: {n(max)}</span><span>hoje</span></div>
      </div>
      <div className="own-k">Desafios</div>
      <div className="own-tiles">
        <div className="own-t"><b>{n(s.challenges.running)}</b><span>em andamento (de {n(s.challenges.total)})</span></div>
        <div className="own-t"><b>{n(s.challenges.members)}</b><span>pessoas em desafios</span></div>
        <div className="own-t"><b>{n(s.challenges.posts_week)}</b><span>posts na semana ({n(s.challenges.posts_total)} no total)</span></div>
        <div className="own-t"><b>{n(s.challenges.reactions_week + s.challenges.comments_week + s.challenges.messages_week)}</b><span>reações, comentários e mensagens na semana</span></div>
      </div>
      <div className="own-k">Últimas contas</div>
      <div className="card own-list">
        {(s.recent || []).map((p, i) => <div key={i} className="own-row">
          <span className="own-av">{(p.name || '?')[0].toUpperCase()}</span>
          <span className="own-who"><b>{p.name}</b><small>entrou {ago(p.created_at)} · visto {ago(p.last_seen)}</small></span>
          <span className="own-n"><b>Nív. {p.level || 1}</b><small>{n(p.challenges)} desafios · {n(p.posts)} posts</small></span>
        </div>)}
      </div>
      <p className="muted small">Quem usa o CARGA sem criar conta não aparece aqui: os dados dessas pessoas ficam só no celular delas.</p>
    </>}
  </div>
}
