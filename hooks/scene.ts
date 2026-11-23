// The backdrop: black, a web in the top right corner, a pixel spider on its thread, and a column of panels in
// the right margin: four dials, a git window and a usage window. The column is pinned to the top right under the
// toolbar and scaled to the window: a small share of its width, and never taller than it, so it neither runs
// into the chat in a small window nor falls off the bottom. Motion is CSS only (the app freezes
// a picture that breaks its strict check, so see scene.test.ts), and a redraw restarts every animation, which
// the app shows as a flash: the figures that keep time are reels that carry on by themselves.

import { ambient, ambientDefs } from './ambient'
import { COLORS } from './palette'
import { dials } from './dials'
import { type Figures } from './figures'
import { Kit, bitmap } from './pixel'
import { GIT_HEIGHT, USAGE_HEIGHT, WINDOW_WIDTH, gitWindow, usageWindow } from './windows'

const GAP = 12
const DIALS_HEIGHT = 150 * 2 + GAP
/** The room above the dials that the spider hangs in, and the margin around the column, in picture units. */
const SPIDER_ROOM = 64
const SIDE = 12
/** How long the prompt cache stays warm after the chat last did anything. */
const WARM_MS = 3_600_000

/** A spider of my own, eleven squares wide: X is the body, L a leg, E an eye. */
const SPIDER = [
  'L.........L',
  '.L.XXXXX.L.',
  '..LXEXEXL..',
  'LLLXXXXXLLL',
  '..LXXXXXL..',
  '.L.XXXXX.L.',
  'L.........L',
]

const STYLE = `
.rise{animation:rise 1.6s steps(10) both}
.wave{animation:wave 1.4s steps(2) infinite}
.tick{animation-name:tick;animation-iteration-count:infinite}
.roll{animation:roll 1.4s steps(9) both}
.drip{animation:drip 1.2s steps(6) infinite}
.shimmer{animation:shimmer 2.4s steps(4) infinite}
.fade{animation:fade .5s steps(4) both}
.expire{animation:expire 1s steps(1) both}
.arrive{opacity:0;animation:arrive 1s steps(1) both}
.bob{animation:bob var(--span) ease-in-out infinite}
.blink{animation:blink 1s steps(1) infinite}
.am{animation:am 86400s steps(1) infinite}
.pm{animation:pm 86400s steps(1) infinite}
.scroll{animation:scroll 120s linear infinite}
.packet{animation-name:packet;animation-timing-function:linear;animation-iteration-count:infinite}
@keyframes rise{from{transform:translateY(var(--from))}to{transform:translateY(0)}}
@keyframes wave{from{transform:translateX(0)}to{transform:translateX(16px)}}
@keyframes tick{from{transform:translateY(0)}to{transform:translateY(var(--far))}}
@keyframes roll{from{transform:translateY(var(--from))}to{transform:translateY(var(--to))}}
@keyframes drip{0%{transform:translateY(0);opacity:1}80%{opacity:1}100%{transform:translateY(34px);opacity:0}}
@keyframes shimmer{50%{opacity:.45}}
@keyframes fade{from{opacity:0}}
@keyframes expire{to{opacity:0}}
@keyframes arrive{to{opacity:1}}
@keyframes bob{50%{transform:translateY(var(--drop))}}
@keyframes blink{50%{opacity:0}}
@keyframes am{0%{opacity:1}50%{opacity:0}}
@keyframes pm{0%{opacity:0}50%{opacity:1}}
@keyframes scroll{to{transform:translateY(var(--span))}}
@keyframes packet{to{transform:translateX(var(--run))}}
@media (prefers-reduced-motion: reduce){*{animation:none!important}}`

/** A quarter of a web in the top right corner: spokes and sagging rings, faint so the chat stays readable. */
function web(): string {
  const spokes = 6
  const rings = [70, 130, 190, 250]
  let path = ''
  for (let spoke = 0; spoke < spokes; spoke += 1) {
    const angle = (spoke / (spokes - 1)) * (Math.PI / 2)
    path += `M0 0L${Math.round(-260 * Math.cos(angle))} ${Math.round(260 * Math.sin(angle))}`
  }
  for (const radius of rings) {
    let ring = ''
    for (let spoke = 0; spoke < spokes; spoke += 1) {
      const angle = (spoke / (spokes - 1)) * (Math.PI / 2)
      const x = Math.round(-radius * Math.cos(angle))
      const y = Math.round(radius * Math.sin(angle))
      if (spoke === 0) {
        ring += `M${x} ${y}`
        continue
      }
      const middle = ((spoke - 0.5) / (spokes - 1)) * (Math.PI / 2)
      ring += `Q${Math.round(-radius * 0.86 * Math.cos(middle))} ${Math.round(radius * 0.86 * Math.sin(middle))} ${x} ${y}`
    }
    path += ring
  }

  return `<svg x="100%" y="0" width="1" height="1" overflow="visible"><path d="${path}" fill="none" stroke="${COLORS.web}" stroke-opacity=".16" stroke-width="2"/></svg>`
}

/** The spider hangs from the top of the window on a thread. It sinks lower and bobs faster while Claude works. */
function spider(isWorking: boolean): string {
  const x = WINDOW_WIDTH - 66
  const style = isWorking ? '--span:1.6s;--drop:46px' : '--span:5s;--drop:22px'

  return (
    `<g class="bob" style="${style}">` +
    `<rect x="${x + 26}" y="-300" width="3" height="${300 - 24 + 20}" fill="${COLORS.web}" fill-opacity=".5"/>` +
    bitmap(SPIDER, x, -24, 5, { X: COLORS.red, L: COLORS.dim, E: COLORS.ink }) +
    `</g>`
  )
}

const LARGEST = 122_000

/** How much of the window's width the column takes, in percent. The one number to change to make the dials bigger or smaller. */
const COLUMN_SHARE = 16

/**
 * How much of the window's height the column may take, in percent. The app shows the backdrop only above the
 * prompt box, which is about three quarters of the window, so the column has to end well before the bottom.
 */
const COLUMN_ROOM = 66

const COLUMN_HEIGHT = DIALS_HEIGHT + GAP + GIT_HEIGHT + GAP + USAGE_HEIGHT

export function sceneSvg(figures: Figures): string {
  const kit = new Kit()
  const column =
    dials(kit, figures) +
    gitWindow(DIALS_HEIGHT + GAP, figures) +
    usageWindow(kit, DIALS_HEIGHT + GAP + GIT_HEIGHT + GAP, figures, WARM_MS)
  const body =
    `<rect width="100%" height="100%" fill="${COLORS.void}"/>` +
    ambient() +
    web() +
    `<svg x="${100 - COLUMN_SHARE - 1}%" y="7%" width="${COLUMN_SHARE}%" height="${COLUMN_ROOM}%" viewBox="${-SIDE} ${-SPIDER_ROOM} ${WINDOW_WIDTH + 2 * SIDE} ${COLUMN_HEIGHT + SPIDER_ROOM + SIDE}" preserveAspectRatio="xMaxYMin meet" overflow="visible">${spider(figures.isWorking)}${column}</svg>`
  const picture = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" shape-rendering="crispEdges"><style>${STYLE}</style><defs>${kit.defs()}${ambientDefs()}</defs>${body}</svg>`

  return picture.length <= LARGEST ? picture : `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><rect width="100%" height="100%" fill="${COLORS.void}"/></svg>`
}
