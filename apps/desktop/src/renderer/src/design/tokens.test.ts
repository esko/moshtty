import { describe, expect, it } from 'vitest'
import { resolveColors, lightColors, darkColors, space, radius, fontSize, motion, density } from './tokens'

describe('tokens', () => {
  describe('resolveColors', () => {
    it('returns light colors for light mode', () => {
      expect(resolveColors('light')).toEqual(lightColors)
    })

    it('returns dark colors for dark mode', () => {
      expect(resolveColors('dark')).toEqual(darkColors)
    })
  })

  describe('space scale', () => {
    it('major steps are 4-pt based', () => {
      const major = [space.xs, space.sm, space.md, space.lg, space.xl, space['2xl'], space['3xl']]
      for (const value of major) {
        expect(value % 4).toBe(0)
      }
    })
  })

  describe('radius', () => {
    it('pill is very large', () => {
      expect(radius.pill).toBeGreaterThan(100)
    })
  })

  describe('fontSize', () => {
    it('body floor is 13px', () => {
      expect(fontSize.body).toBeGreaterThanOrEqual(13)
    })
  })

  describe('motion', () => {
    it('all durations are positive', () => {
      expect(motion.durationFast).toBeGreaterThan(0)
      expect(motion.durationBase).toBeGreaterThan(0)
      expect(motion.durationSlow).toBeGreaterThan(0)
    })
  })

  describe('density', () => {
    it('touch target is at least 44px', () => {
      expect(density.touchTarget).toBeGreaterThanOrEqual(44)
    })
  })
})
