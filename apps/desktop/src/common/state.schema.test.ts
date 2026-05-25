import { describe, expect, test } from 'vitest'
import { createEmptyState, createSampleState, migrateState, normalizeState } from './state'
import { MoshttyStateSchema, parseMoshttyState, safeParseMoshttyState } from './state.schema'

describe('MoshttyStateSchema', () => {
  test('accepts the empty state produced by createEmptyState', () => {
    const state = createEmptyState('2026-05-25T00:00:00.000Z')
    expect(() => parseMoshttyState(state)).not.toThrow()
  })

  test('accepts the seeded sample state used by the renderer', () => {
    const state = createSampleState('2026-05-25T00:00:00.000Z')
    const parsed = parseMoshttyState(state)
    expect(parsed.projects[0].id).toBe('project-welcome')
  })

  test('accepts the output of normalizeState even from malformed input', () => {
    const state = normalizeState(
      { version: 1, projects: [{ id: 'p1', name: 'Project One' }] },
      '2026-05-25T00:00:00.000Z'
    )
    const parsed = parseMoshttyState(state)
    expect(parsed.projects).toHaveLength(1)
    expect(parsed.remotes).toEqual([])
  })

  test('accepts migrated legacy payloads', () => {
    const result = migrateState(
      {
        projects: [{ id: 'p1', name: 'Legacy', color: '#000', tabIds: ['t1'], activeTabId: 't1' }],
        tabs: [{ id: 't1', title: 'Shell', paneIds: ['pane-1'], activePaneId: 'pane-1' }],
        panes: [{ id: 'pane-1', title: 'Pane', cwd: '~', status: 'active', cols: 80, rows: 24 }]
      },
      '2026-05-25T00:00:00.000Z'
    )
    expect(() => parseMoshttyState(result.state)).not.toThrow()
  })

  test('rejects payloads with the wrong schema version', () => {
    const state = { ...createEmptyState('2026-05-25T00:00:00.000Z'), version: 2 }
    const result = safeParseMoshttyState(state)
    expect(result.ok).toBe(false)
  })

  test('rejects projects with malformed color values', () => {
    const state = createSampleState('2026-05-25T00:00:00.000Z')
    const corrupted = {
      ...state,
      projects: state.projects.map((project) => ({ ...project, color: 'indigo' }))
    }
    const result = safeParseMoshttyState(corrupted)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.issues[0].path).toEqual(['projects', 0, 'color'])
    }
  })

  test('rejects panes with non-positive cols/rows', () => {
    const state = createSampleState('2026-05-25T00:00:00.000Z')
    const corrupted = {
      ...state,
      panes: state.panes.map((pane) => ({ ...pane, cols: 0 }))
    }
    expect(MoshttyStateSchema.safeParse(corrupted).success).toBe(false)
  })

  test('accepts persisted remote pane flow IDs', () => {
    const state = createSampleState('2026-05-25T00:00:00.000Z')
    const parsed = parseMoshttyState({
      ...state,
      panes: state.panes.map((pane) => ({ ...pane, remoteFlowId: 7 }))
    })

    expect(parsed.panes[0]?.remoteFlowId).toBe(7)
  })

  test('rejects invalid remote pane flow IDs', () => {
    const state = createSampleState('2026-05-25T00:00:00.000Z')
    const corrupted = {
      ...state,
      panes: state.panes.map((pane) => ({ ...pane, remoteFlowId: 0 }))
    }

    expect(MoshttyStateSchema.safeParse(corrupted).success).toBe(false)
  })

  test('accepts nested split layouts within the ratio bounds', () => {
    const state = createSampleState('2026-05-25T00:00:00.000Z')
    const layouts = [
      {
        tabId: 'tab-welcome',
        root: {
          kind: 'split' as const,
          axis: 'row' as const,
          ratio: 0.5,
          first: { kind: 'pane' as const, paneId: 'pane-welcome' },
          second: {
            kind: 'split' as const,
            axis: 'column' as const,
            ratio: 0.5,
            first: { kind: 'pane' as const, paneId: 'pane-welcome' },
            second: { kind: 'pane' as const, paneId: 'pane-welcome' }
          }
        }
      }
    ]
    expect(() => parseMoshttyState({ ...state, layouts })).not.toThrow()
  })

  test('rejects split layouts with an out-of-range ratio', () => {
    const state = createSampleState('2026-05-25T00:00:00.000Z')
    const layouts = [
      {
        tabId: 'tab-welcome',
        root: {
          kind: 'split' as const,
          axis: 'row' as const,
          ratio: 1.5,
          first: { kind: 'pane' as const, paneId: 'pane-welcome' },
          second: { kind: 'pane' as const, paneId: 'pane-welcome' }
        }
      }
    ]
    expect(MoshttyStateSchema.safeParse({ ...state, layouts }).success).toBe(false)
  })
})
