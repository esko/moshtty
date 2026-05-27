import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createSampleState } from '../../../common/state'
import { Sidebar } from './Sidebar'
import { useAppStore } from '../store'
import type { AppActionId } from '../keymap'

const actionTitle = (id: AppActionId): string => id

describe('Sidebar', () => {
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

  it('does not render bootstrap or import header buttons', () => {
    act(() => {
      root.render(<Sidebar state={sampleState} openDialog={openDialog} actionTitle={actionTitle} />)
    })

    expect(container.querySelector('[aria-label="Bootstrap remote"]')).toBeNull()
    expect(container.querySelector('[aria-label="Import remote"]')).toBeNull()
    expect(container.querySelector('[aria-label="New project"]')).not.toBeNull()
  })

  it('keeps edit and delete actions inside the project row', () => {
    act(() => {
      root.render(<Sidebar state={sampleState} openDialog={openDialog} actionTitle={actionTitle} />)
    })

    const row = container.querySelector('.project-item-row')
    expect(row).not.toBeNull()

    const editBtn = row?.querySelector('.project-edit') as HTMLButtonElement
    const deleteBtn = row?.querySelector('.project-delete') as HTMLButtonElement
    expect(editBtn).not.toBeNull()
    expect(deleteBtn).not.toBeNull()

    act(() => {
      editBtn.click()
    })

    expect(openDialog).toHaveBeenCalledWith({
      kind: 'project',
      mode: 'existing',
      projectId: 'project-welcome'
    })
  })
})
