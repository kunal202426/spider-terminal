// What the backdrop is drawn from, and the small pure functions that turn session figures into the words and
// numbers on it: how much of a rate limit is used, durations and token counts.

import type { GitInfo } from '../types'

export type RateLimit = { kind: string; percentUsed: number; resetsAt?: string }

export type Figures = {
  /** When these figures were read, ms since epoch. */
  at: number
  isWorking: boolean
  /** Seconds into the turn that is running, or 0. */
  turnSeconds: number
  lastTurnSeconds: number
  /** The tool calls of the running turn, or of the last one. */
  tools: number
  contextTokens: number | null
  contextPercent: number | null
  contextWindow: number | null
  limits: RateLimit[]
  usd: number | null
  git: GitInfo | null
  /** When the chat last did anything, ms since epoch. Null before it has. */
  lastActiveAt: number | null
  /** The context percent and cost the last picture showed, which the dials glide on from. */
  previous: { contextPercent: number | null; usd: number | null }
}

export const NO_FIGURES: Figures = {
  at: 0,
  isWorking: false,
  turnSeconds: 0,
  lastTurnSeconds: 0,
  tools: 0,
  contextTokens: null,
  contextPercent: null,
  contextWindow: null,
  limits: [],
  usd: null,
  git: null,
  lastActiveAt: null,
  previous: { contextPercent: null, usd: null },
}

/** Token counts where the context dial turns warmer: long chats get slower and costlier past these. */
export const NUDGE_AT = 250_000
export const URGENT_AT = 400_000

export type Level = 'ok' | 'warm' | 'hot'

export function levelOf(tokens: number | null): Level {
  if (tokens === null) {
    return 'ok'
  }

  return tokens >= URGENT_AT ? 'hot' : tokens >= NUDGE_AT ? 'warm' : 'ok'
}

export type Limit = { used: number; resetMs: number | null }

/** A rate limit as how much of it is used, 0 to 100, and the time to its reset. */
export function limitOf(limits: readonly RateLimit[], kind: string, now: number): Limit | null {
  const found = limits.find(limit => limit.kind === kind)
  if (found === undefined) {
    return null
  }
  const reset = found.resetsAt === undefined ? Number.NaN : Date.parse(found.resetsAt)

  return {
    used: Math.min(100, Math.max(0, Math.round(found.percentUsed))),
    resetMs: Number.isNaN(reset) ? null : reset - now,
  }
}

export function fmtDuration(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60_000))
  const days = Math.floor(mins / 1440)
  const hours = Math.floor((mins % 1440) / 60)
  if (days > 0) {
    return `${days}d ${hours}h`
  }

  return hours > 0 ? `${hours}h ${mins % 60}m` : `${mins}m`
}

export function fmtTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`
  }

  return count >= 1000 ? `${Math.round(count / 1000)}k` : String(count)
}

/**
 * A short key of what is on the picture. The picture is drawn again only when it changes: every redraw is a
 * flash, so seconds and minutes, which the picture keeps itself, are left out.
 */
export function signature(figures: Figures): string {
  const git = figures.git
  const limits = figures.limits.map(limit => `${limit.kind}${Math.round(limit.percentUsed)}`).join(',')

  return [
    figures.isWorking,
    figures.tools,
    figures.lastTurnSeconds,
    figures.contextTokens === null ? 'n' : Math.round(figures.contextTokens / 1000),
    figures.contextPercent === null ? 'n' : Math.round(figures.contextPercent),
    figures.usd === null ? 'n' : figures.usd.toFixed(2),
    limits,
    git === null ? 'nogit' : [git.branch, git.ahead, git.behind, git.baseAhead, git.baseBehind, git.dirty, git.hasUpstream].join(':'),
  ].join('|')
}
