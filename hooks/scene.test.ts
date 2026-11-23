import { expect, test } from 'claude-code/testing'

import { type Figures, NO_FIGURES } from './figures'
import { sceneSvg } from './scene'

/**
 * The desktop app keeps the motion in a backdrop only when its picture passes a strict check, and a picture that
 * fails it shows still, with no error. These are the rules found for engine 2.1.325 (see the garden theme's
 * README), so a drawing that breaks one fails here and not silently in the app.
 */
function problemsOf(svg: string): string[] {
  const found: string[] = []
  if (svg.length > 122_000) found.push(`over the size limit: ${svg.length}`)
  for (const media of svg.matchAll(/@media[^{]*/g)) {
    if (!media[0].includes('prefers-reduced-motion')) found.push(`media rule: ${media[0]}`)
  }
  for (const url of svg.matchAll(/url\(([^)]*)\)/g)) {
    if (!(url[1] ?? '').startsWith('#')) found.push(`url that is not an id: ${url[0]}`)
  }
  if (svg.includes('data:')) found.push('data: address')
  if (/<(image|foreignObject|script|iframe)/i.test(svg)) found.push('forbidden element')
  if (/\d(vw|vh|vmin|vmax)\b/.test(svg)) found.push('viewport unit')
  if (svg.includes(String.fromCharCode(92))) found.push('backslash')
  if (/\son[a-z]+=/i.test(svg)) found.push('event attribute')
  for (const href of svg.matchAll(/href="([^"]*)"/g)) {
    if (!(href[1] ?? '').startsWith('#')) found.push(`href that is not an id: ${href[0]}`)
  }
  if (/<!--|CDATA/.test(svg)) found.push('comment or CDATA')
  // The app allows five character references and no other, numeric ones included, and refuses the whole picture
  // for any other: a bare ampersand or a reference such as the one for an arrow.
  for (const reference of svg.matchAll(/&([^;\s&<]*)(;?)/g)) {
    if (reference[2] !== ';' || !['amp', 'lt', 'gt', 'quot', 'apos'].includes(reference[1] ?? '')) {
      found.push(`character reference the app refuses: ${reference[0]}`)
    }
  }

  // Well formed: every tag closes in the order it opened.
  const stack: string[] = []
  for (const tag of svg.matchAll(/<(\/?)([a-zA-Z][\w:-]*)[^>]*?(\/?)>/g)) {
    const [, closing, name, selfClosing] = tag
    if (selfClosing === '/') continue
    if (closing === '/') {
      if (stack.pop() !== name) found.push(`tag closed out of order: ${name}`)
    } else {
      stack.push(name ?? '')
    }
  }
  if (stack.length > 0) found.push(`tags left open: ${stack.join(',')}`)

  return found
}

const at = new Date(2026, 10, 22, 14, 25, 10).getTime()
const full: Figures = {
  ...NO_FIGURES,
  at,
  contextTokens: 184_000,
  contextPercent: 18,
  contextWindow: 1_000_000,
  usd: 12.34,
  lastTurnSeconds: 102,
  tools: 7,
  limits: [
    { kind: 'seven_day', percentUsed: 55, resetsAt: '2026-11-25T20:00:00' },
    { kind: 'five_hour', percentUsed: 11, resetsAt: '2026-11-22T16:30:00' },
  ],
  git: { tree: 'prod', branch: 'feat/prod-fixes', hasRemote: true, hasUpstream: true, ahead: 0, behind: 0, base: 'dev', baseAhead: 5, baseBehind: 0, dirty: 3, lastActiveAt: null },
  lastActiveAt: at - (11 * 3600 + 32 * 60) * 1000,
  previous: { contextPercent: 12, usd: 11.8 },
}

const cases: [string, Figures][] = [
  ['idle, cold, with git', full],
  ['working and warm', { ...full, isWorking: true, turnSeconds: 95, tools: 25, contextTokens: 320_000, lastActiveAt: at - 20 * 60_000 }],
  ['a long turn, hot context', { ...full, isWorking: true, turnSeconds: 3725, contextTokens: 450_000, contextPercent: 45 }],
  ['nothing known yet', NO_FIGURES],
  ['no git and no readings', { ...full, git: null, limits: [], usd: null, contextTokens: null, contextPercent: null }],
  ['git behind with a long branch name', { ...full, git: { ...full.git!, behind: 3, ahead: 2, branch: 'feat/a-very-long-branch-name-that-goes-on-and-on' } }],
  ['idle for days', { ...full, lastActiveAt: at - 200 * 3_600_000 }],
  ['in the morning', { ...full, at: new Date(2026, 10, 22, 9, 5, 0).getTime() }],
]

for (const [name, figures] of cases) {
  test(`the picture follows the app's rules: ${name}`, () => {
    const svg = sceneSvg(figures)
    expect(problemsOf(svg)).toEqual([])
    expect(svg.startsWith('<svg')).toBe(true)
  })
}

