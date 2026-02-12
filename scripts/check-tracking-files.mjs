import { existsSync, readFileSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { parseSpecs, validateSpecsContract } from './tracker-core.mjs'

const TRACKING_LIMITS = [
  { path: '.claude/session.md', maxLines: 180, maxBytes: 24_000 },
  { path: '.claude/status.md', maxLines: 120, maxBytes: 16_000 },
  { path: '.claude/decisions.md', maxLines: 420, maxBytes: 64_000 },
  { path: '.claude/todo.md', maxLines: 100, maxBytes: 10_000 },
  { path: '.claude/CHANGELOG.md', maxLines: 320, maxBytes: 52_000 },
  { path: 'CHANGELOG.md', maxLines: 240, maxBytes: 40_000 },
]

const ANTI_ACCUMULATION_RULES = [
  {
    path: '.claude/session.md',
    description: 'keep at most 4 detailed session blocks',
    pattern: /^## Session - /gm,
    maxMatches: 4,
  },
  {
    path: '.claude/todo.md',
    description: 'keep completed items compact (max 20)',
    pattern: /^- \[x\] /gm,
    maxMatches: 20,
  },
  {
    path: '.claude/decisions.md',
    description: 'keep full ADR entries compact (max 10)',
    pattern: /^## ADR-/gm,
    maxMatches: 10,
  },
  {
    path: '.claude/CHANGELOG.md',
    description: 'keep detailed dated sections compact (max 16)',
    pattern: /^### (Added|Changed|Fixed|Removed|Security) - /gm,
    maxMatches: 16,
  },
]

const CRITICAL_PATH_REGEX = /^(app\/api\/|src\/modules\/|supabase\/migrations\/)/
const CONTINUITY_PATH_REGEX = /^(?:\.claude\/handoff\.md|docs\/master-tracker\.md|specs\/.*\.md|\.claude\/session\.md|\.claude\/todo\.md|\.claude\/status\.md|\.claude\/decisions\.md|CHANGELOG\.md)$/

function lineCount(content) {
  if (!content) return 0
  return content.split('\n').length
}

function getStagedFiles() {
  const res = spawnSync('git', ['diff', '--cached', '--name-only'], {
    encoding: 'utf8',
  })
  if (res.status !== 0) return []
  return res.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function runMasterTrackerSyncCheck() {
  const result = spawnSync('node', ['scripts/generate-master-tracker.mjs', '--check'], {
    encoding: 'utf8',
  })
  return {
    ok: result.status === 0,
    output: `${result.stdout || ''}${result.stderr || ''}`.trim(),
  }
}

const violations = []
const accumulationViolations = []
const contractViolations = []

for (const limit of TRACKING_LIMITS) {
  try {
    const content = readFileSync(limit.path, 'utf8')
    const stats = statSync(limit.path)
    const lines = lineCount(content)
    const bytes = stats.size

    if (lines > limit.maxLines || bytes > limit.maxBytes) {
      violations.push({ ...limit, lines, bytes })
    }
  } catch (error) {
    violations.push({
      ...limit,
      lines: -1,
      bytes: -1,
      error: error instanceof Error ? error.message : 'unknown error while reading file',
    })
  }
}

for (const rule of ANTI_ACCUMULATION_RULES) {
  try {
    const content = readFileSync(rule.path, 'utf8')
    const count = (content.match(rule.pattern) || []).length
    if (count > rule.maxMatches) accumulationViolations.push({ ...rule, count })
  } catch (error) {
    accumulationViolations.push({
      ...rule,
      count: -1,
      error: error instanceof Error ? error.message : 'unknown error while reading file',
    })
  }
}

if (!existsSync('.claude/handoff.md')) {
  contractViolations.push('Missing .claude/handoff.md. Run: just checkpoint objective="..." last="..." next="step1|step2"')
}

const specs = parseSpecs(process.cwd())
for (const item of validateSpecsContract(specs)) {
  contractViolations.push(item)
}

const masterCheck = runMasterTrackerSyncCheck()
if (!masterCheck.ok) {
  contractViolations.push(masterCheck.output || 'docs/master-tracker.md is out of sync')
}

const stagedFiles = getStagedFiles()
const criticalTouched = stagedFiles.some((file) => CRITICAL_PATH_REGEX.test(file))
if (criticalTouched) {
  const continuityTouched = stagedFiles.some((file) => CONTINUITY_PATH_REGEX.test(file))
  if (!continuityTouched) {
    contractViolations.push(
      'Critical paths changed but no continuity artifact updated in index (.claude/handoff.md, docs/master-tracker.md, specs/*.md, .claude/*, CHANGELOG.md).'
    )
  }
}

if (violations.length > 0 || accumulationViolations.length > 0 || contractViolations.length > 0) {
  console.error('Tracking file checks failed.\n')

  if (violations.length > 0) {
    console.error('Size violations:')
    for (const v of violations) {
      if (v.lines === -1) {
        console.error(`- ${v.path}: ${v.error}`)
        continue
      }
      console.error(
        `- ${v.path}: ${v.lines} lines / ${v.bytes} bytes (limit ${v.maxLines} lines / ${v.maxBytes} bytes)`
      )
    }
    console.error('')
  }

  if (accumulationViolations.length > 0) {
    console.error('Accumulation violations:')
    for (const v of accumulationViolations) {
      if (v.count === -1) {
        console.error(`- ${v.path}: ${v.error}`)
        continue
      }
      console.error(`- ${v.path}: ${v.count} matches for "${v.description}" (max ${v.maxMatches})`)
    }
    console.error('')
  }

  if (contractViolations.length > 0) {
    console.error('Contract violations:')
    for (const v of contractViolations) console.error(`- ${v}`)
    console.error('')
  }

  console.error('How to fix:')
  console.error('- Run: just sync-master')
  console.error('- Run: just check-tracking')
  console.error('- Ensure each spec has Semáforo/Fase/Next Step/Updated')
  console.error('- Keep .claude/handoff.md updated at session close')
  process.exit(1)
}

console.log('Tracking checks passed.')
