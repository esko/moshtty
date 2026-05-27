export type AppDialog =
  | { kind: 'import'; mode: 'empty' | 'valid' | 'invalid' }
  | { kind: 'project'; mode: 'new' | 'existing' }
  | { kind: 'settings' }
  | { kind: 'bootstrap' }

export function getFixtureDialog(fixtureId: string | null): AppDialog | null {
  switch (fixtureId) {
    case 'dialog-import-empty':
      return { kind: 'import', mode: 'empty' }
    case 'dialog-import-valid':
      return { kind: 'import', mode: 'valid' }
    case 'dialog-import-invalid':
      return { kind: 'import', mode: 'invalid' }
    case 'dialog-project-edit-new':
      return { kind: 'project', mode: 'new' }
    case 'dialog-project-edit':
      return { kind: 'project', mode: 'existing' }
    case 'dialog-terminal-settings':
    case 'dialog-terminal-settings-follow-app':
    case 'dialog-terminal-settings-light':
    case 'dialog-terminal-settings-dark':
      return { kind: 'settings' }
    case 'dialog-bootstrap':
      return { kind: 'bootstrap' }
    default:
      return null
  }
}
