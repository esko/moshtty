import React, { useState, useEffect } from 'react'
import { useAppStore } from '../store'
import { XIcon, CheckCircleIcon } from '../design/icons'
import './BootstrapDialog.css'

interface BootstrapDialogProps {
  secretMode: string | null
  onClose: () => void
  actionTitle: (actionId: import('../keymap').AppActionId) => string
}

type BootstrapStep = {
  label: string
  description: string
}

const STEPS: BootstrapStep[] = [
  {
    label: 'Connect & detect',
    description: 'Establishing SSH connection and detecting OS/architecture'
  },
  {
    label: 'Deploy binaries',
    description: 'Uploading moshtty-remote and moshttyctl companion binaries'
  },
  {
    label: 'Install service',
    description: 'Registering and starting companion as a background service'
  },
  {
    label: 'Retrieve profile',
    description: 'Retrieving generated connection profile and authenticating'
  }
]

export const BootstrapDialog: React.FC<BootstrapDialogProps> = ({
  secretMode,
  onClose,
  actionTitle
}) => {
  const importRemoteProfile = useAppStore((state) => state.importRemoteProfile)

  // Form states
  const [host, setHost] = useState('')
  const [port, setPort] = useState(22)
  const [username, setUsername] = useState('')
  const [authType, setAuthType] = useState<'key' | 'password'>('key')
  const [keyPath, setKeyPath] = useState('~/.ssh/id_rsa')
  const [password, setPassword] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [destination, setDestination] = useState('~/.local/bin/moshtty-remote')

  // Execution states
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [errorText, setErrorText] = useState('')
  const [currentStep, setCurrentStep] = useState(0)

  const needsPassphrase = secretMode === 'passphrase' || secretMode === 'unavailable'

  // Handle step updates during running phase
  useEffect(() => {
    if (status !== 'running') return

    const t1 = setTimeout(() => setCurrentStep(1), 2000)
    const t2 = setTimeout(() => setCurrentStep(2), 5000)
    const t3 = setTimeout(() => setCurrentStep(3), 7000)

    return (): void => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [status])

  const handleBootstrap = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!host.trim() || !username.trim()) {
      setErrorText('Host and username are required.')
      setStatus('error')
      return
    }

    setStatus('running')
    setCurrentStep(0)
    setErrorText('')

    try {
      const config = {
        host: host.trim(),
        port,
        username: username.trim(),
        authType,
        keyPath: authType === 'key' ? keyPath.trim() : undefined,
        password: authType === 'password' ? password : undefined,
        destination: destination.trim()
      }

      const result = await window.moshtty.sshBootstrap(config)

      if (result.success && result.profile) {
        // If password/passphrase fallback is active and token is returned, set passphrase and store token
        if (result.profile.token) {
          if (needsPassphrase && passphrase.trim()) {
            await window.moshtty.setPassphrase(passphrase)
          }
          await window.moshtty.storeToken(result.profile.tokenLabel, result.profile.token)
        }

        // Import the profile into Zustand store
        await importRemoteProfile(result.profile)

        // Complete step transitions
        setCurrentStep(STEPS.length)
        setStatus('success')

        // Wait a short moment to show success UI before closing
        setTimeout(() => {
          onClose()
        }, 1200)
      } else {
        setErrorText(result.error || 'Bootstrap failed with an unknown error.')
        setStatus('error')
      }
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }

  return (
    <div className="dialog-backdrop">
      <section
        className="dialog bootstrap-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bootstrap-dialog-title"
      >
        <header className="dialog-header">
          <h2 id="bootstrap-dialog-title">Bootstrap new remote</h2>
          {status !== 'running' && (
            <button
              className="icon-button"
              type="button"
              aria-label="Close bootstrap dialog"
              data-action-id="close-dialog"
              title={actionTitle('close-dialog')}
              onClick={onClose}
            >
              <XIcon size={16} />
            </button>
          )}
        </header>

        {status === 'idle' || status === 'error' ? (
          <form className="bootstrap-form" onSubmit={handleBootstrap}>
            {status === 'error' && <div className="error-banner">{errorText}</div>}

            <div className="form-row">
              <label className="field host-field">
                <span>SSH Host</span>
                <input
                  type="text"
                  required
                  value={host}
                  placeholder="10.0.0.5 or server.local"
                  onChange={(e): void => setHost(e.target.value)}
                />
              </label>
              <label className="field port-field">
                <span>Port</span>
                <input
                  type="number"
                  required
                  value={port}
                  placeholder="22"
                  onChange={(e): void => setPort(Number(e.target.value))}
                />
              </label>
            </div>

            <label className="field">
              <span>Username</span>
              <input
                type="text"
                required
                value={username}
                placeholder="username"
                onChange={(e): void => setUsername(e.target.value)}
              />
            </label>

            <div className="field">
              <span>Authentication Type</span>
              <div className="auth-toggle-row">
                <button
                  type="button"
                  className={`toggle-btn ${authType === 'key' ? 'active' : ''}`}
                  onClick={(): void => setAuthType('key')}
                >
                  SSH Key
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${authType === 'password' ? 'active' : ''}`}
                  onClick={(): void => setAuthType('password')}
                >
                  Password
                </button>
              </div>
            </div>

            {authType === 'key' ? (
              <label className="field">
                <span>SSH Key Path</span>
                <input
                  type="text"
                  required
                  value={keyPath}
                  placeholder="~/.ssh/id_rsa"
                  onChange={(e): void => setKeyPath(e.target.value)}
                />
              </label>
            ) : (
              <label className="field">
                <span>SSH Password</span>
                <input
                  type="password"
                  required
                  value={password}
                  placeholder="password"
                  onChange={(e): void => setPassword(e.target.value)}
                />
              </label>
            )}

            {needsPassphrase && (
              <label className="field">
                <span>Token Passphrase</span>
                <input
                  type="password"
                  required
                  value={passphrase}
                  placeholder="Passphrase to encrypt companion access token"
                  onChange={(e): void => setPassphrase(e.target.value)}
                />
              </label>
            )}

            <label className="field">
              <span>Remote Companion Destination Path</span>
              <input
                type="text"
                required
                value={destination}
                placeholder="~/.local/bin/moshtty-remote"
                onChange={(e): void => setDestination(e.target.value)}
              />
            </label>

            <footer className="dialog-actions">
              <button
                className="button secondary"
                type="button"
                data-action-id="cancel-dialog"
                title={actionTitle('cancel-dialog')}
                onClick={onClose}
              >
                Cancel
              </button>
              <button className="button primary" type="submit">
                Bootstrap
              </button>
            </footer>
          </form>
        ) : (
          <div className="bootstrap-progress-panel">
            {status === 'success' ? (
              <div className="success-banner">
                <CheckCircleIcon size={32} color="var(--color-success)" />
                <h3>Bootstrap Successful!</h3>
                <p>Remote companion has been deployed, registered, and imported successfully.</p>
              </div>
            ) : (
              <div className="progress-banner">
                <div className="spinner" />
                <h3>Deploying Moshtty Remote Companion...</h3>
                <p>
                  Running configuration, compiling binaries, uploading, and registering service.
                </p>
              </div>
            )}

            <div className="steps-list">
              {STEPS.map((step, idx) => {
                let stepStatus: 'pending' | 'running' | 'completed' = 'pending'
                if (currentStep > idx) {
                  stepStatus = 'completed'
                } else if (currentStep === idx && status === 'running') {
                  stepStatus = 'running'
                }

                return (
                  <div key={idx} className={`step-row ${stepStatus}`}>
                    <div className="step-indicator">
                      {stepStatus === 'completed' ? (
                        <CheckCircleIcon size={16} />
                      ) : stepStatus === 'running' ? (
                        <div className="mini-spinner" />
                      ) : (
                        <div className="dot" />
                      )}
                    </div>
                    <div className="step-content">
                      <strong>{step.label}</strong>
                      <span>{step.description}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
