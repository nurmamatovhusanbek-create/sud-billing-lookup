/**
 * v158: POST /api/settings/update
 *
 * Runs `git pull origin main` to update the app to the latest commit.
 * Pre-checks: working tree must be clean, must be on main branch.
 * Uses execFile (async, non-blocking) — does NOT block the event loop.
 *
 * Response (success):
 *   { ok: true, output: string, needsRestart: true, newSha: string }
 *
 * Response (error):
 *   { ok: false, error: 'dirty_tree' | 'wrong_branch' | 'git_unavailable' | 'pull_failed', detail?: string }
 */

import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { getLocalGitSha, getLocalGitBranch, isWorkingTreeClean } from '@/lib/version-server'

const execFileAsync = promisify(execFile)

export async function POST() {
  // Check git is available
  const currentSha = getLocalGitSha()
  if (!currentSha) {
    return NextResponse.json(
      { ok: false, error: 'git_unavailable', detail: 'Git is not available in this environment' },
      { status: 400 },
    )
  }

  // Check we're on main branch
  const branch = getLocalGitBranch()
  if (branch !== 'main') {
    return NextResponse.json(
      { ok: false, error: 'wrong_branch', currentBranch: branch },
      { status: 409 },
    )
  }

  // Check working tree is clean
  const clean = isWorkingTreeClean()
  if (clean === false) {
    try {
      const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { timeout: 5000 })
      return NextResponse.json(
        {
          ok: false,
          error: 'dirty_tree',
          detail: 'Working tree has uncommitted changes. Commit or stash them first.',
          changes: stdout.trim().split('\n').slice(0, 20),
        },
        { status: 409 },
      )
    } catch {
      return NextResponse.json(
        { ok: false, error: 'dirty_tree', detail: 'Working tree has uncommitted changes' },
        { status: 409 },
      )
    }
  }

  // Run git pull
  try {
    const { stdout, stderr } = await execFileAsync('git', ['pull', 'origin', 'main'], {
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    })

    const newSha = getLocalGitSha()
    const output = (stdout + (stderr ? '\n' + stderr : '')).trim()

    return NextResponse.json({
      ok: true,
      output,
      needsRestart: true,
      newSha,
      oldSha: currentSha,
    })
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: 'pull_failed',
        detail: e.message || 'git pull failed',
        stderr: e.stderr || '',
        stdout: e.stdout || '',
      },
      { status: 500 },
    )
  }
}
