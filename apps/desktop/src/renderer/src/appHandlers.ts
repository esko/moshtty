import { useMemo } from 'react'
import type { AppActionHandlerMap } from './keymap'
import { useAppStore } from './store'

export interface AppHandlerCallbacks {
  openDialog: (dialog: import('./dialogs').AppDialog) => void
  closeDialog: () => void
  openCommandPalette: () => void
}

export function useAppHandlers({
  openDialog,
  closeDialog,
  openCommandPalette
}: AppHandlerCallbacks): AppActionHandlerMap {
  const toggleProjectRail = useAppStore((state) => state.toggleProjectRail)
  const addTab = useAppStore((state) => state.addTab)
  const saveWorkspace = useAppStore((state) => state.saveWorkspace)
  const resetWorkspace = useAppStore((state) => state.resetWorkspace)
  const splitPane = useAppStore((state) => state.splitPane)
  const closeActivePane = useAppStore((state) => state.closeActivePane)
  const closeActiveTab = useAppStore((state) => state.closeActiveTab)

  return useMemo<AppActionHandlerMap>(
    () => ({
      'toggle-project-rail': () => void toggleProjectRail(),
      'show-projects': () => undefined,
      'new-project': () => openDialog({ kind: 'project', mode: 'new' }),
      'import-remote': () => openDialog({ kind: 'import', mode: 'empty' }),
      'open-settings': () => openDialog({ kind: 'settings' }),
      'open-help': () => undefined,
      'new-tab': () => void addTab('Shell'),
      'save-state': () => void saveWorkspace(),
      'reset-state': () => void resetWorkspace(),
      'add-project': () => openDialog({ kind: 'project', mode: 'new' }),
      'close-dialog': closeDialog,
      'cancel-dialog': closeDialog,
      'confirm-dialog': () => undefined,
      'split-pane-right': () => void splitPane('row'),
      'split-pane-down': () => void splitPane('column'),
      'close-pane': () => void closeActivePane(),
      'close-tab': () => void closeActiveTab(),
      'open-command-palette': openCommandPalette
    }),
    [
      addTab,
      closeDialog,
      closeActivePane,
      closeActiveTab,
      openCommandPalette,
      openDialog,
      resetWorkspace,
      saveWorkspace,
      splitPane,
      toggleProjectRail
    ]
  )
}
