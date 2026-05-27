import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createSampleState } from '../../../common/state'
import { Dialogs } from './Dialogs'
import { Sidebar } from './Sidebar'
import { useAppStore } from '../store'
import type { AppActionId } from '../keymap'

const actionTitle = (id: AppActionId): string => id

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
    const input = container.querySelector('.project-dialog input') as HTMLInputElement
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

    const input = container.querySelector('.project-dialog input') as HTMLInputElement
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
