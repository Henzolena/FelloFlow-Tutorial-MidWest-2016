#!/usr/bin/env node
/**
 * Create silent placeholder voiceover files for immediate deployment.
 */

import { writeFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = dirname(__dirname)
const PUBLIC_DIR = join(ROOT, 'public')

const PHASES = [
  'attendance', 'kote', 'child', 'infant', 'checkout', 'badges', 'meals'
]

// Create a simple silent WAV file (44.1kHz, 16-bit, mono)
function createSilentWav(durationSeconds) {
  const sampleRate = 44100
  const bytesPerSample = 2
  const channels = 1
  const byteRate = sampleRate * channels * bytesPerSample
  const blockAlign = channels * bytesPerSample
  const dataSize = durationSeconds * sampleRate * bytesPerSample
  const fileSize = 36 + dataSize

  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(fileSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16) // fmt chunk size
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(16, 34) // bits per sample
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)

  const silent = Buffer.alloc(dataSize)
  return Buffer.concat([header, silent])
}

// Create basic JSON timeline
function createBasicJson(phaseId, durationMs) {
  return JSON.stringify({
    duration: durationMs,
    segments: [{
      start: 0,
      end: durationMs,
      text: `Voiceover for ${phaseId} phase`
    }],
    events: [{
      time: 0,
      type: 'start'
    }, {
      time: 100,
      type: 'highlight',
      target: phaseId
    }]
  }, null, 2)
}

// Main generation
for (const phaseId of PHASES) {
  const wavPath = join(PUBLIC_DIR, `voiceover-${phaseId}.wav`)
  const jsonPath = join(PUBLIC_DIR, `voiceover-${phaseId}.json`)
  
  // Create 30-second silent audio
  const wavData = createSilentWav(30)
  writeFileSync(wavPath, wavData)
  console.log(`Created ${wavPath}`)
  
  // Create basic timeline
  const jsonData = createBasicJson(phaseId, 30000)
  writeFileSync(jsonPath, jsonData)
  console.log(`Created ${jsonPath}`)
}

console.log('\n=== Placeholder voiceover files created ===')
console.log('All phases now have silent audio and basic timelines')
