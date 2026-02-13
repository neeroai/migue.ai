import { describe, expect, it } from '@jest/globals'
import { resolveLocaleStyle } from '../../src/modules/ai/application/locale-style-resolver'

describe('locale style resolver', () => {
  it('detects barranquilla with high confidence from direct mention', () => {
    const resolution = resolveLocaleStyle({
      userMessage: 'Estoy en Barranquilla y hoy voy para el malecón',
      historySnippets: [],
    })

    expect(resolution.city).toBe('barranquilla')
    expect(resolution.confidence).toBeGreaterThanOrEqual(0.72)
    expect(resolution.variant).toBe('caribe_expresivo')
  })

  it('detects bogota from conversational evidence', () => {
    const resolution = resolveLocaleStyle({
      userMessage: 'Hoy en Bogotá el Transmilenio está imposible',
      historySnippets: ['vivo por chapinero'],
    })

    expect(resolution.city).toBe('bogota')
    expect(resolution.variant).toBe('rolo_practico')
  })

  it('returns unknown when confidence is low or ambiguous', () => {
    const resolution = resolveLocaleStyle({
      userMessage: 'Estoy de viaje',
      historySnippets: ['pasé por varias ciudades'],
    })

    expect(resolution.city).toBe('unknown')
    expect(resolution.variant).toBe('base')
  })
})
