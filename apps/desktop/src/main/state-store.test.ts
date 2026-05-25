import { mkdtemp, readFile, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, test } from 'vitest'
import { createMoshttyStateStore } from './state-store'
import { createEmptyState } from '../common/state'

describe('createMoshttyStateStore', () => {
  test('loads default state when the file does not exist', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'moshtty-state-'))
    const store = createMoshttyStateStore(userDataPath)

    const result = await store.loadState()

    expect(result.source).toBe('default')
    expect(result.state.version).toBe(1)
  })

  test('saves and reloads normalized state atomically', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'moshtty-state-'))
    const store = createMoshttyStateStore(userDataPath)
    const nextState = createEmptyState('2026-05-25T00:00:00.000Z')

    await store.saveState(nextState)

    const saved = await readFile(store.stateFilePath(), 'utf8')
    expect(saved).toContain('"version": 1')

    const result = await store.loadState()
    expect(result.source).toBe('disk')
    expect(result.state.updatedAt).toBe('2026-05-25T00:00:00.000Z')
  })

  test('recovers from corrupt JSON safely', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'moshtty-state-'))
    const store = createMoshttyStateStore(userDataPath)
    await writeFile(store.stateFilePath(), '{not-json', 'utf8')

    const result = await store.loadState()

    expect(result.source).toBe('recovered')
    expect(result.warning).toBeTruthy()
    expect(result.state.projects).toEqual([])
  })

  test('migrates legacy state without version and persists layouts', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'moshtty-state-'))
    const store = createMoshttyStateStore(userDataPath)
    await writeFile(
      store.stateFilePath(),
      `${JSON.stringify(
        {
          projects: [
            {
              id: 'project-1',
              name: 'Legacy',
              color: '#000',
              tabIds: ['tab-1'],
              activeTabId: 'tab-1'
            }
          ],
          tabs: [{ id: 'tab-1', title: 'Shell', paneIds: ['pane-1'], activePaneId: 'pane-1' }],
          panes: [{ id: 'pane-1', title: 'Pane', cwd: '~', status: 'active', cols: 80, rows: 24 }]
        },
        null,
        2
      )}\n`,
      'utf8'
    )

    const result = await store.loadState()

    expect(result.source).toBe('migrated')
    expect(result.migratedFrom).toBe(0)
    expect(result.state.layouts).toEqual([
      {
        tabId: 'tab-1',
        root: {
          kind: 'pane',
          paneId: 'pane-1'
        }
      }
    ])

    const reloaded = await store.loadState()
    expect(reloaded.source).toBe('disk')
    expect(reloaded.state.layouts).toHaveLength(1)
  })
})
