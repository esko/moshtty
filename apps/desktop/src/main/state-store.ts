import { mkdir, readFile, rename, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import type { MoshttyState, StateLoadResult } from '../common/state'
import { createEmptyState, migrateState } from '../common/state'

export interface MoshttyStateStore {
  loadState(): Promise<StateLoadResult>
  saveState(nextState: MoshttyState): Promise<StateLoadResult>
  resetState(): Promise<StateLoadResult>
  stateFilePath(): string
}

function atomicTempPath(filePath: string): string {
  return `${filePath}.tmp-${process.pid}-${Date.now()}`
}

async function writeAtomic(filePath: string, contents: string): Promise<void> {
  const tempPath = atomicTempPath(filePath)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(tempPath, contents, 'utf8')
  await rename(tempPath, filePath)
}

export function createMoshttyStateStore(userDataPath: string | (() => string)): MoshttyStateStore {
  const resolveUserDataPath = (): string =>
    typeof userDataPath === 'function' ? userDataPath() : userDataPath

  const filePath = () => join(resolveUserDataPath(), 'moshtty-state.json')

  return {
    stateFilePath: () => filePath(),
    async loadState(): Promise<StateLoadResult> {
      try {
        const fileContents = await readFile(filePath(), 'utf8')
        const parsed = JSON.parse(fileContents) as unknown
        const migration = migrateState(parsed)
        if (migration.migratedFrom !== undefined) {
          await writeAtomic(filePath(), `${JSON.stringify(migration.state, null, 2)}\n`)
          return {
            state: migration.state,
            source: 'migrated',
            migratedFrom: migration.migratedFrom,
            warning: migration.warning
          }
        }

        if (migration.warning) {
          return {
            state: migration.state,
            source: 'recovered',
            warning: migration.warning
          }
        }

        return {
          state: migration.state,
          source: 'disk'
        }
      } catch (error) {
        if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
          return {
            state: createEmptyState(),
            source: 'default'
          }
        }

        return {
          state: createEmptyState(),
          source: 'recovered',
          warning: error instanceof Error ? error.message : 'Unable to load Moshtty state'
        }
      }
    },
    async saveState(nextState: MoshttyState): Promise<StateLoadResult> {
      const migration = migrateState(nextState)
      await writeAtomic(filePath(), `${JSON.stringify(migration.state, null, 2)}\n`)
      return {
        state: migration.state,
        source: 'disk',
        warning: migration.warning
      }
    },
    async resetState(): Promise<StateLoadResult> {
      const state = createEmptyState()
      await writeAtomic(filePath(), `${JSON.stringify(state, null, 2)}\n`)
      return {
        state,
        source: 'default'
      }
    }
  }
}
