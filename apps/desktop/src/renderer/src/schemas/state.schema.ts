import { z } from 'zod'

export const themeModeSchema = z.enum(['system', 'light', 'dark'])
export const terminalThemeModeSchema = z.enum(['follow-app', 'light', 'dark'])
export const remoteStatusSchema = z.enum(['offline', 'connecting', 'connected', 'lost'])
export const paneStatusSchema = z.enum(['active', 'lost'])
export const remotePlatformSchema = z.enum(['macos', 'linux', 'unknown'])
export const splitAxisSchema = z.enum(['row', 'column'])

export const settingsSchema = z.object({
  themeMode: themeModeSchema,
  terminalTheme: terminalThemeModeSchema,
  fontSize: z.number().int().min(8).max(48),
  projectRailCollapsed: z.boolean()
})

export const remoteSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  host: z.string().min(1),
  platform: remotePlatformSchema,
  status: remoteStatusSchema,
  url: z.string().url(),
  tokenLabel: z.string(),
  currentCertHash: z.string().nullable(),
  nextCertHash: z.string().nullable()
})

export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  remoteId: z.string().nullable(),
  tabIds: z.array(z.string().min(1)),
  activeTabId: z.string().nullable()
})

export const tabSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  paneIds: z.array(z.string().min(1)),
  activePaneId: z.string().nullable()
})

export const paneSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  cwd: z.string(),
  status: paneStatusSchema,
  cols: z.number().int().positive(),
  rows: z.number().int().positive()
})

export const paneLayoutLeafSchema = z.object({
  kind: z.literal('pane'),
  paneId: z.string().min(1)
})

const paneLayoutNodeSchema = z.record(z.string(), z.unknown())

export const tabLayoutSchema = z.object({
  tabId: z.string().min(1),
  root: paneLayoutNodeSchema.and(z.object({ kind: z.string() })).nullable()
})

export const stateSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().min(1),
  activeProjectId: z.string().nullable(),
  activeTabId: z.string().nullable(),
  activePaneId: z.string().nullable(),
  remotes: z.array(remoteSchema),
  projects: z.array(projectSchema),
  tabs: z.array(tabSchema),
  panes: z.array(paneSchema),
  layouts: z.array(tabLayoutSchema),
  settings: settingsSchema
})
