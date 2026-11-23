// Reads the git figures the git window shows. Read-only and local: no fetch, so the "behind" counts are as of the
// last fetch the person made, and the theme never asks for credentials or touches the network.

import type { EngineInterface } from 'claude-code'

import type { GitInfo } from '../types'

/** The branch the work is compared with: the first of these that exists on origin. */
const BASES = ['dev', 'main', 'master']

function run($: EngineInterface, cwd: string, args: string[]) {
  return $.process.run(['git', ...args], { cwd, timeoutMs: 15_000 })
}

/** The two numbers of `rev-list --left-right --count`: commits only on the left, and only on the right. */
export function pair(output: string): { left: number; right: number } {
  const [left, right] = output.trim().split(/\s+/).map(Number)

  return { left: left || 0, right: right || 0 }
}

/** The number of changed or new files in `git status --porcelain=v1 -z`: one record per file, a rename having two. */
export function changedFiles(output: string): number {
  const records = output.split('\0').filter(Boolean)
  let files = 0
  for (let at = 0; at < records.length; at += 1) {
    files += 1
    // A rename or copy is followed by a record that holds the old path.
    if (/^[RC]/.test(records[at] ?? '')) at += 1
  }

  return files
}

/** The figures for the folder the session is in, or null when it is not in a git repository. */
export async function readGit($: EngineInterface): Promise<GitInfo | null> {
  const cwd = await $.session.cwd()
  const top = await run($, cwd, ['rev-parse', '--show-toplevel'])
  if (top.exitCode !== 0) {
    return null
  }
  const root = top.stdout.trim()
  const origin = await run($, root, ['remote', 'get-url', 'origin'])
  const hasRemote = origin.exitCode === 0
  let base: string | null = null
  for (const name of hasRemote ? BASES : []) {
    if ((await run($, root, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${name}`])).exitCode === 0) {
      base = name
      break
    }
  }
  const [branch, upstream, againstBase, status] = await Promise.all([
    run($, root, ['rev-parse', '--abbrev-ref', 'HEAD']),
    run($, root, ['rev-list', '--left-right', '--count', '@{u}...HEAD']),
    base === null ? Promise.resolve(null) : run($, root, ['rev-list', '--left-right', '--count', `origin/${base}...HEAD`]),
    run($, root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']),
  ])
  const remote = upstream.exitCode === 0 ? pair(upstream.stdout) : null
  const counts = againstBase !== null && againstBase.exitCode === 0 ? pair(againstBase.stdout) : { left: 0, right: 0 }

  return {
    tree: root.split('/').filter(Boolean).pop() ?? root,
    branch: branch.stdout.trim(),
    hasRemote,
    hasUpstream: remote !== null,
    ahead: remote === null ? 0 : remote.right,
    behind: remote === null ? 0 : remote.left,
    base,
    baseAhead: counts.right,
    baseBehind: counts.left,
    dirty: changedFiles(status.stdout),
    lastActiveAt: null,
  }
}
