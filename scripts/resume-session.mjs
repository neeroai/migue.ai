#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parseSpecs } from './tracker-core.mjs'

const root = process.cwd()
const handoffPath = path.join(root, '.claude', 'handoff.md')
const masterPath = path.join(root, 'docs', 'master-tracker.md')

function printSection(title) {
  console.log(`\n=== ${title} ===`)
}

function parsePriority(specRows) {
  const score = { RED: 0, YELLOW: 1, GREEN: 2 }
  return [...specRows]
    .sort((a, b) => {
      const da = score[a.semaforo] ?? 9
      const db = score[b.semaforo] ?? 9
      if (da !== db) return da - db
      return a.id.localeCompare(b.id)
    })
    .filter((row) => row.semaforo === 'RED' || row.semaforo === 'YELLOW')
    .slice(0, 8)
}

printSection('Session Resume')
if (existsSync(handoffPath)) {
  console.log(readFileSync(handoffPath, 'utf8').trim())
} else {
  console.log('No handoff found at .claude/handoff.md')
  console.log('Create one with: just checkpoint objective="..." last="..." next="step1|step2"')
}

printSection('Master Tracker Status')
if (existsSync(masterPath)) {
  const specRows = parseSpecs(root)
  const top = parsePriority(specRows)
  if (top.length === 0) {
    console.log('No RED/YELLOW specs. System is fully GREEN.')
  } else {
    console.log('Top priorities (RED/YELLOW):')
    for (const row of top) {
      console.log(`- [${row.semaforo}] ${row.id} ${row.feature} -> ${row.nextStep}`)
    }
  }
  console.log('\nSource: docs/master-tracker.md')
} else {
  console.log('master-tracker missing. Run: just sync-master')
}
