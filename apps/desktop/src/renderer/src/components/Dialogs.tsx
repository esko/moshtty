import React, { useState } from 'react'
import { useAppStore } from '../store'
import type { MoshttyRemote } from '../../../common/state'
import { XIcon, GearIcon, KeyboardIcon } from '../design/icons'
import { parseMoshttyProfileText } from '../../../common/profile.schema'
import {
  TERMINAL_COLOR_SCHEMES,
  loadTerminalColorSchemeKey,
  saveTerminalColorSchemeKey,
  type TerminalColorSchemeKey
} from '../design/terminalThemes'
import { getShortcutActions, APP_ACTIONS, formatShortcut } from '../keymap'
import type { AppDialog } from '../dialogs'
import './Dialogs.css'
import { BootstrapDialog } from './BootstrapDialog'

interface DialogsProps {
  state: import('../../../common/state').MoshttyState | null
  secretMode: string | null
  visibleDialog: AppDialog | null
  closeDialog: () => void
  actionTitle: (actionId: import('../keymap').AppActionId) => string
  terminalMode: string
  liveStatus?: MoshttyRemote['status'] | null
  openDialog: (dialog: AppDialog) => void
}

export const Dialogs: React.FC<DialogsProps> = ({
  state,
  secretMode,
  visibleDialog,
  closeDialog,
  actionTitle,
  terminalMode,
  liveStatus = null,
  openDialog
}) => {
  const addProject = useAppStore((state) => state.addProject)
  const renameProject = useAppStore((s) => s.renameProject)
  const importRemoteProfile = useAppStore((state) => state.importRemoteProfile)
  const dismissDialog = closeDialog
  const activeDialog = visibleDialog

  if (!activeDialog) {
    return null
  }

  const saveProjectDialog = (name: string): void => {
    if (activeDialog.kind === 'project' && activeDialog.mode === 'new') {
      addProject(name).catch(console.error)
    }
    dismissDialog()
  }

  const importProfileDialog = async (profileText: string, passphrase: string): Promise<boolean> => {
    const result = parseMoshttyProfileText(profileText)
    if (!result.ok) {
      return false
    }
    if (result.profile.token) {
      try {
        if (passphrase.trim()) {
          await window.moshtty.setPassphrase(passphrase)
        }
        await window.moshtty.storeToken(result.profile.tokenLabel, result.profile.token)
      } catch (error) {
        console.error('Failed to store remote token:', error)
        return false
      }
    }
    await importRemoteProfile(result.profile)
    dismissDialog()
    return true
  }

  switch (activeDialog.kind) {
    case 'import':
      return (
        <ImportDialog
          mode={activeDialog.mode}
          secretMode={secretMode}
          onClose={dismissDialog}
          onImport={importProfileDialog}
          actionTitle={actionTitle}
        />
      )
    case 'project': {
      if (activeDialog.mode === 'existing') {
        const project = state?.projects.find((p) => p.id === activeDialog.projectId)
        const remote =
          project?.remoteId != null
            ? state?.remotes.find((entry) => entry.id === project.remoteId)
            : undefined
        const projectLiveStatus = liveStatus ?? remote?.status ?? null
        return (
          <ProjectDialog
            mode="existing"
            projectName={project?.name ?? 'Unknown project'}
            liveStatus={projectLiveStatus}
            hasRemote
            openDialog={openDialog}
            onClose={dismissDialog}
            onSave={(name) => {
              if (project) {
                renameProject(project.id, name).catch(console.error)
              }
              dismissDialog()
            }}
            actionTitle={actionTitle}
          />
        )
      }
      return (
        <ProjectDialog
          mode="new"
          projectName=""
          liveStatus={null}
          hasRemote={false}
          openDialog={openDialog}
          onClose={dismissDialog}
          onSave={saveProjectDialog}
          actionTitle={actionTitle}
        />
      )
    }
    case 'settings':
      return (
        <SettingsDialog
          terminalMode={terminalMode}
          onClose={dismissDialog}
          actionTitle={actionTitle}
        />
      )
    case 'bootstrap':
      return (
        <BootstrapDialog
          secretMode={secretMode}
          onClose={dismissDialog}
          actionTitle={actionTitle}
        />
      )
    default:
      return null
  }
}

/* ==========================================================================
   ProjectDialog Component
   ========================================================================== */
type BootstrapConnectionStatus = 'connected' | 'connecting' | 'lost'

