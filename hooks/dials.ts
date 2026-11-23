// Four pixel dials drawn from real session figures: how full the context window is (a fill that rises), the
// turn (an hourglass and its running time, then the last turn's time and a tally mark for each tool call),
// the session's cost (digits that roll to the new number) and a digital clock. The idea of dials like these comes from
// the garden theme by cktang88 (MIT, see LICENSE-garden-theme); the drawings here are new.

import { COLORS } from './palette'
import { type Figures, levelOf } from './figures'
import { Kit, bitmap, frame, round } from './pixel'

export const DIAL_WIDTH = 164
export const DIAL_HEIGHT = 150

const LEVEL_FILL = { ok: COLORS.greenDeep, warm: COLORS.amber, hot: COLORS.red } as const

/** A dial's panel, its notched edge and its label, as a nested picture of its own so its animations are local. */
function dial(x: number, y: number, label: string, kit: Kit, body: string): string {
  return (
    `<svg x="${x}" y="${y}" width="${DIAL_WIDTH}" height="${DIAL_HEIGHT}" viewBox="0 0 ${DIAL_WIDTH} ${DIAL_HEIGHT}">` +
    `<rect width="${DIAL_WIDTH}" height="${DIAL_HEIGHT}" fill="${COLORS.panel}"/>` +
    body +
    frame(0, 0, DIAL_WIDTH, DIAL_HEIGHT, COLORS.edge) +
    kit.text(label, 12, 10, 2, COLORS.dim) +
    `</svg>`
  )
}

/** Context: a fill that rises as the window fills, with a stepped wave on top, and the figure in big pixels. */
function context(x: number, y: number, kit: Kit, figures: Figures): string {
  const percent = figures.contextPercent
  const level = percent === null ? 0 : Math.max(0, Math.min(100, percent))
  const previous = figures.previous.contextPercent
  const height = 114
  const top = 30 + height - Math.round((level / 100) * height)
  const color = LEVEL_FILL[levelOf(figures.contextTokens)]
  let wave = ''
  for (let step = -2; step < 12; step += 1) {
    wave += `<rect x="${step * 16}" y="${top - 4}" width="8" height="4"/>`
  }
  const fill =
    percent === null
      ? ''
      : `<g clip-path="url(#ctxClip)"><g class="rise" style="--from:${round(((level - (previous ?? level)) / 100) * height)}px">` +
        `<g fill="${color}" fill-opacity=".55"><g class="wave">${wave}</g><rect x="0" y="${top}" width="${DIAL_WIDTH}" height="${DIAL_HEIGHT - top}"/></g></g></g>`
  const number = percent === null ? '--' : `${Math.round(level)}%`
  const tokens = figures.contextTokens === null ? '' : kit.text(`${figures.contextTokens >= 1000 ? Math.round(figures.contextTokens / 1000) : figures.contextTokens}K`, 82, 114, 2, COLORS.ink, 'middle')

  return dial(
    x,
    y,
    'CTX',
    kit,
    `<clipPath id="ctxClip"><rect x="4" y="30" width="${DIAL_WIDTH - 8}" height="${height}"/></clipPath>` +
      fill +
      kit.text(number, 82, 56, 5, COLORS.ink, 'middle') +
      tokens,
  )
}

// A small hourglass, nine squares wide, with sand in the top.
const HOURGLASS = [
  'XXXXXXXXX',
  '.X.....X.',
  '.X.SSS.X.',
  '..X.S.X..',
  '...X.X...',
  '....X....',
  '...X.X...',
  '..X...X..',
  '.X..S..X.',
  '.X.SSS.X.',
  'XXXXXXXXX',
]

/** Pencil-free tally marks in gates of five, one mark for each tool call. */
function tally(count: number, centre: number, y: number, kit: Kit): string {
  if (count > 20) {
    return kit.text(`${count} TOOLS`, centre, y, 2, COLORS.dim, 'middle')
  }
  const gates = Math.ceil(count / 5)
  const left = centre - (gates * 22 + (gates - 1) * 8) / 2
  let marks = ''
  for (let mark = 0; mark < count; mark += 1) {
    const gate = left + Math.floor(mark / 5) * 30
    if (mark % 5 === 4) {
      marks += `<rect x="${gate - 2}" y="${y + 5}" width="25" height="2"/>`
    } else {
      marks += `<rect x="${gate + (mark % 5) * 6}" y="${y}" width="2" height="12"/>`
    }
  }

  return `<g fill="${COLORS.dim}">${marks}</g>`
}

function seconds(total: number): string {
  return `${Math.floor(total / 60)}:${String(Math.floor(total % 60)).padStart(2, '0')}`
}

