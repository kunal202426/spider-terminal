import { expect, test } from 'claude-code/testing'

import { NO_FIGURES, fmtDuration, fmtTokens, levelOf, limitOf, signature } from './figures'

const now = Date.parse('2026-10-23T10:00:00Z')

test('a rate limit becomes how much is used and the time to its reset', () => {
  const limits = [
    { kind: 'seven_day', percentUsed: 55, resetsAt: '2026-10-26T20:00:00Z' },
    { kind: 'five_hour', percentUsed: 10.4 },
  ]
  expect(limitOf(limits, 'seven_day', now)).toEqual({ used: 55, resetMs: 3 * 86_400_000 + 10 * 3_600_000 })
  expect(limitOf(limits, 'five_hour', now)).toEqual({ used: 10, resetMs: null })
  expect(limitOf(limits, 'spend_limit', now)).toBe(null)
  expect(limitOf([{ kind: 'five_hour', percentUsed: 130 }], 'five_hour', now)?.used).toBe(100)
  expect(limitOf([{ kind: 'five_hour', percentUsed: -4 }], 'five_hour', now)?.used).toBe(0)
})

test('durations and token counts read short', () => {
  expect(fmtDuration(3 * 86_400_000 + 10 * 3_600_000)).toBe('3d 10h')
  expect(fmtDuration(11 * 3_600_000 + 32 * 60_000)).toBe('11h 32m')
  expect(fmtDuration(5 * 60_000)).toBe('5m')
  expect(fmtDuration(-1)).toBe('0m')
  expect(fmtTokens(597_000)).toBe('597k')
  expect(fmtTokens(1_000_000)).toBe('1.0M')
  expect(fmtTokens(850)).toBe('850')
})

test('the context turns warm at 250k tokens and hot at 400k', () => {
  expect(levelOf(null)).toBe('ok')
  expect(levelOf(249_999)).toBe('ok')
  expect(levelOf(250_000)).toBe('warm')
  expect(levelOf(399_999)).toBe('warm')
  expect(levelOf(400_000)).toBe('hot')
})

test('the signature changes with the figures on the picture and ignores the time', () => {
  const same = { ...NO_FIGURES, at: 1, usd: 1.234, contextPercent: 20.4, contextTokens: 200_100 }
  expect(signature({ ...same, at: 99_999_999, turnSeconds: 55 })).toBe(signature(same))
  expect(signature({ ...same, usd: 1.5 })).not.toBe(signature(same))
  expect(signature({ ...same, isWorking: true })).not.toBe(signature(same))
  expect(signature({ ...same, tools: 3 })).not.toBe(signature(same))
  const git = { tree: 't', branch: 'b', hasRemote: true, hasUpstream: true, ahead: 0, behind: 0, base: 'dev', baseAhead: 1, baseBehind: 0, dirty: 0, lastActiveAt: null }
  expect(signature({ ...same, git })).not.toBe(signature(same))
  expect(signature({ ...same, git: { ...git, dirty: 2 } })).not.toBe(signature({ ...same, git }))
  expect(signature({ ...same, git: { ...git, lastActiveAt: 5 } })).toBe(signature({ ...same, git }))
})
