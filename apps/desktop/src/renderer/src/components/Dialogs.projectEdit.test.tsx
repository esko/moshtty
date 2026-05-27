import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createSampleState } from '../../../common/state'
import { Dialogs } from './Dialogs'
import { Sidebar } from './Sidebar'
import { useAppStore } from '../store'
import type { AppActionId } from '../keymap'

const actionTitle = (id: AppActionId): string => id

function renderDialogs(
  root: Root,
  options: {
    visibleDialog: import('../dialogs').AppDialog
    liveStatus?: import('../../../common/state').MoshttyRemote['status'] | null
    openDialog?: ReturnType<typeof vi.fn>
    closeDialog?: ReturnType<typeof vi.fn>
  }
): void {
  const { visibleDialog, liveStatus = null, openDialog, closeDialog = vi.fn() } = options
  act(() => {
    root.render(
      <Dialogs
        state={createSampleState()}
        secretMode={null}
        visibleDialog={visibleDialog}
        closeDialog={closeDialog}
        openDialog={openDialog}
        liveStatus={liveStatus}
        actionTitle={actionTitle}
        terminalMode="light"
      />
    )
  })
}

describe('Project preferences dialog', () => {
  let container: HTMLDivElement
  let root: Root
  const openDialog = vi.fn()
  const closeDialog = vi.fn()

  beforeEach(() => {
    openDialog.mockClear()
    closeDialog.mockClear()
    useAppStore.setState({
      renameProject: vi.fn(),
      addProject: vi.fn().mockResolvedValue(undefined)
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('renders all three sections in new mode with Not configured and Install', () => {
    renderDialogs(root, {
      visibleDialog: { kind: 'project', mode: 'new' },
      openDialog
    })

    expect(container.querySelectorAll('.project-section')).toHaveLength(3)
    expect(container.textContent).toContain('Remote server')
    expect(container.textContent).toContain('Profile import')
    const pill = container.querySelector('.project-status-pill')
    expect(pill?.getAttribute('data-status')).toBe('lost')
    expect(pill?.textContent).toContain('Not configured')
    expect(container.querySelector('[data-action-id="open-bootstrap-dialog"]')?.textContent).toBe(
      'Install'
    )
  })

  it('reflects liveStatus in existing mode and shows Update', () => {
    renderDialogs(root, {
      visibleDialog: {
        kind: 'project',
        mode: 'existing',
        projectId: 'project-welcome'
      },
      liveStatus: 'connected',
      openDialog
    })

    const input = container.querySelector('.project-dialog input') as HTMLInputElement
    expect(input.value).toBe('Welcome')
    const pill = container.querySelector('.project-status-pill')
    expect(pill?.getAttribute('data-status')).toBe('connected')
    expect(pill?.textContent).toContain('Connected')
    expect(container.querySelector('[data-action-id="open-bootstrap-dialog"]')?.textContent).toBe(
      'Update'
    )
  })

  it('shows Connecting… when liveStatus is connecting', () => {
    renderDialogs(root, {
      visibleDialog: {
        kind: 'project',
        mode: 'existing',
        projectId: 'project-welcome'
      },
      liveStatus: 'connecting',
      openDialog
    })

    const pill = container.querySelector('.project-status-pill')
    expect(pill?.getAttribute('data-status')).toBe('connecting')
    expect(pill?.textContent).toContain('Connecting…')
  })

  it('shows Offline when liveStatus is offline', () => {
    renderDialogs(root, {
      visibleDialog: {
        kind: 'project',
        mode: 'existing',
        projectId: 'project-welcome'
      },
      liveStatus: 'offline',
      openDialog
    })

    const pill = container.querySelector('.project-status-pill')
    expect(pill?.getAttribute('data-status')).toBe('lost')
    expect(pill?.textContent).toContain('Offline')
  })

  it('opens bootstrap dialog when Install/Update is clicked', () => {
    renderDialogs(root, {
      visibleDialog: { kind: 'project', mode: 'new' },
      openDialog
    })

    const bootstrapBtn = container.querySelector(
      '[data-action-id="open-bootstrap-dialog"]'
    ) as HTMLButtonElement
    act(() => {
      bootstrapBtn.click()
    })

    expect(openDialog).toHaveBeenCalledWith({ kind: 'bootstrap' })
  })

  it('opens import dialog when Import from profile is clicked', () => {
    renderDialogs(root, {
      visibleDialog: { kind: 'project', mode: 'new' },
      openDialog
    })

    const importBtn = container.querySelector(
      '[data-action-id="open-import-dialog"]'
    ) as HTMLButtonElement
    act(() => {
      importBtn.click()
    })

    expect(openDialog).toHaveBeenCalledWith({ kind: 'import', mode: 'empty' })
  })
})

describe('Project edit dialog', () => {
  let container: HTMLDivElement
  let root: Root
  const sampleState = createSampleState()
  const renameProject = vi.fn().mockResolvedValue(undefined)
  const closeDialog = vi.fn()

  beforeEach(() => {
    renameProject.mockClear()
    closeDialog.mockClear()
    useAppStore.setState({ renameProject, addProject: vi.fn().mockResolvedValue(undefined) })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('prefills the name input when editing an existing project', () => {
    act(() => {
      root.render(
        <Dialogs
          state={sampleState}
          secretMode={null}
          visibleDialog={{
            kind: 'project',
            mode: 'existing',
            projectId: 'project-welcome'
          }}
          closeDialog={closeDialog}
          actionTitle={actionTitle}
          terminalMode="light"
        />
      )
    })

    expect(container.querySelector('#project-dialog-title')?.textContent).toBe('Edit project')
    const input = container.querySelector(
      '.project-dialog input[aria-label="Project name"]'
    ) as HTMLInputElement
    expect(input.value).toBe('Welcome')
  })

  it('calls renameProject on save for an existing project', () => {
    act(() => {
      root.render(
        <Dialogs
          state={sampleState}
          secretMode={null}
          visibleDialog={{
            kind: 'project',
            mode: 'existing',
            projectId: 'project-welcome'
          }}
          closeDialog={closeDialog}
          actionTitle={actionTitle}
          terminalMode="light"
        />
      )
    })

    const input = container.querySelector(
      '.project-dialog input[aria-label="Project name"]'
    ) as HTMLInputElement
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setValue?.call(input, 'Renamed project')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const saveBtn = container.querySelector(
      '[data-action-id="confirm-dialog"]'
    ) as HTMLButtonElement
    act(() => {
      saveBtn.click()
    })

    expect(renameProject).toHaveBeenCalledWith('project-welcome', 'Renamed project')
    expect(closeDialog).toHaveBeenCalled()
  })
})

describe('Sidebar project edit entry', () => {
  let container: HTMLDivElement
  let root: Root
  const sampleState = createSampleState()
  const openDialog = vi.fn()

  beforeEach(() => {
    openDialog.mockClear()
    useAppStore.setState({
      setActiveProject: vi.fn().mockResolvedValue(undefined),
      deleteProject: vi.fn().mockResolvedValue(undefined)
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('opens the edit dialog when the pencil button is clicked', () => {
    act(() => {
      root.render(<Sidebar state={sampleState} openDialog={openDialog} actionTitle={actionTitle} />)
    })

    const pencil = container.querySelector('[aria-label="Rename Welcome"]') as HTMLButtonElement
    act(() => {
      pencil.click()
    })

    expect(openDialog).toHaveBeenCalledWith({
      kind: 'project',
      mode: 'existing',
      projectId: 'project-welcome'
    })
  })
})
