import child_process from 'child_process'
import electron from 'electron'
const { app } = electron
import fs from 'fs'
import { join, resolve } from 'path'
import type { SshBootstrapConfig, SshBootstrapResult } from '../common/ssh.schema'

// Helper to run an SSH command and return stdout/stderr
function runSshCommand(
  config: SshBootstrapConfig,
  command: string,
  stdinPath?: string
): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const askpassPath = join(app.getPath('userData'), 'ssh-askpass.js')
    if (config.authType === 'password' && config.password) {
      const scriptContent = `#!/usr/bin/env node\nconsole.log(process.env.MOSHTTY_SSH_PASSWORD || '');\n`
      fs.writeFileSync(askpassPath, scriptContent, { mode: 0o755 })
    }

    const sshArgs = [
      '-p',
      String(config.port),
      '-o',
      'StrictHostKeyChecking=no',
      '-o',
      'UserKnownHostsFile=/dev/null',
      '-o',
      'BatchMode=no'
    ]

    if (config.authType === 'key' && config.keyPath) {
      sshArgs.push('-i', config.keyPath)
    }

    sshArgs.push(`${config.username}@${config.host}`, command)

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      MOSHTTY_SSH_PASSWORD: config.password || ''
    }

    if (config.authType === 'password') {
      env.SSH_ASKPASS = askpassPath
      env.SSH_ASKPASS_REQUIRE = 'force'
      env.DISPLAY = ':0'
    }

    const child = child_process.spawn('ssh', sshArgs, { env })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      if (fs.existsSync(askpassPath)) {
        try {
          fs.rmSync(askpassPath)
        } catch {
          // ignore cleanup errors
        }
      }

      if (code === 0) {
        resolvePromise(stdout.trim())
      } else {
        rejectPromise(new Error(stderr.trim() || `SSH command exited with code ${code}`))
      }
    })

    if (stdinPath) {
      const readStream = fs.createReadStream(stdinPath)
      readStream.pipe(child.stdin)
    }
  })
}

// Detect if go binary is available locally
function isGoAvailable(): boolean {
  try {
    child_process.execSync('go version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// Compile binary on the fly for remote target
function compileBinary(
  component: 'moshtty-remote' | 'moshttyctl',
  goos: string,
  goarch: string,
  outPath: string
): void {
  const rootDir = resolve(app.getAppPath(), '../../')
  const cmdDir = join(rootDir, 'cmd', component)

  const env = {
    ...process.env,
    GOOS: goos,
    GOARCH: goarch,
    CGO_ENABLED: '0'
  }

  child_process.execSync(`go build -o "${outPath}" .`, {
    cwd: cmdDir,
    env,
    stdio: 'ignore'
  })
}

export async function sshBootstrap(config: SshBootstrapConfig): Promise<SshBootstrapResult> {
  const tempDir = join(app.getPath('userData'), 'ssh-bootstrap-temp')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }

  try {
    // 1. Detect remote target OS and architecture
    const remoteInfo = await runSshCommand(config, 'uname -s && uname -m')
    const [remoteOS, remoteArchRaw] = remoteInfo.split('\n')

    let goos = ''
    if (remoteOS.trim() === 'Darwin') {
      goos = 'darwin'
    } else if (remoteOS.trim() === 'Linux') {
      goos = 'linux'
    } else {
      throw new Error(`Unsupported remote operating system: ${remoteOS}`)
    }

    let goarch = ''
    const arch = remoteArchRaw.trim()
    if (arch === 'x86_64' || arch === 'amd64') {
      goarch = 'amd64'
    } else if (arch === 'arm64' || arch === 'aarch64') {
      goarch = 'arm64'
    } else {
      throw new Error(`Unsupported remote CPU architecture: ${arch}`)
    }

    // Determine target local binary sources and compile if possible
    const localRemotePath = join(tempDir, 'moshtty-remote-target')
    const localCtlPath = join(tempDir, 'moshttyctl-target')

    if (isGoAvailable()) {
      compileBinary('moshtty-remote', goos, goarch, localRemotePath)
      compileBinary('moshttyctl', goos, goarch, localCtlPath)
    } else {
      // Fallback to bundled prebuilt binaries
      const rootDir = resolve(app.getAppPath(), '../../')
      let prebuiltRemote = ''
      let prebuiltCtl = ''

      if (!app.isPackaged) {
        if (goos === 'darwin') {
          prebuiltRemote = join(rootDir, 'moshtty-remote-macos')
          prebuiltCtl = join(rootDir, 'bin', 'moshttyctl') // macOS might fallback to local compiled
        } else {
          prebuiltRemote = join(rootDir, 'bin', 'moshtty-remote')
          prebuiltCtl = join(rootDir, 'bin', 'moshttyctl')
        }
      } else {
        const resourcesPath = process.resourcesPath
        prebuiltRemote = join(resourcesPath, `moshtty-remote-${goos}-${goarch}`)
        prebuiltCtl = join(resourcesPath, `moshttyctl-${goos}-${goarch}`)
      }

      if (!fs.existsSync(prebuiltRemote)) {
        throw new Error(`Bundled remote companion binary not found: ${prebuiltRemote}`)
      }
      if (!fs.existsSync(prebuiltCtl)) {
        throw new Error(`Bundled remote CLI binary not found: ${prebuiltCtl}`)
      }

      // Copy to target local paths
      fs.writeFileSync(localRemotePath, child_process.execSync(`cat "${prebuiltRemote}"`))
      fs.writeFileSync(localCtlPath, child_process.execSync(`cat "${prebuiltCtl}"`))
    }

    // 2. Upload binaries to remote host
    const destRemote = config.destination
    const destDir = destRemote.substring(0, destRemote.lastIndexOf('/'))
    const destCtl = join(destDir, 'moshttyctl')

    await runSshCommand(
      config,
      `mkdir -p "${destDir}" && cat > "${destRemote}" && chmod +x "${destRemote}"`,
      localRemotePath
    )

    await runSshCommand(
      config,
      `mkdir -p "${destDir}" && cat > "${destCtl}" && chmod +x "${destCtl}"`,
      localCtlPath
    )

    // 3. Register service on remote host
    await runSshCommand(config, `"${destRemote}" install --binary "${destRemote}"`)

    if (goos === 'darwin') {
      await runSshCommand(
        config,
        `launchctl unload ~/Library/LaunchAgents/com.moshtty.remote.plist 2>/dev/null || true`
      )
      await runSshCommand(
        config,
        `launchctl load -w ~/Library/LaunchAgents/com.moshtty.remote.plist`
      )
    } else {
      await runSshCommand(
        config,
        `systemctl --user daemon-reload && systemctl --user enable --now moshtty-remote`
      )
    }

    // 4. Retrieve profile JSON
    // Give it a brief moment to spin up and write configuration
    await new Promise((r) => setTimeout(r, 1500))
    const profileJsonText = await runSshCommand(config, `"${destRemote}" profile`)

    const profile = JSON.parse(profileJsonText)

    return {
      success: true,
      profile
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  } finally {
    // Clean up temporary local files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore temp folder cleanup errors
    }
  }
}
