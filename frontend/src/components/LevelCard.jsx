import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t, tn } from '../lib/i18n.js'
import { fmtNum } from '../lib/format.js'
import Icon from './Icon.jsx'
import { RankCard, RankUp, CardView } from './RankCard.jsx'
import { PartyBanner, PARTY_MS } from './Streak.jsx'
import { levelCard, TIERS, XP_WEEKLY, XP_WORKOUT, XP_PR, XP_MONTHLY, XP_GOLD } from '../lib/carga-level.js'

/* CARGA's level (lib/carga-level.js) on Home: the rank card and how far to the next level, this
   week's two personal challenges, a party for a new level or a challenge made, and the card
   turning over (RankUp) for a new rank. */

/** A weekly challenge as a goal: "Train 3 times this week". */
export function weeklyTitle(p) {
  switch (p.id) {
    case 'workouts': return tn('Train {0} time this week', 'Train {0} times this week', p.n)
    case 'sets': return tn('Finish {0} set this week', 'Finish {0} sets this week', p.n)
    case 'legs': return t('Train legs this week')
    case 'newex': return t('Try an exercise you have never done')
    case 'cardio': return tn('{0} minute of cardio this week', '{0} minutes of cardio this week', p.n)
    case 'pr': return t('Hit a new PR this week')
    default: return t('Challenges')
  }
}

/** "Flame II" — the rank's name and its step within the rank. */
export const levelName = L => t(L.tier.name) + (L.sub ? ' ' + L.sub : '')

// What this viewer last saw, so a level-up or a challenge made is celebrated once. A remembered
// convenience on this device only: losing it costs at most one party, never any XP.
const SEEN = 'carga.level.seen'
const readSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN) || 'null') } catch { return null } }
const writeSeen = v => { try { localStorage.setItem(SEEN, JSON.stringify(v)) } catch { /* private mode */ } }

export function LevelCard({ S, now }) {
  const sandbox = useStore(s => s.tourSandbox)
  const L = useMemo(() => levelCard(S, now || new Date()), [S.workouts, S.challenges, S.weekStart]) // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState(false)
  const [party, setParty] = useState(null)
  const [rankUp, setRankUp] = useState(null)
  const [viewing, setViewing] = useState(false)
  const name = useStore(s => s.user?.name || '')
  const closeParty = useCallback(() => setParty(null), [])
  const closeRankUp = useCallback(() => setRankUp(null), [])
  const closeView = useCallback(() => setViewing(false), [])
  const xp = { into: L.into, step: L.step }
  const doneNow = L.week.filter(p => p.done).map(p => L.weekKey + '|' + p.id)

  useEffect(() => {
    if (sandbox) return
    const seen = readSeen()
    const seenRank = seen ? (seen.rank ?? Math.min(TIERS.length - 1, Math.floor(((seen.level || 1) - 1) / 5))) : null
    if (seen && L.rank > seenRank) setRankUp({ from: Math.max(0, Math.min(TIERS.length - 1, seenRank)), to: L.rank })
    else if (seen && L.level > seen.level) setParty({ kind: 'level', text: t('Level {0}! {1}', L.level, levelName(L)), icon: '⬆️' })
    else if (seen) {
      const fresh = L.week.find(p => p.done && !(seen.done || []).includes(L.weekKey + '|' + p.id))
      if (fresh) setParty({ kind: 'week', text: t('Weekly challenge done: +{0} XP', XP_WEEKLY), icon: '⚡' })
    }
    writeSeen({ level: L.level, rank: L.rank, done: doneNow })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L.level, doneNow.join(','), sandbox])

  useEffect(() => {
    if (!party) return undefined
    const tm = setTimeout(closeParty, PARTY_MS)
    return () => clearTimeout(tm)
  }, [party, closeParty])

  const pct = Math.min(1, L.into / L.step)
  const left = L.step - L.into
  return <div className={'card level-card' + (L.tier.id === 'max' ? ' max' : '')} data-level>
    <div className="lv-top">
      <button type="button" className="lv-card" onClick={() => setViewing(true)} aria-label={t('Open your rank card')}>
        <RankCard rank={L.rank} level={L.level} name={name} />
      </button>
      <div className="lv-who">
        <div className="lv-eyebrow">{t('Rank {0}', L.tier.r)} · {fmtNum(L.total)} XP</div>
        <div className="lv-title">{levelName(L)}</div>
        <div className="small muted">{t('Level {0}', L.level)}</div>
      </div>
    </div>
    <div className="pbar lv-bar" role="progressbar" aria-label={t('To the next level')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}>
      <i style={{ '--p': pct }} />
    </div>
    <div className="lv-next small muted">{t('{0} XP to level {1}', fmtNum(left), L.level + 1)}</div>

    <h3 className="lv-h">{t('This week’s challenges')}</h3>
    <div className="ch-list">
      {L.week.map(p => {
        const title = weeklyTitle(p)
        const frac = Math.min(1, p.n ? p.have / p.n : 0)
        return <div key={p.id} className={'ch-row' + (p.done ? ' done' : '')} data-weekly={p.id}>
          <span className="ch-ic" aria-hidden="true"><Icon name={p.done ? 'checkCircle' : p.icon} /></span>
          <div className="ch-body">
            <div className="ch-t"><span className="ch-name">{title}</span>
              <span className="ch-n pbar-n">{p.done ? <><Icon name="check" className="ch-ok" />+{XP_WEEKLY} XP</> : `${fmtNum(Math.min(p.have, p.n))} / ${fmtNum(p.n)}`}</span></div>
            <div className="pbar ch-bar" role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(frac * 100)}>
              <i style={{ '--p': frac }} />
            </div>
          </div>
        </div>
      })}
    </div>

    <button type="button" className="lv-how small" aria-expanded={open} onClick={() => setOpen(o => !o)}>
      {t('How to earn XP')} <Icon name={open ? 'chevronUp' : 'chevronDown'} />
    </button>
    {open && <ul className="lv-rules small">
      <li><b>+{XP_WORKOUT}</b> {t('each finished workout, plus 2 per set')}</li>
      <li><b>+{XP_PR}</b> {t('each new PR')}</li>
      <li><b>+{XP_WEEKLY}</b> {t('each weekly challenge')}</li>
      <li><b>+{XP_MONTHLY}</b> {t('each monthly challenge')}</li>
      <li><b>+{XP_GOLD}</b> {t('a gold month (all three monthly challenges)')}</li>
      <li className="muted">{t('Every five levels your card climbs a rank: {0}.', LADDER())}</li>
    </ul>}
    {rankUp && <RankUp from={rankUp.from} to={rankUp.to} level={L.level} name={name} xp={xp} stats={L.stats} onClose={closeRankUp} />}
    {viewing && !rankUp && <CardView rank={L.rank} level={L.level} name={name} xp={xp} stats={L.stats} onClose={closeView} />}
    {party && <PartyBanner text={party.text} icon={<span className="lv-party-icon">{party.icon}</span>} className={'lv-party ' + party.kind} onClose={closeParty} />}
  </div>
}

// "E Dormant → D Spark → … → ∞ Full Load"
const LADDER = () => TIERS.map(tr => tr.r + ' ' + t(tr.name)).join(' → ')
