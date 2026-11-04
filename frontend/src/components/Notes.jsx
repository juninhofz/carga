import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pushState, enableNotices, syncNotices } from '../lib/carga-push.js'
import { createPortal } from 'react-dom'
import Icon from './Icon.jsx'
import { useCloud } from './CloudAccount.jsx'
import { useNotes, loadNotes, markAllRead, watchNotes } from '../lib/notifications.js'

// CARGA: the notifications' bell (with the count), the list it opens, and a short banner when one
// arrives with the app open. NotesLive is mounted once in App.jsx.

const ICON = { post: 'camera', comment: 'chat', reaction: 'flame', join: 'personCircle', poke: 'bell', message: 'chat' }
const ago = ts => {
  const s = (Date.now() - Date.parse(ts)) / 1000
  if (s < 60) return 'agora'
  if (s < 3600) return 'há ' + Math.floor(s / 60) + ' min'
  if (s < 86400) return 'há ' + Math.floor(s / 3600) + ' h'
  const d = Math.floor(s / 86400)
  return d === 1 ? 'ontem' : 'há ' + d + ' dias'
}

/** Mounted once: loads and follows the notifications while signed in, and shows a banner for a new one. */
export function NotesLive() {
  const user = useCloud(s => s.user)
  const nav = useNavigate()
  const [banner, setBanner] = useState(null)
  useEffect(() => {
    if (!user) return undefined
    loadNotes()
    syncNotices()
    return watchNotes(user.id, n => { setBanner(n); setTimeout(() => setBanner(b => (b?.id === n.id ? null : b)), 4500) })
  }, [user?.id])
  if (!banner) return null
  return createPortal(<button type="button" className="note-banner" onClick={() => { setBanner(null); nav(banner.challenge_id ? '/desafios/' + banner.challenge_id : '/desafios/avisos') }}>
    <span className="note-ic"><Icon name={ICON[banner.kind] || 'bell'} /></span><span className="t"><b>{banner.title}</b>{banner.body && <small>{banner.body}</small>}</span>
  </button>, document.body)
}

/** The bell, with the count of unread ones. */
export function NotesBell() {
  const nav = useNavigate()
  const unread = useNotes(s => s.unread)
  return <button type="button" className="iconbtn note-bell" onClick={() => nav('/desafios/avisos')} aria-label={unread ? unread + ' avisos novos' : 'Avisos'}>
    <Icon name="bell" />{unread > 0 && <span className="note-n">{unread > 9 ? '9+' : unread}</span>}
  </button>
}

/** The list. Opening it marks them read. */
export function NotesPage() {
  const nav = useNavigate()
  const { list, loaded } = useNotes()
  const [push, setPush] = useState(null)
  const [pushErr, setPushErr] = useState('')
  useEffect(() => { loadNotes().then(() => setTimeout(markAllRead, 800)); pushState().then(setPush, () => setPush('unsupported')) }, [])
  const turnOn = async () => { setPushErr(''); try { await enableNotices(); setPush('on') } catch (e) { setPushErr(e.message); pushState().then(setPush, () => {}) } }
  return <div className="narrow cg">
    <div className="hdr"><button className="iconbtn" data-back="/desafios" onClick={() => nav(-1)} aria-label="Voltar"><Icon name="chevronLeft" /></button><div style={{ flex: 1 }}><h1>Avisos</h1></div></div>
    {(push === 'off' || push === 'blocked') && <button type="button" className="card note-ask" onClick={turnOn}>
      <Icon name="bell" /><span><b>Receber os avisos no celular</b><small>{push === 'blocked' ? 'Os avisos estão bloqueados neste navegador. Libere nos ajustes do site e toque aqui.' : 'Mesmo com o app fechado: quando alguém postar, comentar, reagir ou te cutucar.'}</small></span><Icon name="chevronRight" /></button>}
    {push === 'install' && <div className="card note-ask"><Icon name="bell" /><span><b>Avisos com o app fechado</b><small>No iPhone, primeiro coloque o CARGA na tela inicial: no Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início". Abra por lá e volte aqui.</small></span></div>}
    {push === 'on' && <p className="small muted note-on"><Icon name="check" /> Avisos ligados neste celular, mesmo com o app fechado.</p>}
    {pushErr && <p className="cg-err">{pushErr}</p>}
    {!loaded ? <p className="muted">Carregando…</p> : !list.length ? <div className="card"><p className="muted" style={{ margin: 0 }}>Nenhum aviso ainda. Quando alguém postar, comentar, reagir ou te cutucar nos desafios, aparece aqui.</p></div>
      : <div className="card note-list">{list.map(n => <button key={n.id} type="button" className={'note-row' + (n.read_at ? '' : ' new')} onClick={() => nav(n.challenge_id ? '/desafios/' + n.challenge_id : '/desafios')}>
        <span className="note-ic"><Icon name={ICON[n.kind] || 'bell'} /></span>
        <span className="t"><b>{n.title}</b>{n.body && <small>{n.body}</small>}<em>{ago(n.created_at)}</em></span>
      </button>)}</div>}
  </div>
}
