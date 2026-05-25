export function buildRemoteWebTransportUrl(remoteUrl: string, token: string): string {
  const url = new URL(remoteUrl)
  if (url.pathname === '/' || url.pathname === '') {
    url.pathname = '/webtransport'
  }
  url.searchParams.set('token', token)
  return url.toString()
}
