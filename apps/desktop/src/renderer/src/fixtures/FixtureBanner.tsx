/**
 * Renders a small overlay banner when the renderer is running a fixture
 * state (i.e. `?fixture=<id>` is in the URL). The banner is visible only
 * in test / dev contexts and is the signal Playwright tests wait on to
 * confirm the requested fixture has been applied.
 *
 * The two data attributes (`data-fixture-banner`, `data-fixture-id`) are
 * the public test contract — do not rename without updating
 * `apps/desktop/tests/visual/playwright.setup.ts`.
 */

import type { ReactNode } from 'react'
import './FixtureBanner.css'

interface FixtureBannerProps {
  fixtureId: string
  fixtureLabel: string
}

export function FixtureBanner({ fixtureId, fixtureLabel }: FixtureBannerProps): ReactNode {
  return (
    <div
      data-fixture-banner
      data-fixture-id={fixtureId}
      className="fixture-banner"
      role="status"
      aria-live="polite"
    >
      Fixture: {fixtureLabel} ({fixtureId})
    </div>
  )
}
