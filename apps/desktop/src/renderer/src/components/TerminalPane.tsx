import { useEffect, useRef, useState } from 'react'
import { Terminal, type ITerminalOptions } from 'ghostty-web'
import type { MoshttyPane, SplitAxis } from '../../../common/state'
import { XIcon } from '../design/icons'
import type { MoshttyTransport } from '../transport/moshtty-transport'
import type { MoshConnectionManager } from '../mosh-connection-manager'
import { MoshClient } from '../mosh-client-wrapper'
import { useAppStore } from '../store'

interface TerminalPaneProps {
  pane: MoshttyPane
  active: boolean
  terminalMode: 'light' | 'dark'
  onSplit?: (axis: SplitAxis) => void
  onClose?: () => void
  transport?: MoshttyTransport | null
  connectionManager?: MoshConnectionManager | null
}

const WASM_PATH = '/ghostty-vt.wasm'

export function TerminalPane({
  pane,
  active,
  terminalMode,
  onSplit,
  onClose,
  transport,
  connectionManager
}: TerminalPaneProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setPaneFlow = useAppStore((state) => state.setPaneFlow)
  const disposablesRef = useRef<{ dispose: () => void }[]>([])
  const lost = pane.status === 'lost'
  const title = pane.title ?? 'Terminal'
  const cwd = pane.cwd ?? '~'

  useEffect(() => {
    let disposed = false

    async function bootstrap(): Promise<void> {
      try {
        const { init } = await import('ghostty-web')
        await init(WASM_PATH)

        if (disposed) return

        const cols = pane.cols || 120
        const rows = pane.rows || 32

        const theme =
          terminalMode === 'dark'
            ? {
                background: '#121214',
                foreground: '#e2e2e8',
                cursor: '#a5b4fc',
                selectionBackground: '#2a2a30'
              }
            : {
                background: '#1e1e24',
                foreground: '#f0f0f4',
                cursor: '#4f46e5',
                selectionBackground: '#2e2e34'
              }

        const options: ITerminalOptions = {
          cols,
          rows,
          theme,
          cursorBlink: true,
          cursorStyle: 'block',
          fontSize: 14,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          convertEol: true
        }

        const term = new Terminal(options)
        if (disposed) {
          term.dispose()
          return
        }

        termRef.current = term

        if (containerRef.current) {
          term.open(containerRef.current)
          setReady(true)
        }

        if (transport && connectionManager && !disposed) {
          let flow = useAppStore.getState().paneFlows[pane.id]
          if (!flow) {
            const info = await transport.createPane({ cols, rows, shell: '/bin/sh' })
            if (disposed) return
            setPaneFlow(pane.id, info.flowId, info.key)
            flow = { flowId: info.flowId, key: info.key }
          }

          const moshClient = new MoshClient()
          await moshClient.dial(
            flow.key,
            (packet) => {
              void transport.sendPaneDatagram(flow.flowId, packet)
            },
            (data) => {
              if (!disposed) {
                term.write(data)
              }
            }
          )

          if (disposed) {
            moshClient.close()
            return
          }

          connectionManager.register(flow.flowId, (payload) => {
            moshClient.receive(payload)
          })

          const onDataDisposable = term.onData((data) => {
            const bytes = new TextEncoder().encode(data)
            moshClient.send(bytes)
          })

          const onResizeDisposable = term.onResize(({ cols, rows }) => {
            moshClient.resize(cols, rows)
            void transport.call('pane.resize', { flowId: flow.flowId, cols, rows })
          })

          disposablesRef.current = [
            { dispose: () => connectionManager.unregister(flow!.flowId) },
            onDataDisposable,
            onResizeDisposable,
            { dispose: () => moshClient.close() }
          ]
        }
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : 'Failed to load terminal')
        }
      }
    }

    bootstrap()

    return () => {
      disposed = true
      if (termRef.current) {
        termRef.current.dispose()
        termRef.current = null
      }
      disposablesRef.current.forEach((d) => d.dispose())
      disposablesRef.current = []
    }
  }, [connectionManager, pane.cols, pane.id, pane.rows, setPaneFlow, terminalMode, transport])

  return (
    <section
      className={`terminal-pane ${active ? 'active' : ''} ${lost ? 'lost' : ''}`}
      data-terminal-theme={terminalMode}
      aria-label={`${title} pane`}
    >
      <header className="pane-header">
        <span className="pane-title">{title}</span>
        <span className="pane-actions">
          <span className={`pane-status ${lost ? 'lost' : 'active'}`}>
            {lost ? 'Pane lost' : 'Active'}
          </span>
          {onSplit ? (
            <>
              <button
                className="icon-button"
                type="button"
                aria-label="Split pane right"
                data-action-id="split-pane-right"
                title="Split right (Ctrl+Shift+→)"
                onClick={() => onSplit('row')}
              >
                <SVGSplitRight />
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label="Split pane down"
                data-action-id="split-pane-down"
                title="Split down (Ctrl+Shift+↓)"
                onClick={() => onSplit('column')}
              >
                <SVGSplitDown />
              </button>
            </>
          ) : null}
          {onClose ? (
            <button
              className="icon-button"
              type="button"
              aria-label="Close pane"
              data-action-id="close-pane"
              title="Close pane (Ctrl+Shift+W)"
              onClick={onClose}
            >
              <XIcon />
            </button>
          ) : null}
        </span>
      </header>
      <div className="terminal-container" ref={containerRef}>
        {error ? (
          <pre className="terminal-error">{`$ cd ${cwd}\n$ Error: ${error}`}</pre>
        ) : !ready ? (
          <pre className="terminal-placeholder">{`$ cd ${cwd}\n$ Loading terminal...`}</pre>
        ) : null}
      </div>
    </section>
  )
}

function SVGSplitRight(): React.JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="3" y1="12" x2="12" y2="12" />
    </svg>
  )
}

function SVGSplitDown(): React.JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="12" y1="3" x2="12" y2="12" />
    </svg>
  )
}
