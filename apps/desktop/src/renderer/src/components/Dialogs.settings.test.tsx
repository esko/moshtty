import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Dialogs } from './Dialogs'
import type { AppActionId } from '../keymap'

const actionTitle = (id: AppActionId): string => id

describe('SettingsDialog', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    localStorage.clear()
  })

  const renderSettings = (): void => {
    act(() => {
      root.render(
        <Dialogs
          state={null}
          secretMode={null}
          visibleDialog={{ kind: 'settings' }}
          closeDialog={(): void => undefined}
          openDialog={(): void => undefined}
          actionTitle={actionTitle}
          terminalMode="light"
        />
      )
    })
  }

  it('shows General title and App theme select on the general section', () => {
    renderSettings()

    expect(container.querySelector('#settings-title')?.textContent).toBe('General')
    expect(container.querySelector('select[aria-label="App theme"]')).not.toBeNull()
  })

  it('updates the title to Shortcuts when the shortcuts nav is selected', () => {
    renderSettings()

    const shortcutsTab = container.querySelector(
      '[data-action-id="show-shortcuts-settings"]'
    ) as HTMLButtonElement

    act(() => {
      shortcutsTab.click()
    })

    expect(container.querySelector('#settings-title')?.textContent).toBe('Shortcuts')
    expect(container.querySelector('select[aria-label="App theme"]')).toBeNull()
  })

  it('persists App theme changes to localStorage', () => {
    renderSettings()

    const select = container.querySelector('select[aria-label="App theme"]') as HTMLSelectElement

    act(() => {
      select.value = 'dark'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(localStorage.getItem('moshtty:appTheme')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
