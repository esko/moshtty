import type { ReactNode } from 'react'

interface FixtureBannerProps {
  fixtureId: string
  fixtureLabel: string
}

export function FixtureBanner({ fixtureId, fixtureLabel }: FixtureBannerProps): ReactNode {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        padding: '4px 12px',
        background: 'var(--color-warning)',
        color: '#000',
        fontSize: 'var(--font-size-caption)',
        fontFamily: 'var(--font-family-ui)',
        zIndex: 1000,
        borderBottomLeftRadius: 'var(--radius-sm)'
      }}
    >
      Fixture: {fixtureLabel} ({fixtureId})
    </div>
  )
}
