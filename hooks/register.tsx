// A dark pixel theme: near-black surfaces with red and blue accents, and a backdrop of pixel dials, a git window and
// a usage window drawn from the session's own figures (scene.ts). The backdrop is drawn again only when a figure
// really changes: the app shows a redraw as a brief flash of the whole picture. The figures that keep time are
// reels that CSS carries on, so they never need one.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import type { GitInfo, Tally, Watch } from '../types'
import { type Figures, NO_FIGURES, signature } from './figures'
import { readGit } from './gitinfo'
import { makeColors } from './make-colors.js'
import { sceneSvg } from './scene'

const COMMAND = 'spider-terminal'
const SCENE = 'spider-terminal'
/** How often the figures are looked at again; the picture is only drawn when they differ. */
const POLL_MS = 20_000

const ACTIVITY = { plugin: 'spider-terminal', key: 'activity' } as const
const TALLY = { plugin: 'spider-terminal', key: 'tally' } as const
const DRAWN = { plugin: 'spider-terminal', key: 'drawn' } as const

const watch = atom(ACTIVITY, { phase: 'idle', startedAt: 0, toolCalls: 0 } as Watch)

const { theme, problems } = makeColors({
  label: 'Spider Terminal',
  only: 'dark',
  roles: { accent: '#4f86ff', danger: '#ff4d5e', success: '#3dff8f', warning: '#ffb02e', pro: '#b07bff' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#060607',
        'surface-1': '#0a0a0c',
        'surface-2': '#0f0f12',
        'surface-3': '#141418',
        'text-primary': '#eceef3',
        'text-secondary': '#b6bac6',
        'text-muted': '#8d92a1',
      },
    },
  },
})

// No glass: the scene is black where the chat is, so a veil would only wash out the panels in the margin.
const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: SCENE, glass: false },
}

// The backdrop hook must answer at once (a late answer is shown as a still picture), so it draws from this
// snapshot and never reads anything itself.
let latest: Figures = NO_FIGURES
let built: { from: Figures; source: string } | undefined
let lastKey = ''

function backdropSource(): string {
  if (built?.from !== latest) {
    built = { from: latest, source: sceneSvg(latest) }
  }

  return built.source
}

// Whether a window has drawn the theme yet, and whether the person turned it off. The first set in a new chat is
// made before its window attaches and is not drawn; the attach sets it again, and the timer keeps trying until
// a window draws it, so a missed attach cannot leave the chat without the theme.
let isDrawn = false
let wantsTheme = true

async function show($: EngineInterface): Promise<string> {
  const unpainted = problems.find(problem => problem.startsWith("Desktop won't paint"))
  if (unpainted !== undefined) {
    return unpainted
  }
  wantsTheme = true
  const set = await $.theme.set(LOOK)
  isDrawn = set.isDrawn

  return set.isDrawn ? 'The spider terminal theme is on.' : `The spider terminal theme is set, but this window does not draw it: ${set.reason}`
}

// What last went wrong, kept for `/spider-terminal status` to report: in a chat that does not hot reload its mods a
// failed hook leaves no line in the transcript, so without this a theme that never appears would give no reason.
let figuresProblem: string | null = null
let gitProblem: string | null = null

const describe = (error: unknown): string => (error instanceof Error ? error.message : String(error))

async function collect($: EngineInterface): Promise<Figures> {
  const now = await $.clock.now()
  const usage = await $.session.usage()
  const { value: activity } = await $.state.get(ACTIVITY)
  const { value: tally } = await $.state.get(TALLY)
  const { value: drawn } = await $.state.get(DRAWN)
  // Git is optional: if it cannot be read the git window says so and the rest still draws.
  let git: GitInfo | null = null
  try {
    git = await readGit($)
    gitProblem = null
  } catch (error) {
    gitProblem = describe(error)
  }
  const isWorking = activity?.phase === 'working'

  return {
    at: now,
    isWorking,
    turnSeconds: isWorking && activity ? Math.max(0, (now - activity.startedAt) / 1000) : 0,
    lastTurnSeconds: tally?.lastTurnSeconds ?? 0,
    tools: isWorking ? (activity?.toolCalls ?? 0) : (tally?.lastTurnTools ?? 0),
    contextTokens: usage.context.tokens ?? null,
    contextPercent: usage.context.percent ?? null,
    contextWindow: usage.context.window,
    limits: usage.rateLimits.map(limit => ({ ...limit })),
    usd: usage.cost?.usd ?? null,
    git,
    lastActiveAt: tally?.lastReplyAt ?? null,
    previous: { contextPercent: drawn?.contextPercent ?? null, usd: drawn?.usd ?? null },
  }
}

