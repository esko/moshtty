import { describe, expect, test, vi, beforeEach } from 'vitest'
import { sshBootstrap, downloadBinary } from './ssh-bootstrap'
import child_process from 'child_process'
import { Writable } from 'stream'
import fs from 'fs'

vi.mock('electron', () => {
  return {
    default: {
      app: {
        getPath: vi.fn().mockReturnValue('/tmp/moshtty-test-userdata'),
        getAppPath: vi.fn().mockReturnValue('/tmp/moshtty-test-apppath'),
        isPackaged: false
      }
    }
  }
})

vi.mock('child_process', () => {
  return {
    default: {
      spawn: vi.fn(),
      execSync: vi.fn()
    }
  }
})

// fs is not mocked to avoid interop issues. The tests use the actual filesystem
// with the mocked app.getPath pointing to a real temp directory.

describe('sshBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('successfully bootstraps a macOS target using key authentication', async () => {
    const mockSpawn = vi.fn().mockImplementation((_, args) => {
      const command = args[args.length - 1]
      const child = {
        stdout: {
          on: vi.fn().mockImplementation((event, callback) => {
            if (event === 'data') {
              if (command.includes('uname')) {
                process.nextTick(() => callback(Buffer.from('Darwin\nx86_64\n')))
              } else if (command.includes('profile')) {
                process.nextTick(() =>
                  callback(Buffer.from('{"remoteId": "macmini-1", "hostLabel": "My Mac"}'))
                )
              } else {
                process.nextTick(() => callback(Buffer.from('')))
              }
            }
          })
        },
        stderr: {
          on: vi.fn()
        },
        stdin: new Writable({
          write(_chunk, _encoding, callback) {
            callback()
          }
        }),
        on: vi.fn().mockImplementation((event, callback) => {
          if (event === 'close') {
            process.nextTick(() => callback(0))
          }
        })
      }
      return child
    })

    vi.mocked(child_process.spawn).mockImplementation(mockSpawn as never)
    vi.mocked(child_process.execSync).mockImplementation((cmd) => {
      if (cmd === 'go version') {
        return Buffer.from('go version go1.26 linux/amd64')
      }
      const match = typeof cmd === 'string' && cmd.match(/go build -o "([^"]+)"/)
      if (match) {
        const outPath = match[1]
        fs.writeFileSync(outPath, 'dummy binary content')
        return Buffer.from('')
      }
      return Buffer.from('')
    })

    const config = {
      host: '10.0.0.5',
      port: 22,
      username: 'esko',
      authType: 'key' as const,
      keyPath: '~/.ssh/id_ed25519',
      destination: '~/.local/bin/moshtty-remote'
    }

    const result = await sshBootstrap(config)

    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
    expect(child_process.spawn).toHaveBeenCalled()
  })

  test('password authentication does not include -i flag in ssh args', async () => {
    const mockSpawn = vi.fn().mockImplementation((_, args) => {
      const command = args[args.length - 1]
      const child = {
        stdout: {
          on: vi.fn().mockImplementation((event, callback) => {
            if (event === 'data') {
              if (command.includes('uname')) {
                process.nextTick(() => callback(Buffer.from('Darwin\nx86_64\n')))
              } else if (command.includes('profile')) {
                process.nextTick(() =>
                  callback(Buffer.from('{"remoteId": "mac-pw", "hostLabel": "Mac PW"}'))
                )
              } else {
                process.nextTick(() => callback(Buffer.from('')))
              }
            }
          })
        },
        stderr: {
          on: vi.fn()
        },
        stdin: new Writable({
          write(_chunk, _encoding, callback) {
            callback()
          }
        }),
        on: vi.fn().mockImplementation((event, callback) => {
          if (event === 'close') {
            process.nextTick(() => callback(0))
          }
        })
      }
      return child
    })

    vi.mocked(child_process.spawn).mockImplementation(mockSpawn as never)
    vi.mocked(child_process.execSync).mockImplementation((cmd) => {
      if (cmd === 'go version') {
        return Buffer.from('go version go1.26 linux/amd64')
      }
      const match = typeof cmd === 'string' && cmd.match(/go build -o "([^"]+)"/)
      if (match) {
        const outPath = match[1]
        fs.writeFileSync(outPath, 'dummy binary content')
        return Buffer.from('')
      }
      return Buffer.from('')
    })

    const config = {
      host: '10.0.0.6',
      port: 22,
      username: 'esko',
      authType: 'password' as const,
      password: 's3cr3t',
      destination: '~/.local/bin/moshtty-remote'
    }

    const result = await sshBootstrap(config)

    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
    // Verify that no spawn call included '-i' in its args
    const spawnCalls = vi.mocked(child_process.spawn).mock.calls
    for (const [, spawnArgs] of spawnCalls) {
      expect(spawnArgs).not.toContain('-i')
    }
  })

  test('uses systemctl when remote OS is Linux', async () => {
    const serviceCommands: string[] = []
    const mockSpawn = vi.fn().mockImplementation((_, args) => {
      const command = args[args.length - 1]
      if (command.includes('systemctl') || command.includes('launchctl')) {
        serviceCommands.push(command)
      }
      const child = {
        stdout: {
          on: vi.fn().mockImplementation((event, callback) => {
            if (event === 'data') {
              if (command.includes('uname')) {
                process.nextTick(() => callback(Buffer.from('Linux\nx86_64\n')))
              } else if (command.includes('profile')) {
                process.nextTick(() =>
                  callback(Buffer.from('{"remoteId": "linux-1", "hostLabel": "Linux Box"}'))
                )
              } else {
                process.nextTick(() => callback(Buffer.from('')))
              }
            }
          })
        },
        stderr: {
          on: vi.fn()
        },
        stdin: new Writable({
          write(_chunk, _encoding, callback) {
            callback()
          }
        }),
        on: vi.fn().mockImplementation((event, callback) => {
          if (event === 'close') {
            process.nextTick(() => callback(0))
          }
        })
      }
      return child
    })

    vi.mocked(child_process.spawn).mockImplementation(mockSpawn as never)
    vi.mocked(child_process.execSync).mockImplementation((cmd) => {
      if (cmd === 'go version') {
        return Buffer.from('go version go1.26 linux/amd64')
      }
      const match = typeof cmd === 'string' && cmd.match(/go build -o "([^"]+)"/)
      if (match) {
        const outPath = match[1]
        fs.writeFileSync(outPath, 'dummy binary content')
        return Buffer.from('')
      }
      return Buffer.from('')
    })

    const config = {
      host: '10.0.0.7',
      port: 22,
      username: 'esko',
      authType: 'key' as const,
      keyPath: '~/.ssh/id_ed25519',
      destination: '~/.local/bin/moshtty-remote'
    }

    const result = await sshBootstrap(config)

    expect(result.success).toBe(true)
    // At least one service command should contain 'systemctl', none should contain 'launchctl'
    expect(serviceCommands.some((cmd) => cmd.includes('systemctl'))).toBe(true)
    expect(serviceCommands.some((cmd) => cmd.includes('launchctl'))).toBe(false)
  })

  test('handles connection or execution failures gracefully', async () => {
    const mockSpawn = vi.fn().mockImplementation(() => {
      const child = {
        stdout: {
          on: vi.fn()
        },
        stderr: {
          on: vi.fn().mockImplementation((event, callback) => {
            if (event === 'data') {
              process.nextTick(() => callback(Buffer.from('Permission denied (publickey).')))
            }
          })
        },
        stdin: new Writable({
          write(_chunk, _encoding, callback) {
            callback()
          }
        }),
        on: vi.fn().mockImplementation((event, callback) => {
          if (event === 'close') {
            process.nextTick(() => callback(255))
          }
        })
      }
      return child
    })

    vi.mocked(child_process.spawn).mockImplementation(mockSpawn as never)

    const config = {
      host: '10.0.0.5',
      port: 22,
      username: 'esko',
      authType: 'key' as const,
      keyPath: '~/.ssh/id_ed25519',
      destination: '~/.local/bin/moshtty-remote'
    }

    const result = await sshBootstrap(config)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Permission denied/)
  })

  test('returns error when go is not available, prebuilt binaries are missing, and download fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    })
    vi.stubGlobal('fetch', mockFetch)

    const mockSpawn = vi.fn().mockImplementation((_, args) => {
      const command = args[args.length - 1]
      const child = {
        stdout: {
          on: vi.fn().mockImplementation((event, callback) => {
            if (event === 'data') {
              if (command.includes('uname')) {
                process.nextTick(() => callback(Buffer.from('Darwin\nx86_64\n')))
              } else {
                process.nextTick(() => callback(Buffer.from('')))
              }
            }
          })
        },
        stderr: {
          on: vi.fn()
        },
        stdin: new Writable({
          write(_chunk, _encoding, callback) {
            callback()
          }
        }),
        on: vi.fn().mockImplementation((event, callback) => {
          if (event === 'close') {
            process.nextTick(() => callback(0))
          }
        })
      }
      return child
    })

    vi.mocked(child_process.spawn).mockImplementation(mockSpawn as never)
    vi.mocked(child_process.execSync).mockImplementation(() => {
      throw new Error('go not found')
    })

    const config = {
      host: '10.0.0.8',
      port: 22,
      username: 'esko',
      authType: 'key' as const,
      keyPath: '~/.ssh/id_ed25519',
      destination: '~/.local/bin/moshtty-remote'
    }

    const result = await sshBootstrap(config)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Failed to download binary from')
    vi.unstubAllGlobals()
  })

  test('downloadBinary fetches and writes the binary to destPath', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode('downloaded binary data').buffer
    })
    vi.stubGlobal('fetch', mockFetch)

    const destPath = '/tmp/moshtty-test-userdata/downloaded-test-bin'
    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath)
    }

    await downloadBinary('moshtty-remote', 'linux', 'amd64', destPath)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://github.com/moshtty/moshtty/releases/latest/download/moshtty-remote-linux-amd64'
    )
    expect(fs.readFileSync(destPath, 'utf8')).toBe('downloaded binary data')

    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath)
    }
    vi.unstubAllGlobals()
  })

  test('sshBootstrap falls back to downloading when go is not available and prebuilt binaries are missing', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode('downloaded mock content').buffer
    })
    vi.stubGlobal('fetch', mockFetch)

    const mockSpawn = vi.fn().mockImplementation((_, args) => {
      const command = args[args.length - 1]
      const child = {
        stdout: {
          on: vi.fn().mockImplementation((event, callback) => {
            if (event === 'data') {
              if (command.includes('uname')) {
                process.nextTick(() => callback(Buffer.from('Linux\nx86_64\n')))
              } else if (command.includes('profile')) {
                process.nextTick(() =>
                  callback(Buffer.from('{"remoteId": "linux-dl", "hostLabel": "Linux DL"}'))
                )
              } else {
                process.nextTick(() => callback(Buffer.from('')))
              }
            }
          })
        },
        stderr: {
          on: vi.fn()
        },
        stdin: new Writable({
          write(_chunk, _encoding, callback) {
            callback()
          }
        }),
        on: vi.fn().mockImplementation((event, callback) => {
          if (event === 'close') {
            process.nextTick(() => callback(0))
          }
        })
      }
      return child
    })

    vi.mocked(child_process.spawn).mockImplementation(mockSpawn as never)
    vi.mocked(child_process.execSync).mockImplementation(() => {
      throw new Error('go not found')
    })

    const config = {
      host: '10.0.0.9',
      port: 22,
      username: 'esko',
      authType: 'key' as const,
      keyPath: '~/.ssh/id_ed25519',
      destination: '/tmp/moshtty-test-userdata/dest/moshtty-remote'
    }

    const result = await sshBootstrap(config)

    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://github.com/moshtty/moshtty/releases/latest/download/moshtty-remote-linux-amd64'
    )
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://github.com/moshtty/moshtty/releases/latest/download/moshttyctl-linux-amd64'
    )

    vi.unstubAllGlobals()
  })
})
