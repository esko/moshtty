import { useEffect, useRef, useState } from 'react'
import { Terminal, type ITerminalOptions } from 'ghostty-web'
import type { MoshttyPane } from '../../../common/state'

interface TerminalPaneProps {
  pane: MoshttyPane
  active: boolean
  terminalMode: 'light' | 'dark'
}

const WASM_PATH = '/ghostty-vt.wasm'

export function TerminalPane({ pane, active, terminalMode }: TerminalPaneProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    }
  }, [pane.cols, pane.rows, terminalMode])

  return (
    <section
      className={`terminal-pane ${active ? 'active' : ''} ${lost ? 'lost' : ''}`}
      data-terminal-theme={terminalMode}
      aria-label={`${title} pane`}
    >
      <header className="pane-header">
        <span className="pane-title">{title}</span>
        <span className={`pane-status ${lost ? 'lost' : 'active'}`}>
          {lost ? 'Pane lost' : 'Active'}
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
