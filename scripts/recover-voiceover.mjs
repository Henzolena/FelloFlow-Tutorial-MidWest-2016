#!/usr/bin/env node
/**
 * Recover all voiceover files with delays to avoid rate limits.
 * This script regenerates missing voiceover files one by one with pauses.
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const PHASES = [
  'attendance', 'kote', 'child', 'infant', 'checkout', 'badges', 'meals'
]

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function regenerateVoiceover(phaseId) {
  console.log(`\n=== Regenerating voiceover-${phaseId} ===`)
  
  try {
    execSync(`node scripts/generate-voiceover.mjs --only ${phaseId}`, {
      cwd: ROOT,
      stdio: 'inherit'
    })
    console.log(`\n\n=== Waiting 30 seconds to avoid rate limits ===\n`)
    await sleep(30000) // 30 second delay
  } catch (error) {
    console.error(`Failed to generate ${phaseId}:`, error.message)
  }
}

async function main() {
  console.log('Recovering voiceover files...\n')
  
  for (const phaseId of PHASES) {
    await regenerateVoiceover(phaseId)
  }
  
  console.log('\n=== Voiceover recovery complete ===')
}

main().catch(console.error)
