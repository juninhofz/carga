import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { registerCustom, EXIDX } from '../lib/exercises.js'
import { exerciseNameFor } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { buildPlan, toApp, DAY_NAMES, sportName } from '../lib/personal/plan.js'

/* The CARGA Personal: a full questionnaire, one question a screen, that adapts as it goes (the
   sport questions only for someone with a sport), and at the end the whole plan the engine
   (lib/personal/plan.js) made from it, with the reason for every choice. "Use this plan" saves it
   as one of the person's methods and puts it on the week; methods can be switched any time.

   CARGA is Portuguese first, and this screen is written in Portuguese only for now. */

const DOW = [1, 2, 3, 4, 5, 6, 0]
const SHORT = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' }
const DRAFT = 'carga.personal.draft'
const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT) || 'null') } catch { return null } }
const writeDraft = v => { try { localStorage.setItem(DRAFT, JSON.stringify(v)) } catch { /* private mode */ } }

const SPORTS = [['bjj', '🥋', 'Jiu-jitsu'], ['muaythai', '🥊', 'Muay Thai'], ['boxing', '🥊', 'Boxe'], ['mma', '🤼', 'MMA'], ['judo', '🥋', 'Judô'], ['wrestling', '🤼', 'Wrestling'],
  ['running', '🏃', 'Corrida'], ['football', '⚽', 'Futebol'], ['cycling', '🚴', 'Ciclismo'], ['swimming', '🏊', 'Natação'], ['crossfit', '🏋️', 'CrossFit'], ['other', '✏️', 'Outro']]

