#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

function parseArgs(argv) {
  const out = {}
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
    out[key] = value
  }
  return out
}

function nowLocalStamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function asList(raw, separators = /[|,]/) {
  if (!raw) return []
  return String(raw)
    .split(separators)
    .map((s) => s.trim())
    .filter(Boolean)
}

function asBullets(items, emptyText = '- (none)') {
  if (!items.length) return `${emptyText}\n`
  return `${items.map((item) => `- ${item}`).join('\n')}\n`
}

const args = parseArgs(process.argv)
const objective = (args.objective ?? '').trim()
const last = (args.last ?? '').trim()
const nextSteps = asList(args.next)
const blockers = asList(args.blockers)
const files = asList(args.files)
const commands = asList(args.commands, /[,]/)

if (!objective || !last || nextSteps.length === 0) {
  console.error('Usage:')
  console.error(
    '  just checkpoint objective="..." last="..." next="step1|step2" [blockers="b1|b2"] [files="f1,f2"] [commands="cmd1|cmd2"]'
  )
  process.exit(1)
}

const root = process.cwd()
const handoffPath = path.join(root, '.claude', 'handoff.md')
const timestamp = nowLocalStamp()

const content = `---
title: "Session Handoff"
updated: "${timestamp}"
---

# Session Handoff

## Current Objective
${objective}

## Last Completed
${last}

## Next Steps
${nextSteps.map((step, idx) => `${idx + 1}. ${step}`).join('\n')}

## Blockers
${asBullets(blockers)}
## Key Files
${asBullets(files)}
## Useful Commands
${asBullets(commands)}
## Resume Command
\`just resume\`
`

fs.mkdirSync(path.dirname(handoffPath), { recursive: true })
fs.writeFileSync(handoffPath, content, 'utf8')

console.log(`Checkpoint saved: ${path.relative(root, handoffPath)}`)
