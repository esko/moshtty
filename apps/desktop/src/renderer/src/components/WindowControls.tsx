import React, { useEffect, useState } from 'react'
import './WindowControls.css'

export const WindowControls: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    // Initial fetch of maximized state
    window.moshtty.window.isMaximized().then(setIsMaximized).catch(console.error)

    // Subscribe to updates
    const unsubscribe = window.moshtty.window.onStateChange((maximized) => {
      setIsMaximized(maximized)
    })

    return unsubscribe
  }, [])

  const handleMinimize = (): void => {
    window.moshtty.window.minimize().catch(console.error)
  }

  const handleMaximize = (): void => {
    window.moshtty.window.maximize().catch(console.error)
  }

  const handleClose = (): void => {
    window.moshtty.window.close().catch(console.error)
  }

  return (
    <div className="window-controls" data-testid="window-controls">
      <button
        className="control-btn minimize"
        onClick={handleMinimize}
        title="Minimize"
        aria-label="Minimize window"
      >
        <svg width="10" height="1" viewBox="0 0 10 1" fill="none">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>
      <button
        className="control-btn maximize"
        onClick={handleMaximize}
        title={isMaximized ? 'Restore' : 'Maximize'}
        aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
      >
        {isMaximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M3,1 L9,1 L9,7 M1,3 L7,3 L7,9 L1,9 Z"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect
              x="1"
              y="1"
              width="8"
              height="8"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
          </svg>
        )}
      </button>
      <button
        className="control-btn close"
        onClick={handleClose}
        title="Close"
        aria-label="Close window"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1,1 L9,9 M9,1 L1,9" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
    </div>
  )
}
