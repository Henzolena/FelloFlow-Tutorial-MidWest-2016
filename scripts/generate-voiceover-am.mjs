#!/usr/bin/env node
/**
 * Generate Amharic per-phase voiceover WAV files from Gemini TTS.
 * Uses `scriptAm` from each phase in tutorialConstants.js.
 * Outputs to public/audio/am/voiceover-<id>.wav
 *
 *   node scripts/generate-voiceover-am.mjs
 *   node scripts/generate-voiceover-am.mjs --only kote
 *   node scripts/generate-voiceover-am.mjs --force
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = join(ROOT, 'public', 'audio', 'am')

mkdirSync(OUT_DIR, { recursive: true })

const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const ONLY = (() => {
  const idx = args.indexOf('--only')
  return idx !== -1 ? args[idx + 1] : null
})()

function loadEnv() {
  const envPath = resolve(ROOT, '.env')
  if (!existsSync(envPath)) return {}
  const env = {}
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return env
}

async function loadPhases() {
  const mod = await import(resolve(ROOT, 'src/data/tutorialConstants.js'))
  if (!Array.isArray(mod.PHASES)) throw new Error('No PHASES export found')
  return mod.PHASES
}

function base64ToUint8Array(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function pcmToWav(pcm, sampleRate) {
  const len = pcm.length
  const wav = new Uint8Array(44 + len)
  const view = new DataView(wav.buffer)
  const w = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }
  w(0, 'RIFF'); view.setUint32(4, 36 + len, true); w(8, 'WAVE')
  w(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true)
  view.setUint16(34, 16, true); w(36, 'data'); view.setUint32(40, len, true)
  wav.set(pcm, 44)
  return wav
}

async function generateWav(script, apiKey) {
  const MODEL = 'gemini-2.5-flash-preview-tts'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: script }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
        },
      }),
    }
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`TTS API ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = await res.json()
  const inline = data.candidates?.[0]?.content?.parts?.[0]?.inlineData
  if (!inline?.data) throw new Error('No audio data in response')
  const sampleRate = parseInt(inline.mimeType.match(/rate=(\d+)/)?.[1] ?? '24000', 10)
  return pcmToWav(base64ToUint8Array(inline.data), sampleRate)
}

async function main() {
  const env = loadEnv()
  const apiKey = process.env.VITE_GEMINI_API_KEY || env.VITE_GEMINI_API_KEY
  if (!apiKey) {
    console.error('✗ No VITE_GEMINI_API_KEY found in .env or environment.')
    process.exit(1)
  }

  const phases = await loadPhases()
  const targets = ONLY ? phases.filter((p) => p.id === ONLY) : phases
  if (ONLY && targets.length === 0) {
    console.error(`✗ No phase "${ONLY}". Available:`, phases.map((p) => p.id).join(', '))
    process.exit(1)
  }

  let generated = 0
  let skipped = 0

  for (const phase of targets) {
    if (!phase.scriptAm) {
      console.log(`⊙ ${phase.id}: no scriptAm defined — skipped`)
      continue
    }

    const filename = `voiceover-${phase.id}.wav`
    const outPath = join(OUT_DIR, filename)

    if (existsSync(outPath) && !FORCE) {
      console.log(`⊙ am/${filename} exists — skipped (use --force to regenerate)`)
      skipped++
      continue
    }

    console.log(`⏳ Generating Amharic audio for ${phase.id} (${phase.title})...`)
    try {
      const wav = await generateWav(phase.scriptAm, apiKey)
      writeFileSync(outPath, wav)
      const secs = ((wav.length - 44) / (24000 * 2)).toFixed(1)
      console.log(`✓ Saved am/${filename} (${(wav.length / 1024).toFixed(0)} KB, ~${secs}s)`)
      generated++
    } catch (err) {
      console.error(`✗ ${phase.id}: ${err.message}`)
    }
  }

  console.log(`\nDone. Generated: ${generated}, skipped: ${skipped}.`)
  console.log('\nNext step — upload to Supabase:')
  console.log('  cd /Users/henokrobale/FellowFlow-Tutorial')
  const phases2 = await loadPhases()
  for (const p of phases2) {
    if (p.scriptAm) {
      console.log(`  supabase storage cp public/audio/am/voiceover-${p.id}.wav "ss:///audio/am/voiceover-${p.id}.wav" --experimental`)
    }
  }
}

main().catch((err) => { console.error('✗', err.message); process.exit(1) })
