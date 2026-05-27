import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { MoshttyPane } from '../../../common/state'
import { TerminalPane } from './TerminalPane'
import { useAppStore } from '../store'

const fitMock = vi.fn()
const observeResizeMock = vi.fn()

vi.mock('ghostty-web', () => ({
  init: vi.fn().mockResolvedValue(undefined),
  Terminal: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    dispose: vi.fn(),
    loadAddon: vi.fn(),
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    onResize: vi.fn(() => ({ dispose: vi.fn() })),
    write: vi.fn()
  })),
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: fitMock,
    observeResize: observeResizeMock,
    dispose: vi.fn()
  }))
}))

function samplePane(overrides: Partial<MoshttyPane> = {}): MoshttyPane {
  return {
    id: 'pane-test',
    title: 'Shell',
    cwd: '~',
    status: 'active',
    cols: 80,
    rows: 24,
    ...overrides
  }
}

describe('TerminalPane info pill status roundel', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    fitMock.mockClear()
    observeResizeMock.mockClear()
    useAppStore.setState({
      setPaneFlow: vi.fn(),
      bindPaneFlow: vi.fn().mockResolvedValue(undefined),
      markPaneLost: vi.fn().mockResolvedValue(undefined),
      restartLostPane: vi.fn().mockResolvedValue(undefined),
      paneFlows: {}
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

  function renderPane(pane: MoshttyPane): void {
    act(() => {
      root.render(
        <TerminalPane
          pane={pane}
          active
          terminalMode="dark"
          transport={null}
          connectionManager={null}
        />
      )
    })
  }

  function statusDot(): HTMLElement | null {
    return container.querySelector('.pane-status-dot')
  }

  function infoPill(): HTMLElement | null {
    return container.querySelector('.pane-pill-info')
  }

  it('renders a single status dot without title text', () => {
    renderPane(samplePane())

    const pill = infoPill()
    expect(pill?.querySelectorAll('.pane-status-dot')).toHaveLength(1)
    expect(pill?.querySelector('.pane-pill-title')).toBeNull()
    expect(pill?.textContent?.trim()).toBe('')
  })

  it('shows lost when pane status is lost', () => {
    renderPane(samplePane({ status: 'lost' }))

    expect(statusDot()?.getAttribute('data-status')).toBe('lost')
    expect(statusDot()?.getAttribute('aria-label')).toBe('Pane lost')
  })

  it('shows connecting before the terminal is ready', () => {
    renderPane(samplePane())

    expect(statusDot()?.getAttribute('data-status')).toBe('connecting')
    expect(statusDot()?.getAttribute('aria-label')).toBe('Pane connecting')
  })

  it('shows connected after bootstrap sets ready', async () => {
    renderPane(samplePane())

    await act(async () => {
      await Promise.resolve()
    })

    expect(statusDot()?.getAttribute('data-status')).toBe('connected')
    expect(statusDot()?.getAttribute('aria-label')).toBe('Pane active')
    expect(fitMock).toHaveBeenCalled()
    expect(observeResizeMock).toHaveBeenCalled()
  })
})
