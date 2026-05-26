import React, { useState } from 'react'
import { useAppStore } from '../store'
import { XIcon, GearIcon, KeyboardIcon } from '../design/icons'
import { parseMoshttyProfileText } from '../../../common/profile.schema'
import { getShortcutActions, APP_ACTIONS, formatShortcut } from '../keymap'
import type { AppDialog } from '../dialogs'
import './Dialogs.css'

interface DialogsProps {
  state: import('../../../common/state').MoshttyState | null
  secretMode: string | null
  visibleDialog: AppDialog | null
  closeDialog: () => void
  actionTitle: (actionId: import('../keymap').AppActionId) => string
  terminalMode: string
}

export const Dialogs: React.FC<DialogsProps> = ({
  state,
  secretMode,
  visibleDialog,
  closeDialog,
  actionTitle,
  terminalMode
}) => {
  const addProject = useAppStore((state) => state.addProject)
  const importRemoteProfile = useAppStore((state) => state.importRemoteProfile)

  const activeProjectId = state?.activeProjectId
  const activeProject = state?.projects.find((p) => p.id === activeProjectId)

  if (!visibleDialog) {
    return null
  }

  const saveProjectDialog = (name: string): void => {
    if (visibleDialog.kind === 'project' && visibleDialog.mode === 'new') {
      addProject(name).catch(console.error)
    }
    closeDialog()
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
    closeDialog()
    return true
  }

  switch (visibleDialog.kind) {
    case 'import':
      return (
        <ImportDialog
          mode={visibleDialog.mode}
          secretMode={secretMode}
          onClose={closeDialog}
          onImport={importProfileDialog}
          actionTitle={actionTitle}
        />
      )
    case 'project':
      return (
        <ProjectDialog
          mode={visibleDialog.mode}
          projectName={activeProject?.name ?? 'Moshtty'}
          onClose={closeDialog}
          onSave={saveProjectDialog}
          actionTitle={actionTitle}
        />
      )
    case 'settings':
      return (
        <SettingsDialog
          terminalMode={terminalMode}
          onClose={closeDialog}
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
interface ProjectDialogProps {
  mode: 'new' | 'existing'
  projectName: string
  onClose: () => void
  onSave: (name: string) => void
  actionTitle: (actionId: import('../keymap').AppActionId) => string
}

const ProjectDialog: React.FC<ProjectDialogProps> = ({
  mode,
  projectName,
  onClose,
  onSave,
  actionTitle
}) => {
  const [name, setName] = useState(mode === 'new' ? '' : projectName)

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
        <label className="field">
          <span>Name</span>
          <input
            value={name}
            placeholder="Remote dev"
            onChange={(event): void => setName(event.target.value)}
          />
        </label>
        <div className="project-chip-editor">
          <div className="large-chip">{(projectName || '').charAt(0).toUpperCase() || 'M'}</div>
          <div>
            <span className="field-label">Project color</span>
            <div className="swatch-row" aria-label="Project color choices">
              <button
                className="swatch active"
                type="button"
                aria-label="Use accent color"
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
            onClick={(): void => onSave(name)}
          >
            Save
          </button>
        </footer>
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
    secretMode === 'passphrase' &&
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

const SettingsDialog: React.FC<SettingsDialogProps> = ({ terminalMode, onClose, actionTitle }) => {
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
        <aside className="settings-nav" aria-label="Settings sections">
          <span className="settings-section">Desktop</span>
          <button
            className="settings-tab active"
            type="button"
            data-action-id="show-general-settings"
          >
            <GearIcon size={16} />
            General
          </button>
          <button className="settings-tab" type="button" data-action-id="show-shortcuts-settings">
            <KeyboardIcon size={16} />
            Shortcuts
          </button>
        </aside>
        <div className="settings-panel">
          <header className="dialog-header">
            <h2 id="settings-title">Terminal settings</h2>
            <button
              className="icon-button"
              type="button"
              aria-label="Close settings"
              data-action-id="close-dialog"
              title={actionTitle('close-dialog')}
              onClick={onClose}
            >
              <XIcon size={16} />
            </button>
          </header>
          <div className="settings-list">
            <div className="settings-row">
              <div>
                <strong>App theme</strong>
                <span>Light, dark, or system</span>
              </div>
              <span>System</span>
            </div>
            <div className="settings-row">
              <div>
                <strong>Terminal palette</strong>
                <span>Current mode: {terminalMode}</span>
              </div>
              <span>Follow app</span>
            </div>
            <div className="settings-row">
              <div>
                <strong>Font size</strong>
                <span>Compact terminal density</span>
              </div>
              <span>14</span>
            </div>
            <div className="settings-row">
              <div>
                <strong>Cursor</strong>
                <span>Block cursor</span>
              </div>
              <span>Block</span>
            </div>
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
          </div>
        </div>
      </section>
    </div>
  )
}
