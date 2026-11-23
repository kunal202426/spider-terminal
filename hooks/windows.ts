// The two terminal windows under the dials: git status as a few lines of a shell, and usage (how much of the
// rate limits is used, how cold the prompt cache is, and what a re-cache would take). They replace the chips, the
// meter and the usage panel that sat in the band above the prompt.

import { COLORS } from './palette'
import { type Figures, fmtDuration, fmtTokens, limitOf } from './figures'
import { Kit, MONO, frame, round } from './pixel'

export const WINDOW_WIDTH = 340
const TITLE = 26

/** A window: panel, notched edge, a title bar with three squares and the title. */
function chrome(y: number, height: number, title: string, body: string): string {
  return (
    `<g transform="translate(0 ${y})">` +
    `<rect width="${WINDOW_WIDTH}" height="${height}" fill="${COLORS.panel}"/>` +
    `<rect x="3" y="3" width="${WINDOW_WIDTH - 6}" height="${TITLE - 3}" fill="${COLORS.panelHigh}"/>` +
    `<rect x="12" y="10" width="8" height="8" fill="${COLORS.red}"/><rect x="24" y="10" width="8" height="8" fill="${COLORS.amber}"/><rect x="36" y="10" width="8" height="8" fill="${COLORS.green}"/>` +
    `<text x="56" y="19" font-family="${MONO}" font-size="13" fill="${COLORS.dim}">${title}</text>` +
    body +
    frame(0, 0, WINDOW_WIDTH, height, COLORS.edge) +
    `</g>`
  )
}

type Part = { text: string; fill: string }

// A label and its value, each at a fixed place, so the columns line up without spaces to count.
const line = (row: number, label: Part, value?: Part): string => {
  const y = TITLE + 26 + row * 24

  return (
    `<text x="16" y="${y}" font-family="${MONO}" font-size="16" fill="${label.fill}">${label.text}</text>` +
    (value === undefined ? '' : `<text x="104" y="${y}" font-family="${MONO}" font-size="16" fill="${value.fill}">${value.text}</text>`)
  )
}

