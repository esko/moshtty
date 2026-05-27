/**
 * Companion release version for moshtty-remote / moshttyctl GitHub assets.
 * Keep in sync with version/companion at the repo root.
 */
export const COMPANION_RELEASE_VERSION = '0.270526'

export const COMPANION_GITHUB_REPO = 'esko/moshtty'

/** Git tag for release assets (e.g. v0.270526). */
export function companionReleaseTag(): string {
  return `v${COMPANION_RELEASE_VERSION}`
}

export function companionBinaryDownloadUrl(
  component: 'moshtty-remote' | 'moshttyctl',
  goos: string,
  goarch: string
): string {
  return `https://github.com/${COMPANION_GITHUB_REPO}/releases/download/${companionReleaseTag()}/${component}-${goos}-${goarch}`
}
