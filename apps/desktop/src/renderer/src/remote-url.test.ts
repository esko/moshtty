import { describe, expect, it } from 'vitest'
import { buildRemoteWebTransportUrl } from './remote-url'

describe('buildRemoteWebTransportUrl', () => {
  it('adds the WebTransport path for profile origin URLs', () => {
    expect(buildRemoteWebTransportUrl('https://macmini.local:4433', 'secret')).toBe(
      'https://macmini.local:4433/webtransport?token=secret'
    )
  })

  it('preserves an explicit path and appends the token query parameter', () => {
    expect(
      buildRemoteWebTransportUrl('https://macmini.local:4433/webtransport?debug=1', 'secret')
    ).toBe('https://macmini.local:4433/webtransport?debug=1&token=secret')
  })
})
