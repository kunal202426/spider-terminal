import { expect, test } from 'claude-code/testing'

import { changedFiles, pair } from './gitinfo'

test('the two numbers of a left right count are read, and a missing one is zero', () => {
  expect(pair('3\t5\n')).toEqual({ left: 3, right: 5 })
  expect(pair('')).toEqual({ left: 0, right: 0 })
})

test('each changed file counts once, and a rename counts once though it has two paths', () => {
  const nul = String.fromCharCode(0)
  expect(changedFiles('')).toBe(0)
  expect(changedFiles(` M a.ts${nul}?? b.ts${nul}`)).toBe(2)
  expect(changedFiles(`R  new.ts${nul}old.ts${nul} M c.ts${nul}`)).toBe(2)
})
