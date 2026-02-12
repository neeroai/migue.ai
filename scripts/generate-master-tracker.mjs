#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { parseSpecs, validateSpecsContract, generateMasterTrackerContent } from './tracker-core.mjs'

function nowLocalStamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const checkOnly = process.argv.includes('--check')
const root = process.cwd()
const outputPath = path.join(root, 'docs', 'master-tracker.md')
const specs = parseSpecs(root)
const violations = validateSpecsContract(specs)

if (violations.length > 0) {
  console.error('Master tracker generation failed: specs contract violations')
  for (const item of violations) console.error(`- ${item}`)
  process.exit(1)
}

const nextContent = generateMasterTrackerContent(specs, nowLocalStamp())

function normalizeGeneratedStamp(content) {
  return content.replace(/^> Generated: .*$/m, '> Generated: <dynamic>')
}

if (checkOnly) {
  if (!existsSync(outputPath)) {
    console.error('docs/master-tracker.md is missing. Run: just sync-master')
    process.exit(1)
  }
  const current = readFileSync(outputPath, 'utf8')
  if (normalizeGeneratedStamp(current) !== normalizeGeneratedStamp(nextContent)) {
    console.error('docs/master-tracker.md is out of sync. Run: just sync-master')
    process.exit(1)
  }
  console.log('master-tracker check passed')
  process.exit(0)
}

writeFileSync(outputPath, nextContent, 'utf8')
console.log(`Master tracker generated: ${path.relative(root, outputPath)}`)