// Every question: id, block, title, help, kind and options; `when` hides it for answers it does not fit.
const Q = [
  { id: 'goal', block: 'Objetivo', title: 'Qual é o seu objetivo principal?', kind: 'one', options: [
    ['hypertrophy', '💪', 'Hipertrofia', 'Ganhar massa muscular'], ['strength', '🏋️', 'Força', 'Ficar mais forte nos básicos'], ['fatloss', '🔥', 'Emagrecer', 'Perder gordura mantendo o músculo'],
    ['conditioning', '❤️', 'Condicionamento', 'Mais fôlego e disposição'], ['health', '🌿', 'Saúde', 'Treinar para viver bem, articulações e postura'], ['sport', '🏆', 'Performance no esporte', 'Render mais na sua modalidade']] },
  { id: 'goal2', block: 'Objetivo', title: 'Quer somar um segundo objetivo?', help: 'Por exemplo, hipertrofia e força juntos.', kind: 'one', optional: 'Não, só o principal', options: [
    ['hypertrophy', '💪', 'Hipertrofia'], ['strength', '🏋️', 'Força'], ['fatloss', '🔥', 'Emagrecer'], ['conditioning', '❤️', 'Condicionamento'], ['health', '🌿', 'Saúde'], ['sport', '🏆', 'Performance no esporte']], exclude: a => a.goal },
  { id: 'priorities', block: 'Objetivo', title: 'Algum músculo que você quer destacar?', help: 'Escolha até 3. Eles ganham mais séries.', kind: 'many', max: 3, optional: 'Nenhum em especial', options: [
    ['chest', '', 'Peito'], ['back', '', 'Costas'], ['shoulders', '', 'Ombros'], ['arms', '', 'Braços'], ['core', '', 'Abdômen'], ['glutes', '', 'Glúteos'], ['legs', '', 'Pernas'], ['calves', '', 'Panturrilha']] },
  { id: 'event', block: 'Objetivo', title: 'Tem alguma data importante?', help: 'Com uma data, o plano se organiza em fases até ela.', kind: 'event' },
  { id: 'body', block: 'Você', title: 'Conta um pouco sobre você', help: 'Tudo opcional. Ajuda a calibrar o volume de treino.', kind: 'body' },
  { id: 'experience', block: 'Você', title: 'Há quanto tempo você treina musculação?', kind: 'one', options: [
    ['new', '🌱', 'Nunca treinei'], ['lt6m', '🌿', 'Menos de 6 meses'], ['6m2y', '🌳', 'De 6 meses a 2 anos'], ['2y5y', '💪', 'De 2 a 5 anos'], ['5yplus', '🏆', 'Mais de 5 anos']] },
  { id: 'consistency', block: 'Você', title: 'Nos últimos meses, como foi?', kind: 'one', options: [
    ['steady', '📈', 'Treinei direto'], ['returning', '🔄', 'Parei e estou voltando'], ['irregular', '〰️', 'Vou e volto, sem constância']] },
  { id: 'lifts', block: 'Você', title: 'Sabe suas cargas nos básicos?', help: 'A carga que você levanta 5 vezes. Se não souber, pule: o app descobre nas primeiras semanas.', kind: 'lifts' },
  { id: 'pains', block: 'Você', title: 'Tem alguma dor ou lesão?', help: 'O plano troca os exercícios que forçam essa região.', kind: 'many', optional: 'Nenhuma', options: [
    ['shoulder', '', 'Ombro'], ['elbow', '', 'Cotovelo'], ['wrist', '', 'Punho'], ['lowback', '', 'Lombar'], ['knee', '', 'Joelho'], ['hip', '', 'Quadril'], ['ankle', '', 'Tornozelo'], ['neck', '', 'Pescoço']] },
  { id: 'painLevel', block: 'Você', title: 'Essa dor…', kind: 'one', when: a => (a.pains || []).length > 0, options: [['mild', '🙂', 'Só incomoda às vezes'], ['limits', '⚠️', 'Limita alguns movimentos']] },
  { id: 'gymDays', block: 'Agenda', title: 'Em quais dias você vai à academia?', kind: 'days' },
  { id: 'sessionMin', block: 'Agenda', title: 'Quanto tempo você tem por treino?', kind: 'one', options: [[30, '', '30 min'], [45, '', '45 min'], [60, '', '1 hora'], [75, '', '1h15'], [90, '', '1h30']] },
  { id: 'timeOfDay', block: 'Agenda', title: 'Que horas você costuma treinar?', kind: 'one', options: [['morning', '🌅', 'Manhã'], ['afternoon', '☀️', 'Tarde'], ['night', '🌙', 'Noite'], ['varies', '🔀', 'Varia']] },
  { id: 'sportsPick', block: 'Esporte', title: 'Você pratica algum esporte ou luta?', help: 'Ele entra na sua agenda e nas missões, e o treino é montado em volta dele.', kind: 'sports' },
  { id: 'sportsDetail', block: 'Esporte', title: 'Conte como é cada um', kind: 'sportDetail', when: a => (a.sports || []).length > 0 },
  { id: 'sportNeeds', block: 'Esporte', title: 'O que mais faz falta no seu esporte?', kind: 'many', when: a => (a.sports || []).length > 0, optional: 'Nada em especial', options: [
    ['grip', '✊', 'Pegada'], ['gas', '🫁', 'Fôlego'], ['power', '⚡', 'Explosão'], ['strength', '🏋️', 'Força'], ['mobility', '🤸', 'Mobilidade'], ['injury', '🛡️', 'Evitar lesões']] },
  { id: 'sportRules', block: 'Esporte', title: 'Nos dias de esporte, como você quer a academia?', kind: 'rules', when: a => (a.sports || []).length > 0 },
  { id: 'equipment', block: 'Equipamento', title: 'Onde você treina?', kind: 'one', options: [
    ['full', '🏢', 'Academia completa', 'Máquinas, cabos, barras e halteres'], ['basic', '🏠', 'Academia pequena', 'Barras, halteres e alguns cabos'], ['home_db', '🏡', 'Em casa com halteres'], ['home_band', '🪢', 'Em casa com elásticos'], ['bodyweight', '🤸', 'Só o peso do corpo']] },
  { id: 'hasBar', block: 'Equipamento', title: 'Tem uma barra fixa para se pendurar?', kind: 'yesno', when: a => ['home_db', 'home_band', 'bodyweight'].includes(a.equipment) },
  { id: 'dislikes', block: 'Preferências', title: 'Algum exercício que você não curte?', help: 'Eles ficam de fora do seu plano.', kind: 'many', optional: 'Faço de tudo', options: [
    ['squat', '', 'Agachamento livre'], ['deadlift', '', 'Levantamento terra'], ['bench', '', 'Supino com barra'], ['pullup', '', 'Barra fixa'], ['dips', '', 'Paralelas'], ['lunge', '', 'Avanço e afundo'], ['burpee', '', 'Burpee'], ['running', '', 'Correr'], ['jumps', '', 'Saltos']] },
  { id: 'style', block: 'Preferências', title: 'Como você gosta de treinar?', kind: 'one', options: [
    ['classic', '📋', 'Séries tradicionais', 'Uma série, descanso, outra série'], ['techniques', '🔥', 'Com técnicas', 'Bi-set, drop-set de vez em quando'], ['circuit', '🔁', 'Em circuito', 'Exercícios em sequência, pouco descanso']] },
  { id: 'warmup', block: 'Preferências', title: 'Quer aquecimento e mobilidade no começo do treino?', kind: 'yesno' },
  { id: 'cardioPref', block: 'Preferências', title: 'E cardio?', kind: 'one', options: [['yes', '🏃', 'Gosto, pode colocar'], ['needed', '👌', 'Só se precisar'], ['no', '🙅', 'Prefiro sem']] },
  { id: 'sleep', block: 'Recuperação', title: 'Quantas horas você dorme por noite?', kind: 'one', options: [['lt6', '😴', 'Menos de 6'], ['6-7', '🛌', 'De 6 a 7'], ['7-8', '😌', 'De 7 a 8'], ['8plus', '🌙', 'Mais de 8']] },
  { id: 'job', block: 'Recuperação', title: 'Seu trabalho é…', kind: 'one', options: [['seated', '💻', 'Sentado a maior parte'], ['standing', '🚶', 'Em pé, andando'], ['heavy', '🏗️', 'Pesado, com esforço físico']] },
  { id: 'stress', block: 'Recuperação', title: 'Como anda o seu estresse?', kind: 'one', options: [['low', '😊', 'Baixo'], ['mid', '😐', 'Normal'], ['high', '😫', 'Alto']] },
  { id: 'notes', block: 'Final', title: 'Mais alguma coisa que o seu personal deveria saber?', help: 'Escreva à vontade: uma meta, um esporte que não estava na lista, uma limitação. A gente lê e usa para melhorar os planos.', kind: 'text' },
]

