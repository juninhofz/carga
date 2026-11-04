import ProfilePhoto from './ProfilePhoto.jsx'
import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { Section, Row, Button, TextField } from './ui.jsx'
import {
  CLOUD_ON, RANK_NUMBERS_ON, signUp, signIn, signOut, currentUser, onAuth, loadProfile, saveProfile, syncState, claimRanks, savedNumbers,
} from '../lib/cloud.js'
import { replay, levelFor } from '../lib/carga-level.js'

/* The CARGA account (lib/cloud.js): CloudSync keeps this device and the cloud level in the
   background, and the account section in Settings signs in, out and up. useCloud is what the rest
   of the app reads: who is signed in, the name on the card, the card's numbers, how sync stands. */

export const useCloud = create(() => ({ user: null, profile: null, numbers: savedNumbers(), status: 'off', lastSync: 0, error: null }))

// The app state as it goes to the cloud: a workout running right now stays on its own device.
const outgoing = () => { const S = { ...useStore.getState().S }; delete S.active; return S }
const mergeIn = remote => useStore.getState().importBackup(remote, { mergeWith: { device: true } })

let running = null
/** One sync at a time; a call while one runs waits for it and then runs once more. */
export function syncNow() {
  if (running) return running.then(() => syncNow())
  const st = useCloud.getState()
  if (!st.user) return Promise.resolve()
  useCloud.setState({ status: 'syncing', error: null })
  running = syncState({ get: outgoing, merge: mergeIn })
    .then(r => useCloud.setState(r.ok ? { status: 'ok', lastSync: Date.now() } : { status: 'error', error: 'conflict' }))
    .catch(e => useCloud.setState({ status: 'error', error: e?.message || String(e) }))
    .finally(() => { running = null })
  return running
}

const SAVE_AFTER_MS = 8000