/** The turn dial: while Claude works an hourglass and a running time, between turns the last turn's time. */
function turn(x: number, y: number, kit: Kit, figures: Figures): string {
  if (figures.isWorking) {
    const faces = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
    const six = faces.slice(0, 6)
    const elapsed = figures.turnSeconds
    const left = 62
    const body =
      bitmap(HOURGLASS, 14, 34, 4, { X: COLORS.edge, S: COLORS.amber }) +
      `<rect class="drip" x="30" y="58" width="4" height="4" fill="${COLORS.amber}"/>` +
      kit.counting(six, left, 50, 3, COLORS.ink, 3600, elapsed) +
      kit.counting(faces, left + 18, 50, 3, COLORS.ink, 600, elapsed) +
      kit.text(':', left + 36, 50, 3, COLORS.ink) +
      kit.counting(six, left + 54, 50, 3, COLORS.ink, 60, elapsed) +
      kit.counting(faces, left + 72, 50, 3, COLORS.ink, 10, elapsed) +
      kit.text('THIS TURN', 82, 108, 2, COLORS.red, 'middle') +
      tally(figures.tools, 82, 128, kit)

    return dial(x, y, 'TURN', kit, body)
  }
  const rest = figures.lastTurnSeconds > 0 ? seconds(figures.lastTurnSeconds) : '--'
  const note = figures.lastTurnSeconds > 0 ? 'LAST TURN' : 'NO TURN YET'

  return dial(
    x,
    y,
    'TURN',
    kit,
    kit.text(rest, 82, 56, 5, COLORS.ink, 'middle') + tally(figures.tools, 82, 104, kit) + kit.text(note, 82, 126, 2, COLORS.dim, 'middle'),
  )
}

/** The session's cost: each digit is a strip of 0 to 9 that rolls from the digit it showed to the digit it shows. */
function cost(x: number, y: number, kit: Kit, figures: Figures): string {
  if (figures.usd === null) {
    return dial(x, y, 'COST', kit, kit.text('N/A', 82, 62, 4, COLORS.dim, 'middle'))
  }
  const text = `$${figures.usd.toFixed(2)}`
  const before = `$${(figures.previous.usd ?? figures.usd).toFixed(2)}`
  const scale = text.length > 6 ? 3 : 4
  const advance = 6 * scale
  const left = 82 - (text.length * advance - scale) / 2
  const was = before.padStart(text.length, ' ').slice(-text.length)
  const faces = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
  let digits = ''
  ;[...text].forEach((char, index) => {
    const cx = round(left + index * advance)
    if (!/[0-9]/.test(char)) {
      digits += kit.text(char, cx, 52, scale, COLORS.ink)

      return
    }
    const old = /[0-9]/.test(was[index] ?? '') ? Number(was[index]) : Number(char)
    digits += kit.rolling(faces, old, Number(char), cx, 52, scale, COLORS.ink, index * 90)
  })

  return dial(x, y, 'COST', kit, digits + kit.text('THIS SESSION', 82, 118, 2, COLORS.dim, 'middle'))
}

const HOURS = ['12', ' 1', ' 2', ' 3', ' 4', ' 5', ' 6', ' 7', ' 8', ' 9', '10', '11']

/**
 * The clock, digital: the local time as hours and minutes that count on by themselves, a colon that blinks, and
 * AM or PM, which turns over at noon and at midnight without the picture being drawn again.
 */
function clock(x: number, y: number, kit: Kit, figures: Figures): string {
  const date = new Date(figures.at)
  const time = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()
  const isPm = date.getHours() >= 12
  const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
  const scale = 4
  const left = 82 - (29 * scale) / 2
  const top = 46
  const half = (text: string, shown: boolean) =>
    `<g class="${text === 'AM' ? 'am' : 'pm'}" style="opacity:${shown ? 1 : 0};animation-delay:-${time}s">${kit.text(text, 82, 92, 3, COLORS.red, 'middle')}</g>`

  return dial(
    x,
    y,
    'TIME',
    kit,
    kit.counting(HOURS, left, top, scale, COLORS.ink, 43200, time % 43200, 2) +
      `<g class="blink">${kit.text(':', left + 12 * scale, top, scale, COLORS.ink)}</g>` +
      kit.counting(digits.slice(0, 6), left + 18 * scale, top, scale, COLORS.ink, 3600, time % 3600) +
      kit.counting(digits, left + 24 * scale, top, scale, COLORS.ink, 600, time % 600) +
      half('AM', !isPm) +
      half('PM', isPm) +
      kit.text('LOCAL TIME', 82, 126, 2, COLORS.dim, 'middle'),
  )
}

/** The four dials in two rows of two, from the top left of the block. */
export function dials(kit: Kit, figures: Figures): string {
  const gap = 12

  return (
    context(0, 0, kit, figures) +
    turn(DIAL_WIDTH + gap, 0, kit, figures) +
    cost(0, DIAL_HEIGHT + gap, kit, figures) +
    clock(DIAL_WIDTH + gap, DIAL_HEIGHT + gap, kit, figures)
  )
}