function bootstrapStatusFor(
  mode: 'new' | 'existing',
  liveStatus: MoshttyRemote['status'] | null
): { status: BootstrapConnectionStatus; label: string } {
  if (mode === 'new') {
    return { status: 'lost', label: 'Not configured' }
  }
  if (liveStatus === 'connected') {
    return { status: 'connected', label: 'Connected' }
  }
  if (liveStatus === 'connecting') {
    return { status: 'connecting', label: 'Connecting…' }
  }
  return { status: 'lost', label: 'Offline' }
}

interface ProjectDialogProps {
  mode: 'new' | 'existing'
  projectName: string
  liveStatus: MoshttyRemote['status'] | null
  hasRemote: boolean
  openDialog: (dialog: AppDialog) => void
  onClose: () => void
  onSave: (name: string) => void
  actionTitle: (actionId: import('../keymap').AppActionId) => string
}

const ProjectDialog: React.FC<ProjectDialogProps> = ({
  mode,
  projectName,
  liveStatus,
  hasRemote,
  openDialog,
  onClose,
  onSave,
  actionTitle
}) => {
  const [name, setName] = useState(mode === 'new' ? '' : projectName)
  const { status: remoteStatus, label: remoteStatusLabel } = bootstrapStatusFor(mode, liveStatus)

  return (
    <div className="dialog-backdrop">
      <section
        className="dialog project-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
      >
        <header className="dialog-header">
          <h2 id="project-dialog-title">{mode === 'new' ? 'New project' : 'Edit project'}</h2>
          <button
            className="icon-button"
            type="button"
            aria-label="Close project dialog"
            data-action-id="close-dialog"
            title={actionTitle('close-dialog')}
            onClick={onClose}
          >
            <XIcon size={16} />
          </button>
        </header>
        <form
          className="project-form"
          onSubmit={(event): void => {
            event.preventDefault()
            onSave(name)
          }}
        >
          <section className="project-section">
            <h3>Project</h3>
            <div className="settings-row">
              <div>
                <strong>Name</strong>
                <span>Display name in the sidebar and tab bar</span>
              </div>
              <input
                value={name}
                placeholder="Remote dev"
                aria-label="Project name"
                onChange={(event): void => setName(event.target.value)}
              />
            </div>
            <div className="settings-row">
              <div>
                <strong>Color</strong>
                <span>Chip color in the sidebar</span>
              </div>
              <div className="project-chip-editor">
                <div className="large-chip">{(name || '').charAt(0).toUpperCase() || 'M'}</div>
                <div className="swatch-row" aria-label="Project color choices">
                  <button
                    className="swatch active"
                    type="button"
                    aria-label="Use default color"
                    data-action-id="choose-project-color"
                  />
                  <button
                    className="swatch muted"
                    type="button"
                    aria-label="Use muted color"
                    data-action-id="choose-project-color"
                  />
                  <button
                    className="swatch warm"
                    type="button"
                    aria-label="Use warning color"
                    data-action-id="choose-project-color"
                  />
                </div>
              </div>
            </div>
          </section>
          <section className="project-section">
            <h3>Remote server</h3>
            <div className="settings-row">
              <div>
                <strong>Bootstrap status</strong>
                <span>Connection to the remote companion</span>
              </div>
              <span className="project-status-pill" data-status={remoteStatus}>
                <span className="pane-status-dot" data-status={remoteStatus} aria-hidden="true" />
                {remoteStatusLabel}
              </span>
            </div>
            <div className="settings-row">
              <div>
                <strong>Companion package</strong>
                <span>Installs moshtty-remote on the target via SSH.</span>
              </div>
              <button
                type="button"
                className="button primary"
                data-action-id="open-bootstrap-dialog"
                onClick={(): void => openDialog({ kind: 'bootstrap' })}
              >
                {hasRemote ? 'Update' : 'Install'}
              </button>
            </div>
          </section>
          <section className="project-section">
            <h3>Profile import</h3>
            <div className="settings-row">
              <div>
                <strong>Paste profile JSON</strong>
                <span>Paste a Moshtty profile to seed this project.</span>
              </div>
              <button
                type="button"
                className="button secondary"
                data-action-id="open-import-dialog"
                onClick={(): void => openDialog({ kind: 'import', mode: 'empty' })}
              >
                Import from profile
              </button>
            </div>
          </section>
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
            <button
              className="button primary"
              type="submit"
              data-action-id="confirm-dialog"
              title={actionTitle('confirm-dialog')}
            >
              {mode === 'new' ? 'Create' : 'Save'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

/* ==========================================================================
   ImportDialog Component
   ========================================================================== */
interface ImportDialogProps {
  mode: 'empty' | 'valid' | 'invalid'
  secretMode: string | null
  onClose: () => void
  onImport: (profileText: string, passphrase: string) => Promise<boolean>
  actionTitle: (actionId: import('../keymap').AppActionId) => string
}

const ImportDialog: React.FC<ImportDialogProps> = ({
  mode,
  secretMode,
  onClose,
  onImport,
  actionTitle
}) => {
  const validProfile = `{
  "schemaVersion": 1,
  "remoteId": "remote-mac-mini",
  "hostLabel": "Mac mini",
  "platform": "macos",
  "serviceVersion": "0.1.0",
  "url": "https://macmini.local:4433",
  "tokenLabel": "default",
  "currentCertHash": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  "nextCertHash": null,
  "defaults": {
    "cols": 120,
    "rows": 32
  }
}`
  const initialText = mode === 'valid' ? validProfile : mode === 'invalid' ? '{ "host": ' : ''
  const [profileText, setProfileText] = useState(initialText)
  const [passphrase, setPassphrase] = useState('')
  const [parseFailed, setParseFailed] = useState(mode === 'invalid')
  const parsedProfile = profileText.trim() ? parseMoshttyProfileText(profileText) : null
  const needsPassphrase =
    (secretMode === 'passphrase' || secretMode === 'unavailable') &&
    parsedProfile?.ok === true &&
    Boolean(parsedProfile.profile.token)
  const invalid = parseFailed

  return (
    <div className="dialog-backdrop">
      <section
        className="dialog import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
      >
        <header className="dialog-header">
          <h2 id="import-dialog-title">Import remote</h2>
          <button
            className="icon-button"
            type="button"
            aria-label="Close import dialog"
            data-action-id="close-dialog"
            title={actionTitle('close-dialog')}
            onClick={onClose}
          >
            <XIcon size={16} />
          </button>
        </header>
        <label className="field">
          <span>Profile JSON</span>
          <textarea
            value={profileText}
            placeholder="Paste profile JSON"
            aria-invalid={invalid}
            onChange={(event): void => {
              setProfileText(event.target.value)
              setParseFailed(false)
            }}
          />
        </label>
        {invalid && (
          <p className="error-text">
            Could not import profile. Check the JSON and token passphrase, then try again.
          </p>
        )}
        {needsPassphrase && (
          <label className="field">
            <span>Token passphrase</span>
            <input
              value={passphrase}
              type="password"
              placeholder="Encrypt remote token"
              onChange={(event): void => setPassphrase(event.target.value)}
            />
          </label>
        )}
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
          <button
            className="button primary"
            type="button"
            data-action-id="confirm-dialog"
            title={actionTitle('confirm-dialog')}
            onClick={(): void => {
              onImport(profileText, passphrase)
                .then((imported) => setParseFailed(!imported))
                .catch(console.error)
            }}
          >
            Import
          </button>
        </footer>
      </section>
    </div>
  )
}

/* ==========================================================================
   SettingsDialog Component
   ========================================================================== */
interface SettingsDialogProps {
  terminalMode: string
  onClose: () => void
  actionTitle: (actionId: import('../keymap').AppActionId) => string
}

type AppThemeKey = 'light' | 'dark' | 'system'
type CursorStyleKey = 'block' | 'bar' | 'underline'

const APP_THEME_KEY = 'moshtty:appTheme'
const FONT_SIZE_KEY = 'moshtty:fontSize'
const CURSOR_STYLE_KEY = 'moshtty:cursorStyle'

const readStorage = (key: string, fallback: string): string => {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

const writeStorage = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* localStorage may be unavailable in fixtures */
  }
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ terminalMode, onClose, actionTitle }) => {
  const [section, setSection] = useState<'general' | 'shortcuts'>('general')
  const [colorScheme, setColorScheme] = useState<TerminalColorSchemeKey>(loadTerminalColorSchemeKey)
  const [appTheme, setAppTheme] = useState<AppThemeKey>(
    () => readStorage(APP_THEME_KEY, 'system') as AppThemeKey
  )
  const [fontSize, setFontSize] = useState(() => readStorage(FONT_SIZE_KEY, '14'))
  const [cursorStyle, setCursorStyle] = useState<CursorStyleKey>(
    () => readStorage(CURSOR_STYLE_KEY, 'block') as CursorStyleKey
  )
  const shortcutActions = getShortcutActions()
  const mouseOnlyActions = APP_ACTIONS.filter((action) => action.mouseOnly)

  return (
    <div className="dialog-backdrop">
      <section
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <button
          className="settings-close icon-button"
          type="button"
          aria-label="Close settings"
          data-action-id="close-dialog"
          title={actionTitle('close-dialog')}
          onClick={onClose}
        >
          <XIcon size={16} />
        </button>
        <aside className="settings-nav" aria-label="Settings sections">
          <span className="settings-section">Desktop</span>
          <button
            className={`settings-tab ${section === 'general' ? 'active' : ''}`}
            type="button"
            data-action-id="show-general-settings"
            onClick={(): void => setSection('general')}
          >
            <GearIcon size={16} />
            General
          </button>
          <button
            className={`settings-tab ${section === 'shortcuts' ? 'active' : ''}`}
            type="button"
            data-action-id="show-shortcuts-settings"
            onClick={(): void => setSection('shortcuts')}
          >
            <KeyboardIcon size={16} />
            Shortcuts
          </button>
        </aside>
        <div className="settings-panel">
          <header className="dialog-header">
            <h2 id="settings-title">{section === 'general' ? 'General' : 'Shortcuts'}</h2>
          </header>
          <div className="settings-list">
            {section === 'general' ? (
              <>
                <div className="settings-row">
                  <div>
                    <strong>App theme</strong>
                    <span>Light, dark, or system</span>
                  </div>
                  <select
                    className="settings-select"
                    aria-label="App theme"
                    value={appTheme}
                    onChange={(e): void => {
                      const next = e.target.value as AppThemeKey
                      setAppTheme(next)
                      writeStorage(APP_THEME_KEY, next)
                      document.documentElement.setAttribute('data-theme', next)
                    }}
                  >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Terminal theme</strong>
                    <span>Color scheme for terminal panes (app mode: {terminalMode})</span>
                  </div>
                  <select
                    className="settings-select"
                    value={colorScheme}
                    aria-label="Terminal color scheme"
                    onChange={(e): void => {
                      const key = e.target.value as TerminalColorSchemeKey
                      setColorScheme(key)
                      saveTerminalColorSchemeKey(key)
                    }}
                  >
                    <option value="auto">Auto (follows app theme)</option>
                    {Object.entries(TERMINAL_COLOR_SCHEMES).map(([key, scheme]) => (
                      <option key={key} value={key}>
                        {scheme.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Font size</strong>
                    <span>{fontSize}px terminal text</span>
                  </div>
                  <select
                    className="settings-select"
                    aria-label="Font size"
                    value={fontSize}
                    onChange={(e): void => {
                      const next = e.target.value
                      setFontSize(next)
                      writeStorage(FONT_SIZE_KEY, next)
                    }}
                  >
                    <option value="12">12</option>
                    <option value="13">13</option>
                    <option value="14">14</option>
                    <option value="16">16</option>
                  </select>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Cursor</strong>
                    <span>{cursorStyle} cursor</span>
                  </div>
                  <select
                    className="settings-select"
                    aria-label="Cursor style"
                    value={cursorStyle}
                    onChange={(e): void => {
                      const next = e.target.value as CursorStyleKey
                      setCursorStyle(next)
                      writeStorage(CURSOR_STYLE_KEY, next)
                    }}
                  >
                    <option value="block">Block</option>
                    <option value="bar">Bar</option>
                    <option value="underline">Underline</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="settings-row shortcuts-row">
                  <div>
                    <strong>Keyboard shortcuts</strong>
                    <span>Registered app actions</span>
                  </div>
                  <div className="shortcut-list">
                    {shortcutActions.map((action) => (
                      <span key={action.id}>
                        {action.label}
                        <kbd>{formatShortcut(action.shortcut)}</kbd>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="settings-row shortcuts-row">
                  <div>
                    <strong>Pointer-only actions</strong>
                    <span>Documented exceptions</span>
                  </div>
                  <div className="shortcut-list">
                    {mouseOnlyActions.map((action) => (
                      <span key={action.id}>{action.label}</span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