test('the picture shows every figure it is asked to', () => {
  const svg = sceneSvg(full)
  for (const word of ['feat/prod-fixes', '3 uncommitted', 'branch', 'github', 'usage / % used']) {
    expect(svg.includes(word)).toBe(true)
  }
  expect(sceneSvg({ ...full, git: { ...full.git!, dirty: 0 } }).includes('clean')).toBe(true)
  expect(svg.includes('class="bob"')).toBe(true)
  expect(svg.includes('class="tick"')).toBe(true)
  expect(svg.includes('class="roll"')).toBe(true)
})

test('the usage window shows how much is used, not how much is left', () => {
  const lit = (svg: string) => svg.match(/class="shimmer"/g)?.length ?? 0
  // 55 percent of the 7 day limit and 11 percent of the 5 hour limit are used: 6 squares and 1.
  expect(lit(sceneSvg(full))).toBe(7)
  expect(lit(sceneSvg({ ...full, limits: [{ kind: 'seven_day', percentUsed: 5 }, { kind: 'five_hour', percentUsed: 95 }] }))).toBe(11)
})

test('the next message cost section is gone', () => {
  const svg = sceneSvg(full)
  expect(svg.includes('NEXT MESSAGE')).toBe(false)
  expect(sceneSvg({ ...full, contextTokens: null }).includes('NEXT')).toBe(false)
})

test('the clock is digital, with AM or PM that turns over by itself', () => {
  const afternoon = sceneSvg(full)
  expect(afternoon.includes('class="hand"')).toBe(false)
  expect(afternoon.includes('class="am" style="opacity:0;animation-delay:-51910s"')).toBe(true)
  expect(afternoon.includes('class="pm" style="opacity:1;animation-delay:-51910s"')).toBe(true)
  const morning = sceneSvg({ ...full, at: new Date(2026, 10, 22, 9, 5, 0).getTime() })
  expect(morning.includes('class="am" style="opacity:1;animation-delay:-32700s"')).toBe(true)
  expect(morning.includes('class="pm" style="opacity:0;animation-delay:-32700s"')).toBe(true)
})

test('the hour counts on by itself from the right hour, twelve hour style', () => {
  // 14:25 is 2 PM: 2 hours into the 12 hour cycle, so the strip rests on the third face, " 2".
  const afternoon = sceneSvg(full)
  expect(afternoon.includes('animation-duration:43200s;animation-delay:-8710s')).toBe(true)
})

test('the background has a grid, a scrolling dump, a ruler and traces, all muted', () => {
  const svg = sceneSvg(full)
  expect(svg.includes('fill="url(#grid)"')).toBe(true)
  expect(svg.includes('class="scroll"')).toBe(true)
  expect(svg.includes('<use href="#dump"/>')).toBe(true)
  expect(svg.includes('class="packet"')).toBe(true)
  expect(svg.length).toBeLessThan(100_000)
})

test('the scrolling background is terminal output, not random numbers', () => {
  const svg = sceneSvg(full)
  // Commands with a green prompt, and their output.
  expect(svg.includes('<tspan fill="#3dff8f">$ </tspan>')).toBe(true)
  expect(svg.match(/<tspan fill="#3dff8f">\$ <\/tspan>/g)?.length ?? 0).toBeGreaterThan(5)
  expect(/git status -sb|pnpm test|docker compose ps|git log --oneline/.test(svg)).toBe(true)
  expect(/PASS |Running|built in|200 \d+ms/.test(svg)).toBe(true)
  // No hex dump: no address column.
  expect(/0x[0-9a-f]{6}/.test(svg)).toBe(false)
})

test('the terminal text is the same every time the picture is drawn', () => {
  const dump = (svg: string) => svg.slice(svg.indexOf('<g id="dump"'), svg.indexOf('</g>', svg.indexOf('<g id="dump"')))
  expect(dump(sceneSvg(full))).toBe(dump(sceneSvg({ ...full, usd: 99 })))
})

test('the spider drops further and faster while Claude works', () => {
  expect(sceneSvg(full).includes('--span:5s;--drop:22px')).toBe(true)
  expect(sceneSvg({ ...full, isWorking: true }).includes('--span:1.6s;--drop:46px')).toBe(true)
})

test('the badge turns from warm to cold by itself, and is cold from the start once the cache has expired', () => {
  const warm = sceneSvg({ ...full, lastActiveAt: at - 20 * 60_000 })
  expect(warm.includes('class="expire" style="animation-delay:2400s"')).toBe(true)
  expect(warm.includes('class="arrive" style="animation-delay:2400s"')).toBe(true)
  const cold = sceneSvg(full)
  expect(cold.includes('class="expire"')).toBe(false)
  expect(cold.includes('class="arrive"')).toBe(false)
})

test('a branch name with reserved characters cannot break the picture', () => {
  const svg = sceneSvg({ ...full, git: { ...full.git!, branch: 'a<b>&c' } })
  expect(problemsOf(svg)).toEqual([])
  expect(svg.includes('a&lt;b&gt;&amp;c')).toBe(true)
})
