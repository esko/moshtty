import { useEffect, useRef, useState } from 'react'
import {
  APP_ACTIONS,
  canInvokePaletteAction,
  filterPaletteActions,
  formatShortcut,
  type AppActionHandlerMap
} from '../keymap'
import './CommandPalette.css'

interface CommandPaletteProps {
  open: boolean
  handlers: AppActionHandlerMap
  onClose: () => void
}

export function CommandPalette({
  open,
  handlers,
  onClose
}: CommandPaletteProps): React.JSX.Element | null {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const previousFocus = useRef<Element | null>(null)

  const visibleActions = filterPaletteActions(APP_ACTIONS, query)

  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement
      requestAnimationFrame(() => inputRef.current?.focus())
    } else if (previousFocus.current instanceof HTMLElement) {
      previousFocus.current.focus()
    }
  }, [open])

  if (!open) {
    return null
  }

  function invoke(index: number): void {
    const action = visibleActions[index]
    if (!canInvokePaletteAction(action)) {
      return
    }
    handlers[action.id]?.()
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, visibleActions.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      invoke(activeIndex)
    }
  }

  function handleQueryChange(value: string): void {
    setQuery(value)
    setActiveIndex(0)
  }

  return (
    <div className="palette-root">
      <button
        type="button"
        className="palette-backdrop"
        onClick={onClose}
        aria-label="Close command palette"
      />
      <div className="palette-panel" role="dialog" aria-label="Command palette" aria-modal="true">
        <input
          ref={inputRef}
          className="palette-input"
          type="text"
          placeholder="Type a command..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Search commands"
          aria-autocomplete="list"
          aria-controls="palette-listbox"
          aria-activedescendant={`palette-option-${activeIndex}`}
        />
        <div className="palette-section-label">Commands</div>
        <ul id="palette-listbox" role="listbox" className="palette-list" aria-label="Commands">
          {visibleActions.map((action, i) => (
            <li
              key={action.id}
              id={`palette-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={[
                'palette-item',
                i === activeIndex ? 'palette-item--active' : '',
                action.mouseOnly ? 'palette-item--disabled' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              title={action.mouseOnly ? action.mouseOnlyReason : undefined}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => invoke(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  invoke(i)
                }
              }}
            >
              <span className="palette-item-label">{action.label}</span>
              {action.shortcut ? (
                <kbd className="palette-item-shortcut">{formatShortcut(action.shortcut)}</kbd>
              ) : null}
            </li>
          ))}
          {visibleActions.length === 0 ? (
            <li className="palette-empty">No commands match &ldquo;{query}&rdquo;</li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}