/** Looks at the figures and draws the backdrop again if they differ from the picture's, or when `force` says so. */
async function redraw($: EngineInterface, force: boolean): Promise<void> {
  const figures = await collect($)
  const key = signature(figures)
  if (!force && key === lastKey) {
    return
  }
  lastKey = key
  latest = figures
  await $.state.set(DRAWN, { contextPercent: figures.contextPercent, usd: figures.usd })
  $.ui.invalidate('ui.render')
}

/** `redraw`, but a failure is kept for `/spider-terminal status` and the caller goes on. */
async function refreshFigures($: EngineInterface, force: boolean): Promise<void> {
  try {
    await redraw($, force)
    figuresProblem = null
  } catch (error) {
    figuresProblem = describe(error)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({ name: COMMAND, description: 'Spider terminal theme: alone it turns the theme on; "off" clears it; "status" says what it is doing.' })
    // The theme first: whatever goes wrong with the figures must not keep it from being set. Not drawn yet is
    // normal here: the window attaches later, and session.attach sets the theme again.
    await show($).catch(() => undefined)
    await refreshFigures($, true)
    $.clock.every(POLL_MS, () => {
      if (wantsTheme && !isDrawn) {
        void show($).catch(() => undefined)
      }
      void refreshFigures($, false)
    })

    return result
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, watch, () => ({ phase: 'working', startedAt: now, toolCalls: 0 }))
      await refreshFigures($, true)
    }

    return next(e)
  })

  // A fault in the theme must never get in the way of a tool call: if the count fails, the call goes on.
  on('tool.call', async ($, e, next) => {
    await update($, watch, was => ({ ...was, toolCalls: was.toolCalls + 1 }))

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      const was = await read($, watch)
      const tally: Tally = {
        lastTurnSeconds: Math.round((now - was.startedAt) / 1000),
        lastTurnTools: was.toolCalls,
        lastReplyAt: now,
      }
      await update($, watch, () => ({ phase: 'idle', startedAt: 0, toolCalls: was.toolCalls }))
      await $.state.set(TALLY, tally)
      await refreshFigures($, true)
    }

    return next(e)
  })

  // A new session starts before its window attaches, and the theme set then is not drawn.
  on('session.attach', { surface: 'desktop' }, async ($, e, next) => {
    const result = await next(e)
    await show($).catch(() => undefined)

    return result
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const word = e.args.trim().toLowerCase()
    if (word === 'off') {
      await $.theme.clear()
      wantsTheme = false
      isDrawn = false

      return { text: `The spider terminal theme is off for this session. /${COMMAND} turns it on again.` }
    }
    const shown = await show($)
    if (word !== 'status') {
      return { text: shown }
    }

    return {
      text: [
        shown,
        `figures: ${figuresProblem ?? 'ok'}`,
        `git: ${gitProblem ?? (latest.git === null ? 'none (not a git folder)' : 'ok')}`,
        `last drawn: ${latest.at === 0 ? 'never' : new Date(latest.at).toLocaleTimeString()}`,
      ].join('\n'),
    }
  }).catch(() => ({ text: `The spider terminal theme hit an error. Run /${COMMAND} again.` }))

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.props.scene !== SCENE || e.surface !== 'desktop') {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)

    return <Svg isInteractive alt="A black scene with a web in the corner and a pixel spider on a thread, and a column of pixel dials and terminal windows showing context, turn, cost, time, git status and usage" source={backdropSource()} />
  })
}
