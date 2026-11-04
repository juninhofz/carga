import { useStore } from '../store/useStore.js'
import { TIERS } from '../lib/carga-level.js'
import Icon from './Icon.jsx'

// CARGA: the person's photo. Their own (S.avatar, a small square JPEG) is set by a tap on it, on
// the Home card or in Account, and travels to the cloud profile so challenge mates see it. Anyone
// else's comes from their profile, with their rank's letter on its corner in the rank's colour.

/** A picked file as a 240 px square JPEG data URL, cropped to its middle. */
export function squarePhoto(file, n = 240) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = c.height = n
      const k = Math.min(img.width, img.height)
      c.getContext('2d').drawImage(img, (img.width - k) / 2, (img.height - k) / 2, k, k, 0, 0, n, n)
      URL.revokeObjectURL(img.src)
      resolve(c.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => reject(new Error('Não foi possível ler a foto.'))
    img.src = URL.createObjectURL(file)
  })
}

/** Your own photo; a tap picks a new one. */
export default function ProfilePhoto({ size = 34, className = '' }) {
  const src = useStore(s => s.S.avatar)
  const pick = async e => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try { const url = await squarePhoto(f); useStore.getState().update(s => { s.avatar = url }) } catch { /* unreadable file */ }
  }
  return <label className={'pp ' + className} style={{ width: size, height: size }} title="Trocar foto">
    {src ? <img src={src} alt="Sua foto" /> : <Icon name="person" />}
    <input type="file" accept="image/*" onChange={pick} hidden />
  </label>
}

const initials = name => (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'

/** Someone's photo (or initials) ringed in their rank's colour, with its letter unless `letter` is false. `rank` is the TIERS index, or null. */
export function PersonPhoto({ name, avatar, rank, size = 36, letter = true }) {
  const tier = rank != null ? TIERS[Math.max(0, Math.min(TIERS.length - 1, rank))] : null
  return <span className="pp-person" style={{ width: size, height: size, '--tc': tier?.c || 'transparent' }}>
    <span className={'pp-face' + (tier ? ' ring' : '')} style={{ fontSize: size * 0.38 }}>{avatar ? <img src={avatar} alt="" loading="lazy" /> : initials(name)}</span>
    {tier && letter && <b className="pp-rank" style={{ fontSize: Math.max(10, size * 0.3) }}>{tier.r}</b>}
  </span>
}
