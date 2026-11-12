import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import Icon from './Icon.jsx'
import { CATALOG, CAT, EVERY, newSupplement, spreadTimes, syncSupplements, nameOf, isoOf } from '../lib/supplements.js'

/* CARGA: the person's supplements (lib/supplements.js): which, how much, how many times a day,
   at what time, every how many days, and whether CARGA reminds them. The same editor serves the
   Personal's questions (views/Personal.jsx) and its own page, /suplementos. */

/** Which supplements: the catalogue as a grid; picking one adds it with times that fit the training hour. */
export function SupplementPick({ list, onChange, timeOfDay, none, onNone }) {
  const has = kind => list.some(s => (s.kind || s.id) === kind)
  const toggle = kind => onChange(kind !== 'other' && has(kind) ? list.filter(s => (s.kind || s.id) !== kind) : [...list, newSupplement(kind, timeOfDay || 'any', isoOf(new Date()))])
  return <div className="pz-grid">
    {CATALOG.map(c => <button key={c.id} type="button" className={'pz-choice' + (has(c.id) ? ' on' : '')} onClick={() => toggle(c.id)} aria-pressed={has(c.id)}>
      <span className="pz-ic" aria-hidden="true">{c.icon}</span><span className="pz-ct"><b>{c.name}</b></span>
    </button>)}
    {onNone && <button type="button" className={'pz-choice' + (none ? ' on' : '')} onClick={onNone} aria-pressed={!!none}><span className="pz-ic" aria-hidden="true">➖</span><span className="pz-ct"><b>Não tomo</b></span></button>}
  </div>
}

const Chips = ({ options, value, onChange }) => <div className="pz-chips">
  {options.map(([x, l]) => <button key={String(x)} type="button" className={'pz-chip' + (value === x ? ' on' : '')} aria-pressed={value === x} onClick={() => onChange(x)}>{l}</button>)}
</div>

/** How each one is taken: amount, times a day and their hours, every how many days, the reminder. */
export function SupplementDetail({ list, onChange }) {
  const put = (i, patch) => onChange(list.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  return <div className="pz-sports">{list.map((s, i) => {
    const c = CAT[s.kind] || CAT.other
    const times = (s.times || []).slice(0, s.perDay || 1)
    return <div key={s.id} className="pz-sport sup">
      <div className="sup-h"><span aria-hidden="true">{c.icon}</span>
        {s.kind === 'other'
          ? <input className="pz-text" value={s.name} placeholder="Nome do suplemento" aria-label="Nome do suplemento" onChange={e => put(i, { name: e.target.value })} />
          : <b className="pz-sname">{nameOf(s)}</b>}
        <button type="button" className="iconbtn" aria-label={'Tirar ' + nameOf(s)} onClick={() => onChange(list.filter((_, j) => j !== i))}><Icon name="trash" /></button>
      </div>
      <label className="pz-num"><span>Quanto você toma?</span><input className="pz-text" value={s.amount || ''} placeholder="Ex.: 5 g, 1 scoop, 2 cápsulas" onChange={e => put(i, { amount: e.target.value })} /></label>
      <span className="pz-l">Quantas vezes por dia?</span>
      <Chips options={[[1, '1 vez'], [2, '2 vezes'], [3, '3 vezes']]} value={s.perDay || 1} onChange={n => put(i, { perDay: n, times: spreadTimes((s.times || [])[0], n) })} />
      <span className="pz-l">{times.length > 1 ? 'Em quais horários?' : 'Em qual horário?'}</span>
      <div className="sup-times">{times.map((t, k) => <input key={k} type="time" className="pz-date" value={t} aria-label={'Horário ' + (k + 1)}
        onChange={e => put(i, { times: times.map((x, j) => (j === k ? e.target.value : x)) })} />)}</div>
      <span className="pz-l">Com que frequência?</span>
      <Chips options={EVERY} value={s.every ?? 1} onChange={x => put(i, { every: x, start: isoOf(new Date()) })} />
      <button type="button" className={'sup-remind' + (s.remind !== false ? ' on' : '')} aria-pressed={s.remind !== false} onClick={() => put(i, { remind: s.remind === false })}>
        <Icon name={s.remind !== false ? 'bell' : 'bellSlash'} />{s.remind !== false ? 'O CARGA vai te lembrar' : 'Sem lembrete'}
      </button>
    </div>
  })}</div>
}

/** Saves the list into the profile and schedules its reminders again. */
export function saveSupplements(list, interactive = true) {
  useStore.getState().update(s => { s.supplements = list })
  return syncSupplements(useStore.getState().S, interactive)
}

/** The page: /suplementos. */
export default function SupplementsPage() {
  const nav = useNavigate()
  const list = useStore(s => s.S.supplements) || []
  const timeOfDay = useStore(s => s.S.methods?.find(m => m.id === s.S.activeMethod)?.answers?.timeOfDay)
  const set = l => saveSupplements(l)
  return <div className="narrow pz">
    <div className="hdr"><div><h1>Suplementos</h1><div className="sub">O CARGA lembra na hora certa</div></div>
      <button className="iconbtn" onClick={() => nav(-1)} aria-label="Fechar"><Icon name="xmark" /></button></div>
    <div className="card pz-q">
      <h2 className="pz-title">O que você toma?</h2>
      <p className="pz-help">Toque para adicionar. Os lembretes chegam no app instalado no celular.</p>
      <SupplementPick list={list} onChange={set} timeOfDay={timeOfDay} />
    </div>
    {list.length > 0 && <div className="card pz-q"><h2 className="pz-title">Como você toma</h2><SupplementDetail list={list} onChange={set} /></div>}
  </div>
}
