import { describe, expect, it } from 'vitest'
import { brandText } from './brand.js'

describe('brandText', () => {
  it('puts the app name where the strings say openGym', () => {
    expect(brandText('Reload openGym', 'CARGA')).toBe('Reload CARGA')
    expect(brandText('Your 2026 in openGym is ready', 'CARGA')).toBe('Your 2026 in CARGA is ready')
  })
  // CARGA: the backup folder is named after the app (lib/mobile.js AUTO_BACKUP_DIR), so its path follows too
  it('names the backup folder the app writes to', () => {
    expect(brandText('copies go to Documents/openGym again', 'CARGA')).toBe('copies go to Documents/CARGA again')
  })
  it('passes anything that is not a string through', () => {
    expect(brandText(undefined, 'CARGA')).toBe(undefined)
  })
})

describe('the starting language', () => {
  it('a copy nobody picked a language for starts in the app\'s own, ahead of the browser\'s', async () => {
    const { autoLang } = await import('./default-lang.js')
    expect(autoLang({ langAuto: true }, null, ['en-US'], 'pt-BR')).toBe('pt-BR')
    expect(autoLang({ langAuto: true }, { default_lang: 'de' }, ['en-US'], 'pt-BR')).toBe('de')
  })
  it('a language picked in Settings stays', async () => {
    const { autoLang } = await import('./default-lang.js')
    expect(autoLang({ lang: 'en' }, null, [], 'pt-BR')).toBe(null)
  })
})
