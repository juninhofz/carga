import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t, tn } from '../lib/i18n.js'
import { fmtNum, isoOf } from '../lib/format.js'
import Icon from './Icon.jsx'
import { RankCard, RankUp, CardView } from './RankCard.jsx'
import { useCloud } from './CloudAccount.jsx'
import { PartyBanner, PARTY_MS } from './Streak.jsx'
import {
  levelCard, TIERS, PTS, PAUSE_DAYS, DECAY, STREAK_MAX, monthAllPts, startPause, endPause,
} from '../lib/carga-level.js'

/* CARGA's level (lib/carga-level.js) on Home, as glass cards: the rank card and the Carga (with
   whatever Home passes as `after` right below it: the week's days), the streak and the totals,
   today's flash mission, then this week's missions
   (each worth a little, all of them a lot, more with the streak), today's optional mission and a
   flash one, a warning before the card drops, a pause for an injury or a holiday, and the card
   turning over (RankUp) when the rank changes, up or down. */

/** A weekly mission as a goal: "Train 3 times this week". */
export function weeklyTitle(p) {
  switch (p.id) {
    case 'workouts': return tn('Train {0} time this week', 'Train {0} times this week', p.n)
    case 'sets': return tn('Finish {0} set this week', 'Finish {0} sets this week', p.n)
    case 'volume': return t('Lift {0} kg in total this week', fmtNum(p.n))
    case 'pr': return tn('Hit {0} new PR this week', 'Hit {0} new PRs this week', p.n)
    case 'legs': return t('Train legs this week')
    case 'newex': return t('Try an exercise you have never done')
    case 'groups': return tn('Train {0} muscle group this week', 'Train {0} muscle groups this week', p.n)
    case 'cardio': return tn('{0} minute of cardio this week', '{0} minutes of cardio this week', p.n)
    case 'mobility': return t('Do a stretching or mobility exercise')
    case 'weigh': return t('Log your weight this week')
    default: return t('Challenges')
  }
}
const dailyTitle = d => ({ train: t('Train today'), mobility: t('Stretch or do mobility today'), core: t('Train your core today'), weigh: t('Log your weight today') }[d.id] || t('Train today'))
const flashTitle = f => ({
  pushups: tn('{0} push-up today', '{0} push-ups today', f.n),
  cardio: tn('{0} minute of cardio today', '{0} minutes of cardio today', f.n),
  legs: t('Train legs today'),
  pr: t('Hit a new PR today'),
}[f.id] || t('Train today'))

/** The time left until midnight, ticking: "3h 12min", "12min". */
function Countdown() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const tm = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(tm) }, [])
  const end = new Date(now); end.setHours(24, 0, 0, 0)
  const min = Math.max(0, Math.round((end - now) / 60000))
  return <>{t('ends in {0}', min >= 60 ? Math.floor(min / 60) + 'h ' + String(min % 60).padStart(2, '0') + 'min' : min + 'min')}</>
}

/** "Flame II": the rank's name and its step within the rank. */
export const levelName = L => t(L.tier.name) + (L.sub ? ' ' + L.sub : '')
const multText = m => '×' + m.toFixed(1).replace('.', ',')

// What this viewer last saw, so a new level, rank or mission made is celebrated once. A remembered
// convenience on this device only: losing it costs at most one party, never any points.
const SEEN = 'carga.level.seen'
const readSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN) || 'null') } catch { return null } }
const writeSeen = v => { try { localStorage.setItem(SEEN, JSON.stringify(v)) } catch { /* private mode */ } }

function MissionRow({ icon, title, have, n, done, pts, tag }) {
  const frac = Math.min(1, n ? have / n : 0)
  return <div className={'ch-row' + (done ? ' done' : '')}>
    <span className="ch-ic" aria-hidden="true"><Icon name={done ? 'checkCircle' : icon} /></span>
    <div className="ch-body">
      <div className="ch-t">
        <span className="ch-name">{tag && <span className="lv-tag">{tag}</span>}{title}</span>
        <span className="ch-n pbar-n">{done ? <><Icon name="check" className="ch-ok" />+{pts}</> : n > 1 ? `${fmtNum(Math.min(have, n))} / ${fmtNum(n)}` : `+${pts}`}</span>
      </div>
      {n > 1 && <div className="pbar ch-bar" role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(frac * 100)}><i style={{ '--p': frac }} /></div>}
    </div>
  </div>
}