/** Headless: follows the sign-in, syncs after a change, on return to the app, and the card's numbers. */
export function CloudSync() {
  const user = useCloud(s => s.user)
  const S = useStore(s => s.S)
  const timer = useRef(0)
  const first = useRef(true)

  useEffect(() => {
    if (!CLOUD_ON) return undefined
    currentUser().then(u => useCloud.setState({ user: u, status: u ? 'idle' : 'off' }))
    return onAuth(u => useCloud.setState(s => (s.user?.id === u?.id ? {} : { user: u, status: u ? 'idle' : 'off', profile: u ? s.profile : null })))
  }, [])

  // signed in: the profile, then a first sync
  useEffect(() => {
    if (!user) return
    first.current = true
    loadProfile().then(p => useCloud.setState({ profile: p }))
    syncNow()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // a change saves a little later; coming back to the app syncs
  useEffect(() => {
    if (!user) return undefined
    if (first.current) { first.current = false; return undefined }
    clearTimeout(timer.current)
    timer.current = setTimeout(syncNow, SAVE_AFTER_MS)
    return () => clearTimeout(timer.current)
  }, [S, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user) return undefined
    const back = () => { if (document.visibilityState === 'visible') syncNow() }
    document.addEventListener('visibilitychange', back)
    return () => document.removeEventListener('visibilitychange', back)
  }, [user?.id])

  // the card's numbers, for every rank reached; the profile keeps where the card stands now
  const R = user ? replay(S) : null
  useEffect(() => {
    if (!user || !R || !RANK_NUMBERS_ON) return
    claimRanks(R.best).then(numbers => useCloud.setState({ numbers }))
  }, [user?.id, R?.best]) // eslint-disable-line react-hooks/exhaustive-deps
  // the photo goes to the profile too: challenge mates see it on the leaderboard and the feed
  useEffect(() => {
    if (!user) return undefined
    const tm = setTimeout(() => saveProfile({ name: useCloud.getState().profile?.name, avatar: S.avatar || null }), 1500)
    return () => clearTimeout(tm)
  }, [user?.id, S.avatar]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user || !R) return
    const tm = setTimeout(() => saveProfile({ name: useCloud.getState().profile?.name, rank: Math.min(9, Math.max(0, levelRank(R.carga))), best: R.best, level: levelOf(R.carga), carga: R.carga }), 3000)
    return () => clearTimeout(tm)
  }, [user?.id, R?.carga, R?.best]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
const levelRank = c => levelFor(c).rank
const levelOf = c => levelFor(c).level

const ago = ms => {
  const s = Math.round((Date.now() - ms) / 1000)
  if (s < 60) return t('just now')
  const m = Math.round(s / 60)
  return m < 60 ? t('{0} min ago', m) : t('{0} h ago', Math.round(m / 60))
}

/** Settings → Account: create the account or sign in; signed in, the name, sync and sign out. */
export function CloudAccountSection() {
  const { user, profile, status, lastSync, error } = useCloud()
  const [mode, setMode] = useState('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [editName, setEditName] = useState(null)
  if (!CLOUD_ON) return null

  if (user) {
    const shown = profile?.name || user.user_metadata?.name || user.email
    return <Section title={t('Your CARGA account')} footer={t('Your workouts are saved in the cloud and merged across your devices. Sign in with the same e-mail on another phone or computer.')}>
      <div className="cloud-photo"><ProfilePhoto size={72} /><span><b>Sua foto</b><small>Toque nela para trocar. Ela aparece no seu cartão e para os amigos nos desafios.</small></span></div>
      {editName == null
        ? <Row icon="personCircle" iconTint="var(--accent)" title={shown} subtitle={user.email} accessory="chevron" onClick={() => setEditName(shown || '')} />
        : <div className="cloud-form">
          <label className="cloud-l" htmlFor="cloud-name">{t('Name on your card')}</label>
          <TextField id="cloud-name" value={editName} maxLength={40} onChange={e => setEditName(e.target.value)} />
          <div className="cloud-btns">
            <Button variant="primary" onClick={async () => { const p = await saveProfile({ name: editName }); if (p) useCloud.setState({ profile: { ...(profile || {}), name: p.name } }); setEditName(null) }}>{t('Save')}</Button>
            <Button onClick={() => setEditName(null)}>{t('Cancel')}</Button>
          </div>
        </div>}
      <Row icon="cloud" iconTint="var(--blue)" title={t('Sync now')}
        subtitle={status === 'syncing' ? t('Syncing…') : status === 'error' ? t('Could not sync. Check your connection.') + (error ? ' (' + error + ')' : '') : lastSync ? t('Saved {0}', ago(lastSync)) : t('Not synced yet')}
        onClick={() => syncNow()} />
      <Row icon="signOut" iconTint="var(--red)" title={t('Sign out')} danger onClick={async () => { await signOut(); useCloud.setState({ user: null, profile: null, numbers: {}, status: 'off' }) }} />
    </Section>
  }

  const submit = async e => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const r = mode === 'signup' ? await signUp(email.trim(), password, name.trim()) : await signIn(email.trim(), password)
    setBusy(false)
    if (r.error) setMsg({ bad: true, text: t(r.error) })
    else if (r.confirm) setMsg({ text: t('Almost there: open the link we sent to {0} and then sign in.', email.trim()) })
  }
  return <Section title={t('Your CARGA account')} footer={t('Optional. With an account your workouts are saved in the cloud, you can use CARGA on more than one device, and your rank card shows your name.')}>
    <form className="cloud-form" onSubmit={submit}>
      <div className="cloud-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>{t('Create account')}</button>
        <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'on' : ''} onClick={() => setMode('signin')}>{t('Sign in')}</button>
      </div>
      {mode === 'signup' && <>
        <label className="cloud-l" htmlFor="cloud-n">{t('Name on your card')}</label>
        <TextField id="cloud-n" value={name} maxLength={40} required autoComplete="nickname" onChange={e => setName(e.target.value)} />
      </>}
      <label className="cloud-l" htmlFor="cloud-e">{t('E-mail')}</label>
      <TextField id="cloud-e" type="email" value={email} required autoComplete="email" onChange={e => setEmail(e.target.value)} />
      <label className="cloud-l" htmlFor="cloud-p">{t('Password')}</label>
      <TextField id="cloud-p" type="password" value={password} required minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} onChange={e => setPassword(e.target.value)} />
      {msg && <div className={'cloud-msg' + (msg.bad ? ' bad' : '')} role="status">{msg.text}</div>}
      <Button variant="primary" type="submit" disabled={busy}>{busy ? t('Please wait…') : mode === 'signup' ? t('Create account') : t('Sign in')}</Button>
    </form>
  </Section>
}
