// The background behind the chat: black, but with the texture of a machine at work. A fine grid of dots across
// the page, and along the left edge a ruler, a terminal that scrolls slowly and fades out towards the chat, and a
// few circuit traces with small packets running along them. All of it is muted and low in contrast: the chat is
// what is read, and this is only what the room looks like.

import { COLORS } from './palette'
import { MONO } from './pixel'

const LINES = 96
const PITCH = 16

/** A small repeatable sequence of numbers from a seed, so the terminal reads the same every time it is drawn. */
function sequence(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0

    return state / 4294967296
  }
}

type Next = () => number
type Kind = 'cmd' | 'out' | 'ok' | 'bad' | 'warn' | 'code' | 'dim'
type Row = [Kind, string]

const pick = <T>(next: Next, items: readonly T[]): T => items[Math.floor(next() * items.length)] as T
const between = (next: Next, low: number, high: number): number => low + Math.floor(next() * (high - low + 1))
const hash = (next: Next): string => Array.from({ length: 7 }, () => Math.floor(next() * 16).toString(16)).join('')

const BRANCHES = ['feat/profile-page', 'fix/session-expiry', 'chore/deps', 'feat/export-csv', 'fix/rate-limit']
const FILES = ['src/app/page.tsx', 'src/lib/auth.ts', 'src/db/schema.ts', 'api/events/route.ts', 'src/hooks/useSession.ts', 'README.md']
const SUBJECTS = ['feat(auth): add refresh token rotation', 'fix(api): retry on 429 with backoff', 'test(db): cover the soft delete path', 'chore: bump next to 15.1', 'refactor(ui): split the settings form']
const TESTS = ['src/lib/auth.test.ts', 'src/db/queries.test.ts', 'src/api/events.test.ts', 'src/ui/form.test.tsx']
const ROUTES = ['GET /api/session', 'POST /api/events', 'GET /api/profile', 'PUT /api/settings', 'GET /health']

/** Short stretches of what a terminal shows while someone builds something: each is a command and its output. */
const SCENES: ((next: Next) => Row[])[] = [
  next => [
    ['cmd', 'git status -sb'],
    ['out', `## ${pick(next, BRANCHES)}...origin`],
    ['warn', ` M ${pick(next, FILES)}`],
    ['warn', ` M ${pick(next, FILES)}`],
    ['dim', `?? ${pick(next, FILES)}`],
  ],
  next => [
    ['cmd', 'git log --oneline -3'],
    ['out', `${hash(next)} ${pick(next, SUBJECTS)}`],
    ['out', `${hash(next)} ${pick(next, SUBJECTS)}`],
    ['out', `${hash(next)} ${pick(next, SUBJECTS)}`],
  ],
  next => [
    ['cmd', 'pnpm test'],
    ['dim', '> app@0.4.2 test'],
    ['ok', `PASS ${pick(next, TESTS)} (${between(next, 1, 9)}.${between(next, 0, 9)}s)`],
    ['ok', `PASS ${pick(next, TESTS)} (${between(next, 1, 9)}.${between(next, 0, 9)}s)`],
    ['out', `Tests: ${between(next, 30, 90)} passed, ${between(next, 90, 99)} total`],
  ],
  next => [
    ['cmd', 'curl -s localhost:3000/health'],
    ['code', `{"ok":true,"uptime":${between(next, 100, 9000)}}`],
  ],
  next => [
    ['cmd', 'docker compose ps'],
    ['dim', 'NAME    STATUS    PORTS'],
    ['ok', 'db      running   5432'],
    ['ok', 'api     running   3000'],
    ['warn', 'worker  starting'],
  ],
  next => [
    ['cmd', 'tail -f logs/app.log'],
    ['out', `${pick(next, ROUTES)} 200 ${between(next, 4, 90)}ms`],
    ['out', `${pick(next, ROUTES)} 200 ${between(next, 4, 90)}ms`],
    ['warn', `slow query ${between(next, 1, 3)}.${between(next, 0, 9)}s on events`],
  ],
  next => [
    ['code', 'export async function GET(req: Request) {'],
    ['code', '  const { id } = await params'],
    ['code', `  const row = await db.get(id, ${between(next, 1, 9)})`],
    ['code', '  return Response.json(row)'],
    ['code', '}'],
  ],
  next => [
    ['cmd', 'pnpm build'],
    ['out', 'vite v5.4 building for production'],
    ['out', `transforming ${between(next, 200, 900)} modules`],
    ['ok', `built in ${between(next, 2, 9)}.${between(next, 0, 99)}s`],
  ],
  next => [
    ['cmd', 'kubectl get pods'],
    ['dim', 'NAME          READY  STATUS'],
    ['ok', `api-${hash(next).slice(0, 4)}-x2   1/1    Running`],
    ['ok', `db-0          1/1    Running`],
  ],
  next => [
    ['bad', 'ERROR ECONNRESET 10.0.0.4:5432'],
    ['dim', '  at Socket.onClose (node:net)'],
    ['dim', `  at Pool.query (db.ts:${between(next, 20, 90)})`],
    ['warn', 'retrying in 2s'],
  ],
  next => [
    ['cmd', 'git diff --stat'],
    ['out', ` ${pick(next, FILES)} | ${between(next, 2, 40)} ++--`],
    ['out', ` ${pick(next, FILES)} | ${between(next, 2, 40)} +++-`],
    ['out', ' 2 files changed'],
  ],
  next => [
    ['cmd', 'psql -c "select count(*) from users"'],
    ['dim', ' count'],
    ['out', ` ${between(next, 100, 9000)}`],
  ],
]