const DEFAULTS = { sports: [], priorities: [], pains: [], dislikes: [], sportNeeds: [], gymDays: [], sportRules: { noLegs: true }, shortOnSport: true, warmup: true }

function Choice({ on, icon, title, sub, onClick }) {
  return <button type="button" className={'pz-choice' + (on ? ' on' : '')} onClick={onClick} aria-pressed={on}>
    {icon && <span className="pz-ic" aria-hidden="true">{icon}</span>}
    <span className="pz-ct"><b>{title}</b>{sub && <small>{sub}</small>}</span>
    {on && <Icon name="checkCircle" className="pz-ok" />}
  </button>
}
const Days = ({ value = [], onChange, disabled = [] }) => <div className="pz-days">
  {DOW.map(d => <button key={d} type="button" className={'pz-day' + (value.includes(d) ? ' on' : '')} disabled={disabled.includes(d)}
    onClick={() => onChange(value.includes(d) ? value.filter(x => x !== d) : [...value, d])}>{SHORT[d]}</button>)}
</div>
const Chips = ({ options, value, onChange }) => <div className="pz-chips">
  {options.map(([v, label]) => <button key={v} type="button" className={'pz-chip' + (value === v ? ' on' : '')} onClick={() => onChange(v)}>{label}</button>)}
</div>
const NumberField = ({ label, unit, value, onChange }) => <label className="pz-num">
  <span>{label}</span>
  <span className="pz-numin"><input type="number" inputMode="decimal" min="0" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />{unit && <em>{unit}</em>}</span>
</label>

