import { describe, it, expect } from 'vitest'
import { compareVersions, wants } from './live-update.js'

describe('live updates', () => {
  it('compares versions as numbers', () => {
    expect(compareVersions('2026.1112.1630', '2026.1112.0900')).toBe(1)
    expect(compareVersions('1.10.0', '1.2.0')).toBe(1)
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
  })
  it('downloads only a newer bundle the installed app can run', () => {
    const feed = { version: '2026.1113.1000', url: 'https://x/carga.zip', native: '1.0.0' }
    expect(wants(feed, '2026.1112.1630', '1.0.0')).toBe(true)
    expect(wants(feed, '2026.1113.1000', '1.0.0')).toBe(false)           // already running it
    expect(wants(feed, '2026.1114.0800', '1.0.0')).toBe(false)           // never goes back
    expect(wants({ ...feed, native: '1.1.0' }, '2026.1112.1630', '1.0.0')).toBe(false) // needs the store update first
    expect(wants(null, '2026.1112.1630', '1.0.0')).toBe(false)
  })
})
