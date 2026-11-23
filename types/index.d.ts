export type Watch = {
  phase: 'idle' | 'working'
  startedAt: number
  toolCalls: number
}

/** What the last turn left behind, for the turn dial and the idle counter. */
export type Tally = {
  lastTurnSeconds: number
  lastTurnTools: number
  /** When the last turn ended, ms since epoch. */
  lastReplyAt: number | null
}

/** The figures the backdrop last showed, which the dials glide on from. */
export type Drawn = {
  contextPercent: number | null
  usd: number | null
}

/** What the git window shows, read from the folder the session is in (hooks/gitinfo.ts). */
export type GitInfo = {
  tree: string
  branch: string
  hasRemote: boolean
  hasUpstream: boolean
  ahead: number
  behind: number
  base: string | null
  baseAhead: number
  baseBehind: number
  dirty: number
  lastActiveAt: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'spider-terminal': {
      activity: Watch
      tally: Tally
      drawn: Drawn
    }
  }
}