function Step({ q, a, set }) {
  const v = a[q.id]
  if (q.kind === 'one') {
    const opts = q.options.filter(([x]) => !q.exclude || x !== q.exclude(a))
    return <div className="pz-list">
      {opts.map(([x, icon, title, sub]) => <Choice key={x} on={v === x} icon={icon} title={title} sub={sub} onClick={() => set({ [q.id]: x })} />)}
      {q.optional && <Choice on={v === null} icon="➖" title={q.optional} onClick={() => set({ [q.id]: null })} />}
    </div>
  }
  if (q.kind === 'many') {
    const list = Array.isArray(v) ? v : []
    const toggle = x => set({ [q.id]: list.includes(x) ? list.filter(y => y !== x) : (q.max && list.length >= q.max ? list : [...list, x]) })
    return <div className="pz-grid">
      {q.options.map(([x, icon, title]) => <Choice key={x} on={list.includes(x)} icon={icon} title={title} onClick={() => toggle(x)} />)}
      {q.optional && <Choice on={list.length === 0 && a['_none_' + q.id]} icon="➖" title={q.optional} onClick={() => set({ [q.id]: [], ['_none_' + q.id]: true })} />}
    </div>
  }
  if (q.kind === 'yesno') return <div className="pz-list">
    <Choice on={v === true} icon="👍" title="Sim" onClick={() => set({ [q.id]: true })} />
    <Choice on={v === false} icon="👎" title="Não" onClick={() => set({ [q.id]: false })} />
  </div>
  if (q.kind === 'days') return <><Days value={a.gymDays} onChange={d => set({ gymDays: d })} /><p className="pz-help">{(a.gymDays || []).length} {(a.gymDays || []).length === 1 ? 'dia' : 'dias'} por semana</p></>
  if (q.kind === 'event') {
    const e = a.event || { kind: 'none' }
    return <><div className="pz-list">
      {[['none', '➖', 'Não, treino contínuo'], ['competition', '🏆', 'Uma competição'], ['trip', '🏖️', 'Uma viagem ou evento'], ['other', '📅', 'Outra data']].map(([x, icon, title]) =>
        <Choice key={x} on={e.kind === x} icon={icon} title={title} onClick={() => set({ event: { ...e, kind: x } })} />)}
    </div>
    {e.kind !== 'none' && <label className="pz-num"><span>Quando?</span><input type="date" className="pz-date" value={e.date || ''} onChange={ev => set({ event: { ...e, date: ev.target.value } })} /></label>}</>
  }
  if (q.kind === 'body') return <div className="pz-form">
    <div className="pz-chips">{[['f', 'Mulher'], ['m', 'Homem'], ['x', 'Prefiro não dizer']].map(([x, l]) => <button key={x} type="button" className={'pz-chip' + (a.sex === x ? ' on' : '')} onClick={() => set({ sex: x })}>{l}</button>)}</div>
    <NumberField label="Idade" unit="anos" value={a.age} onChange={x => set({ age: x })} />
    <NumberField label="Peso" unit="kg" value={a.weight} onChange={x => set({ weight: x })} />
    <NumberField label="Altura" unit="cm" value={a.height} onChange={x => set({ height: x })} />
  </div>
  if (q.kind === 'lifts') { const l = a.lifts || {}; return <div className="pz-form">
    <NumberField label="Supino" unit="kg" value={l.bench} onChange={x => set({ lifts: { ...l, bench: x } })} />
    <NumberField label="Agachamento" unit="kg" value={l.squat} onChange={x => set({ lifts: { ...l, squat: x } })} />
    <NumberField label="Levantamento terra" unit="kg" value={l.deadlift} onChange={x => set({ lifts: { ...l, deadlift: x } })} />
  </div> }
  if (q.kind === 'sports') {
    const list = a.sports || []
    const has = id => list.some(s => s.id === id)
    const toggle = id => set({ sports: has(id) ? list.filter(s => s.id !== id) : [...list, { id, days: [], minutes: 60, intensity: 'mixed', level: 'hobby' }], _none_sports: false })
    const other = list.find(s => s.id === 'other')
    return <><div className="pz-grid">
      {SPORTS.map(([id, icon, title]) => <Choice key={id} on={has(id)} icon={icon} title={title} onClick={() => toggle(id)} />)}
      <Choice on={!list.length && a._none_sports} icon="➖" title="Não pratico" onClick={() => set({ sports: [], _none_sports: true })} />
    </div>
    {other && <label className="pz-num"><span>Qual?</span><input className="pz-text" value={other.otherName || ''} placeholder="Ex.: karatê, vôlei, dança" onChange={e => set({ sports: list.map(s => s.id === 'other' ? { ...s, otherName: e.target.value } : s) })} /></label>}</>
  }
  if (q.kind === 'sportDetail') {
    const list = a.sports || []
    const put = (i, patch) => set({ sports: list.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
    return <div className="pz-sports">{list.map((s, i) => <div key={s.id} className="pz-sport">
      <b className="pz-sname">{sportName(s)}</b>
      <span className="pz-l">Em quais dias?</span>
      <Days value={s.days} onChange={d => put(i, { days: d })} />
      <span className="pz-l">Quanto tempo dura?</span>
      <Chips options={[[45, '45 min'], [60, '1h'], [90, '1h30'], [120, '2h']]} value={s.minutes} onChange={x => put(i, { minutes: x })} />
      <span className="pz-l">Como costuma ser?</span>
      <Chips options={[['light', 'Leve, técnica'], ['mixed', 'Misto'], ['hard', 'Forte'], ['competition', 'Fase de competição']]} value={s.intensity} onChange={x => put(i, { intensity: x })} />
      <span className="pz-l">Você…</span>
      <Chips options={[['hobby', 'Pratica por hobby'], ['compete', 'Compete']]} value={s.level} onChange={x => put(i, { level: x })} />
      <span className="pz-l">Nos dias em que tem os dois, a academia é…</span>
      <Chips options={[['before', 'Antes'], ['after', 'Depois'], ['apart', 'Em outro horário']]} value={s.when} onChange={x => put(i, { when: x })} />
    </div>)}</div>
  }
  if (q.kind === 'rules') {
    const r = a.sportRules || {}
    return <div className="pz-list">
      <Choice on={!!r.noLegs} icon="🦵" title="Sem treino de perna" sub="Perna só nos dias sem esporte" onClick={() => set({ sportRules: { ...r, noLegs: !r.noLegs } })} />
      <Choice on={!!a.shortOnSport} icon="⏱️" title="Treino mais curto" sub="E sem chegar na falha, para render no esporte" onClick={() => set({ shortOnSport: !a.shortOnSport })} />
      {a.shortOnSport && <Chips options={[[30, '30 min'], [45, '45 min'], [60, '1 hora']]} value={a.sportDayMin || 45} onChange={x => set({ sportDayMin: x })} />}
    </div>
  }
  if (q.kind === 'text') return <textarea className="pz-area" rows={6} value={v || ''} placeholder="Opcional" onChange={e => set({ notes: e.target.value })} />
  return null
}

function answered(q, a) {
  const v = a[q.id]
  if (q.kind === 'one') return v !== undefined
  if (q.kind === 'many') return (Array.isArray(v) && v.length > 0) || !!a['_none_' + q.id]
  if (q.kind === 'yesno') return typeof v === 'boolean'
  if (q.kind === 'days') return (a.gymDays || []).length > 0
  if (q.kind === 'sports') return (a.sports || []).length > 0 || !!a._none_sports
  if (q.kind === 'sportDetail') return (a.sports || []).every(s => (s.days || []).length > 0)
  return true
}

function PlanView({ plan, a, onUse, onRedo }) {
  const [open, setOpen] = useState(null)
  return <div className="pz-plan">
    <div className="card pz-hero">
      <span className="lv-chip hot">Seu plano</span>
      <h2>{plan.title}</h2>
      <p className="muted">{plan.sessions.length} treinos por semana{plan.sports.length ? ' + ' + plan.sports.length + ' de esporte' : ''}</p>
    </div>
    <div className="card">
      <h3 className="lv-h">A sua semana</h3>
      {DOW.map(d => {
        const s = plan.sessions.find(x => x.day === d), sp = plan.sports.filter(x => x.day === d)
        if (!s && !sp.length) return <div key={d} className="pz-wrow rest"><b>{SHORT[d]}</b><span className="muted">Descanso</span></div>
        return <div key={d} className="pz-wday">
          {s && <button type="button" className="pz-wrow" onClick={() => setOpen(open === d ? null : d)} aria-expanded={open === d}>
            <b>{SHORT[d]}</b><span>{s.name}<small className="muted"> · {s.minutes} min · {s.exercises.filter(e => e.role !== 'warmup').length} exercícios</small></span>
            <Icon name={open === d ? 'chevronUp' : 'chevronDown'} />
          </button>}
          {sp.map(x => <div key={x.sport} className="pz-wrow sport"><b>{s ? '' : SHORT[d]}</b><span>🥋 {x.name} · {x.minutes} min</span></div>)}
          {open === d && s && <ol className="pz-ex">{s.exercises.map(e => <li key={e.id}>
            <span>{exerciseNameFor(EXIDX[e.id]) || e.id}</span>
            <em>{e.mode === 'time' ? e.sets + ' × ' + e.sec + ' s' : e.mode === 'cardio' ? e.min + ' min' : e.sets + ' × ' + e.repsMin + '–' + e.reps}{e.rest ? ' · ' + e.rest + ' s' : ''}</em>
          </li>)}</ol>}
        </div>
      })}
    </div>
    <div className="card">
      <h3 className="lv-h">Por que assim</h3>
      <ul className="pz-why">{plan.why.map((w, i) => <li key={i}>{w}</li>)}</ul>
    </div>
    <div className="card">
      <h3 className="lv-h">Como evoluir</h3>
      <ul className="pz-why">{plan.progression.map((w, i) => <li key={i}>{w}</li>)}</ul>
    </div>
    <button type="button" className="pz-next" onClick={onUse}>Usar este plano</button>
    <button type="button" className="pz-back" onClick={onRedo}>Mudar respostas</button>
  </div>
}

/** Saves the plan as a method and puts it on the week (routines added, the week replaced). */
export function applyMethod(plan, a) {
  const app = toApp(plan, a)
  const id = 'm' + Date.now().toString(36)
  useStore.getState().update(s => {
    s.customEx = s.customEx || []
    for (const c of app.customEx) if (!s.customEx.some(x => x.id === c.id)) s.customEx.push(c)
    s.routines.push(...app.routines)
    s.week = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], ...app.week }
    s.methods = [...(Array.isArray(s.methods) ? s.methods : []), { id, name: plan.title, at: Date.now(), answers: a, routineIds: app.routines.map(r => r.id), week: app.week }]
    s.activeMethod = id
  })
  registerCustom(useStore.getState().S.customEx)
  return id
}

