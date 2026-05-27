import { describe, expect, test, vi, beforeEach } from 'vitest'
import { sshBootstrap } from './ssh-bootstrap'
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
})
