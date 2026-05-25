/**
 * zod schema for `MoshttyState`.
 *
 * Role: trust boundary at IPC and at any external input (profile JSON
 * paste, disk reads). The hand-rolled normalizers in `./state.ts` are
 * the migration/healing layer — they happily coerce partial or legacy
 * payloads into a valid state. This schema is the strict checker that
 * proves a normalized state matches the locked shape, and is the source
 * of truth that drives `z.infer` types in IPC contracts.
 *
 * Rule: every value that crosses the IPC boundary (renderer <-> main)
 * or the disk boundary must be `MoshttyStateSchema.parse(...)`d on the
 * way in. Components consume only normalized, schema-valid states.
 *
 * Editing this file changes the IPC trust contract — coordinate before
 * editing (see `AGENTS.md` -> Stop Conditions, and
 * `docs/agents/OWNERS.md`).
 */

import { z } from 'zod'
import { MOSHTTY_STATE_VERSION, type MoshttyState } from './state'

const NonEmptyString = z.string().min(1)
const PositiveInt = z.number().int().positive()
const ColorHex = z.string().regex(/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6,8})$/, {
  message: 'project color must be a hex string'
})

export const ThemeModeSchema = z.enum(['system', 'light', 'dark'])
export const TerminalThemeModeSchema = z.enum(['follow-app', 'light', 'dark'])
export const RemoteStatusSchema = z.enum(['offline', 'connecting', 'connected', 'lost'])
export const PaneStatusSchema = z.enum(['active', 'lost'])
export const RemotePlatformSchema = z.enum(['macos', 'linux', 'unknown'])
export const SplitAxisSchema = z.enum(['row', 'column'])

export const MoshttySettingsSchema = z.object({
  themeMode: ThemeModeSchema,
  terminalTheme: TerminalThemeModeSchema,
  fontSize: PositiveInt,
  projectRailCollapsed: z.boolean()
})

export const MoshttyRemoteSchema = z.object({
  id: NonEmptyString,
  label: NonEmptyString,
  host: NonEmptyString,
  platform: RemotePlatformSchema,
  status: RemoteStatusSchema,
  url: NonEmptyString,
  tokenLabel: NonEmptyString,
  currentCertHash: NonEmptyString.nullable(),
  nextCertHash: NonEmptyString.nullable()
})

export const MoshttyProjectSchema = z.object({
  id: NonEmptyString,
  name: NonEmptyString,
  color: ColorHex,
  remoteId: NonEmptyString.nullable(),
  tabIds: z.array(NonEmptyString),
  activeTabId: NonEmptyString.nullable()
})

export const MoshttyTabSchema = z.object({
  id: NonEmptyString,
  title: NonEmptyString,
  paneIds: z.array(NonEmptyString),
  activePaneId: NonEmptyString.nullable()
})

export const MoshttyPaneSchema = z.object({
  id: NonEmptyString,
  title: NonEmptyString,
  cwd: NonEmptyString,
  status: PaneStatusSchema,
  cols: PositiveInt,
  rows: PositiveInt
})

const MoshttyPaneLayoutLeafSchema = z.object({
  kind: z.literal('pane'),
  paneId: NonEmptyString
})

type LayoutNodeInput =
  | z.input<typeof MoshttyPaneLayoutLeafSchema>
  | {
      kind: 'split'
      axis: z.input<typeof SplitAxisSchema>
      ratio: number
      first: LayoutNodeInput
      second: LayoutNodeInput
    }

type LayoutNodeOutput =
  | z.output<typeof MoshttyPaneLayoutLeafSchema>
  | {
      kind: 'split'
      axis: z.output<typeof SplitAxisSchema>
      ratio: number
      first: LayoutNodeOutput
      second: LayoutNodeOutput
    }

export const MoshttyPaneLayoutNodeSchema: z.ZodType<
  LayoutNodeOutput,
  z.ZodTypeDef,
  LayoutNodeInput
> = z.lazy(() =>
  z.union([
    MoshttyPaneLayoutLeafSchema,
    z.object({
      kind: z.literal('split'),
      axis: SplitAxisSchema,
      ratio: z.number().min(0.05).max(1),
      first: MoshttyPaneLayoutNodeSchema,
      second: MoshttyPaneLayoutNodeSchema
    })
  ])
)

export const MoshttyTabLayoutSchema = z.object({
  tabId: NonEmptyString,
  root: MoshttyPaneLayoutNodeSchema.nullable()
})

export const MoshttyStateSchema = z.object({
  version: z.literal(MOSHTTY_STATE_VERSION),
  updatedAt: NonEmptyString,
  activeProjectId: NonEmptyString.nullable(),
  activeTabId: NonEmptyString.nullable(),
  activePaneId: NonEmptyString.nullable(),
  remotes: z.array(MoshttyRemoteSchema),
  projects: z.array(MoshttyProjectSchema),
  tabs: z.array(MoshttyTabSchema),
  panes: z.array(MoshttyPaneSchema),
  layouts: z.array(MoshttyTabLayoutSchema),
  settings: MoshttySettingsSchema
})

/**
 * Compile-time guarantee that the hand-rolled `MoshttyState` type and the
 * zod schema's inferred output type agree. If they diverge (someone edits
 * one without the other), TypeScript fails the build here.
 */
type SchemaState = z.infer<typeof MoshttyStateSchema>
const _stateContractAssertion = (input: MoshttyState): SchemaState => input
const _stateContractAssertionInverse = (input: SchemaState): MoshttyState => input
void _stateContractAssertion
void _stateContractAssertionInverse

export type ParsedMoshttyState = z.infer<typeof MoshttyStateSchema>

/**
 * Strict parse. Throws a `ZodError` on invalid input. Use at the IPC
 * trust boundary AFTER normalization; do not use on raw legacy disk
 * payloads — call `normalizeState`/`migrateState` first.
 */
export function parseMoshttyState(input: unknown): ParsedMoshttyState {
  return MoshttyStateSchema.parse(input)
}

/**
 * Non-throwing variant. Returns a discriminated result with structured
 * error info for the renderer to surface.
 */
export type StateParseResult =
  | { ok: true; state: ParsedMoshttyState }
  | { ok: false; error: z.ZodError }

export function safeParseMoshttyState(input: unknown): StateParseResult {
  const result = MoshttyStateSchema.safeParse(input)
  if (result.success) {
    return { ok: true, state: result.data }
  }
  return { ok: false, error: result.error }
}
