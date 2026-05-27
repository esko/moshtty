import { describe, expect, it } from 'vitest'
import {
  COMPANION_RELEASE_VERSION,
  companionBinaryDownloadUrl,
  companionReleaseTag
} from './companion-version'

describe('companion-version', () => {
  it('uses pinned release tag', () => {
    expect(companionReleaseTag()).toBe(`v${COMPANION_RELEASE_VERSION}`)
  })

  it('builds GitHub download URL for esko/moshtty assets', () => {
    expect(companionBinaryDownloadUrl('moshtty-remote', 'linux', 'amd64')).toBe(
      `https://github.com/esko/moshtty/releases/download/v${COMPANION_RELEASE_VERSION}/moshtty-remote-linux-amd64`
    )
  })
})