export function LevelCard({ S, now, after = null }) {
  const sandbox = useStore(s => s.tourSandbox)
  const cloudName = useCloud(c => c.profile?.name || '')
  const numbers = useCloud(c => c.numbers)
  const name = useStore(s => s.user?.name || '') || cloudName
  const L = useMemo(() => levelCard(S, now || new Date()), [S.workouts, S.challenges, S.weekStart, S.bodyweight, S.cargaPauses]) // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState(false)
  const [party, setParty] = useState(null)
  const [rankUp, setRankUp] = useState(null)
  const [viewing, setViewing] = useState(false)
  const closeParty = useCallback(() => setParty(null), [])
  const closeRankUp = useCallback(() => setRankUp(null), [])
  const closeView = useCallback(() => setViewing(false), [])
  const xp = { into: L.into, step: L.step }
  const W = L.week
  const doneNow = (W ? W.missions.filter(p => p.done).map(p => W.key + '|' + p.id) : [])

  useEffect(() => {
    if (sandbox) return
    const seen = readSeen()
    if (seen) {
      const seenRank = Math.max(0, Math.min(TIERS.length - 1, seen.rank ?? 0))
      if (L.rank !== seenRank) setRankUp({ from: seenRank, to: L.rank, down: L.rank < seenRank })
      else if (L.level > seen.level) setParty({ kind: 'level', text: t('Level {0}! {1}', L.level, levelName(L)), icon: '⬆️' })
      else if (W && W.allDone && !(seen.all === W.key)) setParty({ kind: 'week', text: t('All missions done: +{0}', W.bonus), icon: '⚡' })
      else if (W && W.missions.some(p => p.done && !(seen.done || []).includes(W.key + '|' + p.id))) setParty({ kind: 'week', text: t('Mission done: +{0}', W.missionPts), icon: '✔️' })
    }
    writeSeen({ level: L.level, rank: L.rank, done: doneNow, all: W && W.allDone ? W.key : seen?.all })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L.level, L.rank, doneNow.join(','), sandbox])

  useEffect(() => {
    if (!party) return undefined
    const tm = setTimeout(closeParty, PARTY_MS)
    return () => clearTimeout(tm)
  }, [party, closeParty])

  const update = fn => useStore.getState().update(fn)
  const today = isoOf(now || new Date())
  const pct = Math.min(1, L.into / L.step)
  const left = L.step - L.into
  const prev = L.rank > 0 ? TIERS[L.rank - 1] : null
  return <>
    <div className={'card level-card lv-hero' + (L.tier.id === 'max' ? ' max' : '')} data-level>
      <div className="lv-top">
        <button type="button" className="lv-card" onClick={() => setViewing(true)} aria-label={t('Open your rank card')}>
          <RankCard rank={L.rank} level={L.level} name={name} xp={xp} stats={L.stats} risk={L.risk} number={numbers?.[L.rank]} />
        </button>
        <div className="lv-who">
          <span className="lv-chip hot">{t('Rank {0}', L.tier.r)}</span>
          <div className="lv-title">{levelName(L)}</div>
          <div className="small muted">{name ? name + ' · ' : ''}{t('Level {0}', L.level)}</div>
          <div className="pbar lv-bar" role="progressbar" aria-label={t('To the next level')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}>
            <i style={{ '--p': pct }} />
          </div>
          <div className="lv-next small muted">{fmtNum(L.carga)} {t('pts')} · {t('{0} to go', fmtNum(left))}</div>
          {L.best > L.rank && <span className="lv-chip">{t('Best: Rank {0}', TIERS[L.best].r)}</span>}
        </div>
      </div>
      {L.risk && prev && <div className="lv-risk small">⚠ {t('Your Carga is dropping. Train this week or your card goes back to Rank {0}.', prev.r)}</div>}
      {party && <PartyBanner text={party.text} icon={<span className="lv-party-icon">{party.icon}</span>} className={'lv-party ' + party.kind} onClose={closeParty} />}
    </div>

    {/* the week's days and today's workout sit right under the card (Home passes them in) */}
    {after}

    <div className="lv-bento">
      <div className="card lv-tile"><b>🔥 {fmtNum(L.streak)}</b><span>{t('full weeks in a row')}{W && W.mult > 1 ? ' · ' + multText(W.mult) : ''}</span></div>
      <div className="card lv-tile"><b>{fmtNum(L.stats.workouts)}</b><span>{t('workouts · {0} records', fmtNum(L.stats.prs))}</span></div>
    </div>

    {L.flash && !L.pause && <div className={'card lv-flash' + (L.flash.done ? ' done' : '')}>
      <span className="lv-flash-ic" aria-hidden="true">⚡</span>
      <div className="lv-flash-t"><b>{flashTitle(L.flash)}</b><span className="small">{t('flash')} · {L.flash.done ? t('done') : <Countdown />}{!L.flash.done && L.flash.n > 1 ? ' · ' + fmtNum(Math.min(L.flash.have, L.flash.n)) + '/' + fmtNum(L.flash.n) : ''}</span></div>
      <span className={'lv-chip' + (L.flash.done ? ' ok' : ' hot')}>+{PTS.flash}</span>
    </div>}

    <div className="card level-card lv-missions">
      {L.pause
        ? <div className="lv-pause">
          <div><b>{t('Paused')}</b> · {t('your Carga is frozen until {0}', new Date(L.pause.to + 'T12:00:00').toLocaleDateString())}</div>
          <button type="button" className="lv-how" onClick={() => update(s => { endPause(s, today) })}>{t('Back to training')}</button>
        </div>
        : W && <>
          <div className="lv-mhead"><h3 className="lv-h">{t('Missions · {0} of {1}', W.done, W.missions.length)}</h3><span className={'lv-chip' + (W.allDone ? ' ok' : ' hot')}>{W.allDone ? '✓ ' : ''}+{fmtNum(W.bonus)}{W.mult > 1 ? ' ' + multText(W.mult) : ''}</span></div>
          <div className="ch-list">
            {W.missions.map(p => <MissionRow key={p.id} icon={p.icon} title={weeklyTitle(p)} have={p.have} n={p.n} done={p.done} pts={W.missionPts} />)}
            <MissionRow icon={L.daily.icon} title={dailyTitle(L.daily)} have={L.daily.done ? 1 : 0} n={1} done={L.daily.done} pts={PTS.daily} tag={t('today · optional')} />
          </div>
          <div className={'lv-bonus small' + (W.allDone ? ' done' : '')}>
            {W.allDone ? '⚡ ' + t('All done this week: +{0} pts', W.bonus) : t('Finish all {0} for +{1} pts', W.missions.length, W.bonus)}
          </div>
        </>}
      <button type="button" className="lv-how small" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {t('How the Carga works')} <Icon name={open ? 'chevronUp' : 'chevronDown'} />
      </button>
      {open && <div className="lv-rules small">
        <ul>
          <li>{t('Each mission is worth a little; finishing all of the week’s is worth a lot.')}</li>
          <li>{t('Weeks with every mission done in a row multiply the bonus, up to {0}.', multText(STREAK_MAX))}</li>
          <li>{t('All three monthly challenges: +{0} pts.', monthAllPts(L.rank))} {t('Each workout +{0}, each new PR +{1}.', PTS.workout, PTS.pr)}</li>
          <li>{t('Every week your Carga loses {0}% of itself. Training earns more than that; stopping lets it drain, and the card can go back a rank.', Math.round(DECAY * 100))}</li>
          <li>{t('Each rank brings more missions, and harder ones.')}</li>
        </ul>
        {!L.pause && <button type="button" className="lv-pausebtn" disabled={!L.canPause}
          onClick={() => update(s => { startPause(s, today) })}>
          {t('Pause for {0} days (injury or holiday)', PAUSE_DAYS)}
        </button>}
        {!L.pause && !L.canPause && <div className="muted">{t('One pause every three months.')}</div>}
      </div>}
    </div>
    {rankUp && <RankUp from={rankUp.from} to={rankUp.to} down={rankUp.down} level={L.level} name={name} xp={xp} stats={L.stats} numbers={numbers} onClose={closeRankUp} />}
    {viewing && !rankUp && <CardView rank={L.rank} level={L.level} name={name} xp={xp} stats={L.stats} risk={L.risk} number={numbers?.[L.rank]} onClose={closeView} />}
  </>
}
