import { describe, expect, it } from 'vitest'
import { createSampleState } from '../../../common/state'
import { stateSchema } from './state.schema'

describe('stateSchema', () => {
  it('accepts a valid sample state', () => {
    const state = createSampleState()
    const result = stateSchema.safeParse(state)
    expect(result.success).toBe(true)
  })

  it('rejects state with unknown version', () => {
    const state = { ...createSampleState(), version: 99 }
    const result = stateSchema.safeParse(state)
    expect(result.success).toBe(false)
  })

  it('rejects state with empty project id', () => {
    const state = createSampleState()
    state.projects[0].id = ''
    const result = stateSchema.safeParse(state)
    expect(result.success).toBe(false)
  })

  it('rejects state with invalid color', () => {
    const state = createSampleState()
    state.projects[0].color = 'not-a-color'
    const result = stateSchema.safeParse(state)
    expect(result.success).toBe(false)
  })

  it('accepts nested split layout', () => {
    const state = createSampleState()
    state.layouts[0].root = {
      kind: 'split',
      axis: 'row',
      ratio: 0.5,
      first: { kind: 'pane', paneId: 'pane-welcome' },
      second: {
        kind: 'split',
        axis: 'column',
        ratio: 0.5,
        first: { kind: 'pane', paneId: 'pane-welcome' },
        second: { kind: 'pane', paneId: 'pane-welcome' }
      }
    }
    const result = stateSchema.safeParse(state)
    expect(result.success).toBe(true)
  })
})