/** The text of the picture: XML's own characters written out, and the backslash, which the app refuses, gone. */
function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').split(String.fromCharCode(92)).join('/')
}

const FILL: Record<Kind, string> = {
  cmd: COLORS.ink,
  out: COLORS.dim,
  ok: COLORS.green,
  bad: COLORS.red,
  warn: COLORS.amber,
  code: COLORS.blue,
  dim: COLORS.faint,
}

/** One line: a command gets a green prompt, everything else its own muted color. */
function row([kind, text]: Row, index: number): string {
  const y = index * PITCH + 12
  const body = kind === 'cmd' ? `<tspan fill="${COLORS.green}">$ </tspan>${escape(text)}` : escape(text)

  return `<text x="26" y="${y}" fill="${FILL[kind]}" fill-opacity="${kind === 'cmd' ? 0.7 : 0.5}">${body}</text>`
}

/** The terminal as text lines. Defined once and shown twice, so that its scrolling loops without a seam. */
function terminal(): string {
  const next = sequence(20261122)
  const rows: Row[] = []
  while (rows.length < LINES) {
    rows.push(...pick(next, SCENES)(next), ['dim', ''])
  }

  return `<g id="dump" font-family="${MONO}" font-size="11">${rows.slice(0, LINES).map(row).join('')}</g>`
}

/** A ruler down the left edge: a tick every ten pixels, a longer one every fifty. */
function ruler(): string {
  let ticks = ''
  for (let at = 0; at < 2400; at += 10) {
    ticks += `M${at % 50 === 0 ? 8 : 12} ${at}h${at % 50 === 0 ? 10 : 6}`
  }

  return `<path d="${ticks}" stroke="${COLORS.faint}" stroke-opacity=".45" stroke-width="1" fill="none"/>`
}

/** Two traces with 45 degree bends and a via at each end, and a packet that runs along the first of each. */
function traces(): string {
  const stroke = `fill="none" stroke="${COLORS.blueDeep}" stroke-opacity=".7" stroke-width="1.5"`
  const via = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="3.5" fill="${COLORS.void}" stroke="${COLORS.blue}" stroke-opacity=".7" stroke-width="1.5"/>`

  return (
    `<path d="M0 330H70L100 360V520L150 570H230" ${stroke}/>` +
    `<path d="M0 660H44L74 690H190" ${stroke}/>` +
    via(230, 570) +
    via(190, 690) +
    `<rect class="packet" style="--run:62px;animation-duration:3.2s" x="4" y="329" width="8" height="2" fill="${COLORS.green}"/>` +
    `<rect class="packet" style="--run:136px;animation-duration:4.4s;animation-delay:-1.6s" x="48" y="689" width="8" height="2" fill="${COLORS.green}"/>`
  )
}

/** What goes in the defs: the grid pattern, the terminal and the fade that lets it disappear into the chat. */
export function ambientDefs(): string {
  return (
    `<pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><rect x="0" y="0" width="2" height="2" fill="${COLORS.faint}" fill-opacity=".35"/></pattern>` +
    `<linearGradient id="fadeRight" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${COLORS.void}" stop-opacity="0"/><stop offset=".55" stop-color="${COLORS.void}" stop-opacity="0"/><stop offset="1" stop-color="${COLORS.void}" stop-opacity="1"/></linearGradient>` +
    terminal()
  )
}

/** The background itself: the grid over the whole page, and the left strip, 22 percent wide. */
export function ambient(): string {
  return (
    `<rect width="100%" height="100%" fill="url(#grid)"/>` +
    `<svg x="0" y="0" width="22%" height="100%">` +
    ruler() +
    `<g class="scroll" style="--span:-${LINES * PITCH}px"><use href="#dump"/><use href="#dump" y="${LINES * PITCH}"/></g>` +
    traces() +
    `<rect width="100%" height="100%" fill="url(#fadeRight)"/>` +
    `</svg>`
  )
}