/** Text safe for the picture: the characters that XML reserves are written out. */
function safe(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function clip(text: string, most: number): string {
  return text.length > most ? `${text.slice(0, most - 1)}~` : text
}

export const GIT_HEIGHT = 136

/** Git, as the output of a shell: branch, how it stands against GitHub and the base branch, and the tree. */
export function gitWindow(y: number, figures: Figures): string {
  const git = figures.git
  if (git === null) {
    return chrome(y, GIT_HEIGHT, 'git', line(0, { text: '$ git status', fill: COLORS.green }) + line(1, { text: 'not a git folder', fill: COLORS.dim }))
  }
  const github: Part = !git.hasRemote
    ? { text: 'no remote', fill: COLORS.dim }
    : !git.hasUpstream
      ? { text: 'not pushed yet', fill: COLORS.amber }
      : { text: `${git.ahead} ahead ${git.behind} behind`, fill: git.behind > 0 ? COLORS.red : git.ahead > 0 ? COLORS.amber : COLORS.green }
  const base: Part =
    git.base === null
      ? { text: 'none', fill: COLORS.dim }
      : { text: `${git.baseAhead} ahead ${git.baseBehind} behind`, fill: git.baseBehind > 0 ? COLORS.amber : COLORS.blue }
  const label = (text: string): Part => ({ text, fill: COLORS.dim })

  return chrome(
    y,
    GIT_HEIGHT,
    'git',
    line(0, label('branch'), { text: safe(clip(git.branch, 23)), fill: COLORS.red }) +
      line(1, label('github'), github) +
      line(2, label(safe(git.base ?? 'base')), base) +
      line(3, label('tree'), git.dirty === 0 ? { text: 'clean', fill: COLORS.green } : { text: `${git.dirty} uncommitted`, fill: COLORS.amber }),
  )
}

/** The more of a limit is used, the warmer: green below 60, amber to 85, red past it. */
const usedColor = (used: number): string => (used >= 85 ? COLORS.red : used >= 60 ? COLORS.amber : COLORS.green)

/** Ten squares, lit for how much of a limit is used, the lit ones brightening in a wave, and when it resets. */
function limitRow(kit: Kit, y: number, name: string, limit: ReturnType<typeof limitOf>): string {
  let row = kit.text(name, 16, y, 2, COLORS.dim)
  if (limit === null) {
    return row + kit.text('NO READING', 56, y, 2, COLORS.faint)
  }
  const lit = Math.round(limit.used / 10)
  const color = usedColor(limit.used)
  for (let square = 0; square < 10; square += 1) {
    row +=
      square < lit
        ? `<rect class="shimmer" style="animation-delay:${round(square * 0.12)}s" x="${56 + square * 11}" y="${y + 2}" width="8" height="10" fill="${color}"/>`
        : `<rect x="${56 + square * 11}" y="${y + 5}" width="8" height="4" fill="${COLORS.edgeDim}"/>`
  }
  row += kit.text(`${limit.used}%`, 172, y, 2, color)
  const reset = limit.resetMs === null ? '' : limit.resetMs <= 0 ? 'RESETTING' : fmtDuration(limit.resetMs).toUpperCase().replace(/ /g, '')
  row += kit.text(reset, 224, y, 2, COLORS.dim)

  return row
}

/** The idle counter: how long since the chat last did anything, counting on by itself, and WARM or COLD. */
function idleRow(kit: Kit, y: number, figures: Figures, warmMs: number): string {
  const idle = figures.lastActiveAt === null ? null : Math.max(0, figures.at - figures.lastActiveAt)
  let row = kit.text('IDLE', 16, y, 2, COLORS.dim)
  if (idle === null) {
    return row + kit.text('NO REPLY YET', 76, y, 2, COLORS.faint)
  }
  const seconds = idle / 1000
  if (idle >= 100 * 3_600_000) {
    row += kit.text('99:59+', 76, y - 4, 3, COLORS.ink)
  } else {
    const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
    const six = digits.slice(0, 6)
    row +=
      kit.counting(digits, 76, y - 4, 3, COLORS.ink, 360_000, seconds) +
      kit.counting(digits, 94, y - 4, 3, COLORS.ink, 36_000, seconds) +
      kit.text(':', 112, y - 4, 3, COLORS.ink) +
      kit.counting(six, 130, y - 4, 3, COLORS.ink, 3600, seconds) +
      kit.counting(digits, 148, y - 4, 3, COLORS.ink, 600, seconds)
  }
  const left = warmMs - idle
  const badge = (text: string, fill: string, extra: string) =>
    `<g ${extra}><rect x="256" y="${y - 4}" width="68" height="20" fill="${fill}"/>${kit.text(text, 290, y + 1, 2, COLORS.void, 'middle')}</g>`
  // The badge turns from WARM to COLD at the moment the cache expires, with no redraw: the cold one is
  // already there at that moment, the warm one steps away.
  if (left > 0) {
    row +=
      badge('WARM', COLORS.amber, `class="expire" style="animation-delay:${round(left / 1000)}s"`) +
      badge('COLD', COLORS.blue, `class="arrive" style="animation-delay:${round(left / 1000)}s"`)
  } else {
    row += badge('COLD', COLORS.blue, '')
  }

  return row
}

/** Two rows of dots: how much of the model's window the cache holds, in squares. */
function recacheRow(kit: Kit, y: number, figures: Figures): string {
  let row = kit.text('RE-CACHE', 16, y, 2, COLORS.dim)
  if (figures.contextTokens === null || figures.contextWindow === null || figures.contextWindow <= 0) {
    return row + kit.text('NO READING', WINDOW_WIDTH - 16, y, 2, COLORS.faint, 'end')
  }
  const share = Math.min(1, figures.contextTokens / figures.contextWindow)
  row += kit.text(`${fmtTokens(figures.contextTokens).toUpperCase()} TOK`, WINDOW_WIDTH - 16, y, 2, COLORS.ink, 'end')
  const perRow = 33
  const lit = Math.round(share * perRow * 2)
  for (let square = 0; square < perRow * 2; square += 1) {
    const x = 16 + (square % perRow) * 9
    const top = y + 20 + (square < perRow ? 0 : 9)
    row +=
      square < lit
        ? `<rect class="fade" style="animation-delay:${round((square % perRow) * 0.02)}s" x="${x}" y="${top}" width="6" height="6" fill="${COLORS.blue}"/>`
        : `<rect x="${x + 1}" y="${top + 2}" width="4" height="2" fill="${COLORS.edgeDim}"/>`
  }

  return row + kit.text(`${Math.round(share * 100)}% OF ${fmtTokens(figures.contextWindow).toUpperCase()} CONTEXT`, 16, y + 40, 2, COLORS.faint)
}

export const USAGE_HEIGHT = 204

/** Usage: how much of the 7 day and 5 hour limits is used, idle time with WARM or COLD, and the re-cache. */
export function usageWindow(kit: Kit, y: number, figures: Figures, warmMs: number): string {
  const sevenDay = limitOf(figures.limits, 'seven_day', figures.at)
  const fiveHour = limitOf(figures.limits, 'five_hour', figures.at)
  const rule = (at: number) => `<rect x="16" y="${TITLE + at}" width="${WINDOW_WIDTH - 32}" height="2" fill="${COLORS.edgeDim}"/>`

  return chrome(
    y,
    USAGE_HEIGHT,
    'usage / % used',
    limitRow(kit, TITLE + 10, '7D', sevenDay) +
      limitRow(kit, TITLE + 32, '5H', fiveHour) +
      rule(54) +
      idleRow(kit, TITLE + 68, figures, warmMs) +
      rule(94) +
      recacheRow(kit, TITLE + 104, figures),
  )
}
