import { describe, expect, it } from 'vitest'
import { barPoint, platesAt, markSVG, MARK_TOP, COLLAR, BAR } from './carga-mark.js'

describe('the CARGA mark', () => {
  it('a straight bar is a straight line', () => {
    expect(barPoint(-BAR / 2, 0, 50)).toEqual([20, 50, 0])
    expect(barPoint(BAR / 2, 0, 50)).toEqual([220, 50, 0])
  })
  it('fully bent, the sleeves run parallel, so the plates on them stand the same way', () => {
    const [, , inner] = barPoint(COLLAR + 1, 1, MARK_TOP)
    const [, , outer] = barPoint(BAR / 2, 1, MARK_TOP)
    expect(inner).toBeCloseTo(90, 5)
    expect(outer).toBeCloseTo(90, 5)
    for (const p of platesAt(1, MARK_TOP)) expect(Math.abs(p.deg)).toBeCloseTo(90, 5)
  })
  it('draws three plates on each sleeve', () => {
    expect(platesAt(1, MARK_TOP)).toHaveLength(6)
    expect(markSVG().match(/<rect /g)).toHaveLength(6)
  })
  it('takes a CSS variable for its colours', () => {
    expect(markSVG({ plate: 'var(--label)' })).toContain('fill:var(--label)')
  })
})
