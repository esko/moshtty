import { expect, test } from 'vitest'
import { useAppStore } from './store'

test('Zustand store manages projects', () => {
  const store = useAppStore.getState()
  expect(store.projects.length).toBe(0)

  store.addProject('Test Project')

  const updatedStore = useAppStore.getState()
  expect(updatedStore.projects.length).toBe(1)
  expect(updatedStore.projects[0].name).toBe('Test Project')
})