export default function Personal() {
  const nav = useNavigate()
  const methods = useStore(s => s.S.methods) || []
  const active = useStore(s => s.S.activeMethod)
  const [a, setA] = useState(() => ({ ...DEFAULTS, ...(readDraft() || {}) }))
  const [i, setI] = useState(-1)
  const [done, setDone] = useState(false)
  const set = patch => setA(prev => { const next = { ...prev, ...patch }; writeDraft(next); return next })
  const steps = Q.filter(q => !q.when || q.when(a))
  const q = steps[i]
  const plan = useMemo(() => (done ? buildPlan(a) : null), [done, a])
  const blocks = [...new Set(Q.map(x => x.block))]

  const use = () => { applyMethod(plan, a); try { localStorage.removeItem(DRAFT) } catch { /* fine */ } nav('/plan') }
  const switchTo = m => useStore.getState().update(s => { s.week = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], ...m.week }; s.activeMethod = m.id })
  const remove = m => useStore.getState().update(s => { s.methods = (s.methods || []).filter(x => x.id !== m.id); if (s.activeMethod === m.id) s.activeMethod = null })

  return <div className="narrow pz">
    <div className="hdr"><div><h1>Personal CARGA</h1><div className="sub">Seu plano, montado para você</div></div>
      <button className="iconbtn" onClick={() => nav(-1)} aria-label="Fechar"><Icon name="xmark" /></button></div>

    {i === -1 && !done && <>
      <div className="card pz-hero">
        <span className="pz-big" aria-hidden="true">🧠</span>
        <h2>Vamos montar o seu treino</h2>
        <p className="muted">São {steps.length} perguntas sobre o seu objetivo, sua rotina, seu esporte e seu corpo. Quanto mais você contar, mais o plano fica com a sua cara. Leva uns 5 minutos.</p>
        <button type="button" className="pz-next" onClick={() => setI(0)}>{readDraft() ? 'Continuar de onde parei' : 'Começar'}</button>
      </div>
      {methods.length > 0 && <div className="card">
        <h3 className="lv-h">Seus métodos</h3>
        <p className="muted small">Troque de método quando quiser: a semana passa a seguir o escolhido.</p>
        {methods.map(m => <div key={m.id} className="pz-method">
          <div><b>{m.name}</b><small className="muted">{Object.keys(m.week || {}).length} dias · criado em {new Date(m.at).toLocaleDateString()}</small></div>
          {m.id === active ? <span className="lv-chip ok">Em uso</span> : <button type="button" className="lv-chip hot" onClick={() => switchTo(m)}>Usar</button>}
          <button type="button" className="iconbtn" aria-label={'Apagar ' + m.name} onClick={() => remove(m)}><Icon name="trash" /></button>
        </div>)}
      </div>}
    </>}

    {q && !done && <div className="card pz-q">
      <div className="pz-prog"><i style={{ width: Math.round((i / steps.length) * 100) + '%' }} /></div>
      <div className="pz-meta"><span className="lv-chip hot">{q.block}</span><span className="muted small">{i + 1} de {steps.length} · bloco {blocks.indexOf(q.block) + 1} de {blocks.length}</span></div>
      <h2 className="pz-title">{q.title}</h2>
      {q.help && <p className="pz-help">{q.help}</p>}
      <Step q={q} a={a} set={set} />
      <div className="pz-nav">
        <button type="button" className="pz-back" onClick={() => setI(i - 1)}>Voltar</button>
        <button type="button" className="pz-next" disabled={!answered(q, a)} onClick={() => (i + 1 < steps.length ? setI(i + 1) : setDone(true))}>{i + 1 < steps.length ? 'Próxima' : 'Ver meu plano'}</button>
      </div>
    </div>}

    {done && plan && <PlanView plan={plan} a={a} onUse={use} onRedo={() => { setDone(false); setI(0) }} />}
  </div>
}
