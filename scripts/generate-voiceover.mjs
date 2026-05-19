#!/usr/bin/env node
/**
 * Generate per-phase voiceover WAV files from Gemini TTS.
 *
 * Phases are defined in src/data/tutorialConstants.js (exported as `PHASES`).
 * Each phase has:
 *   - id          (slug used in the output filename: public/voiceover-<id>.wav)
 *   - audioFile   (the public path the web app fetches)
 *   - script      (the TTS prompt)
 *
 * By default, existing files are skipped so you don't burn API credits.
 * Use `--force` to regenerate all, or `--only <phaseId>` to regenerate one.
 *
 *   node scripts/generate-voiceover.mjs --lang am
 *   node scripts/generate-voiceover.mjs --only kote --lang am
 *   node scripts/generate-voiceover.mjs --force
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PUBLIC_DIR = join(ROOT, 'public')

// ---- CLI args ----
const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const LANG = (() => {
  const idx = args.indexOf('--lang')
  return idx !== -1 ? args[idx + 1] : 'en'
})()
const ONLY = (() => {
  const idx = args.indexOf('--only')
  return idx !== -1 ? args[idx + 1] : null
})()

// ---- .env loader (no extra deps) ----
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

// ---- Extract PHASES array from constants.js (lightweight ESM loader) ----
async function loadPhases() {
  const mod = await import(resolve(ROOT, 'src/data/tutorialConstants.js'))
  if (typeof mod.getPhases !== 'function') {
    throw new Error('Could not find getPhases export in tutorialConstants.js')
  }
  return mod.getPhases(LANG)
}

// ... (skipping unchanged wav helpers and TTS logic) ...

// ---- Audio helpers ----
function base64ToUint8Array(b64) {
  const bin = Buffer.from(b64, 'base64').toString('binary')
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function pcmToWav(pcm, sampleRate) {
  const len = pcm.length
  const wav = new Uint8Array(44 + len)
  const view = new DataView(wav.buffer)
  const w = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }
  w(0, 'RIFF')
  view.setUint32(4, 36 + len, true)
  w(8, 'WAVE')
  w(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  w(36, 'data')
  view.setUint32(40, len, true)
  wav.set(pcm, 44)
  return wav
}

// ---- TTS call ----
async function generatePhaseWav(phase, apiKey) {
  const MODEL = 'gemini-2.5-flash-preview-tts' // optimized for TTS
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

  console.log(`  ... Calling Gemini TTS for: ${phase.id} (${LANG})`)
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: phase.script }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
      },
      model: MODEL,
    }),
  })

  // ... rest of generatePhaseWav in original is fine ...
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${phase.id}: API ${res.status} — ${body.slice(0, 300)}`)
  }

  const data = await res.json()
  const inline = data.candidates?.[0]?.content?.parts?.[0]?.inlineData
  if (!inline?.data) {
    throw new Error(`${phase.id}: no audio data in response`)
  }

  const sampleRate = parseInt(inline.mimeType.match(/rate=(\d+)/)?.[1] ?? '24000', 10)
  return pcmToWav(base64ToUint8Array(inline.data), sampleRate)
}

// ... transcribeWithTimestamps, buildEventTimeline, wavDurationSeconds are mostly unchanged ...

// ---- Audio understanding: ask Gemini to transcribe and timestamp each sentence ----
async function transcribeWithTimestamps(wavBytes, phase, apiKey) {
  const MODEL = 'gemini-flash-latest' 
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

  const b64 = Buffer.from(wavBytes).toString('base64')

  const prompt = `Transcribe this audio into natural sentence-sized segments. \
For each segment, return the start time in seconds (float) and the text spoken. \
Respond with JSON: {"segments":[{"start": <float>, "text": "<string>"}]}.\n\
The expected script (for reference only, match the actual audio timing): "${phase.script}"`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inlineData: { mimeType: 'audio/wav', data: b64 } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            segments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  start: { type: 'number' },
                  text: { type: 'string' },
                },
                required: ['start', 'text'],
              },
            },
          },
          required: ['segments'],
        },
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`transcribe ${phase.id}: API ${res.status} — ${body.slice(0, 300)}`)
  }

  const data = await res.json()
  const txt = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!txt) throw new Error(`transcribe ${phase.id}: no text in response`)

  const parsed = JSON.parse(txt)
  if (!Array.isArray(parsed.segments) || parsed.segments.length === 0) {
    throw new Error(`transcribe ${phase.id}: no segments returned`)
  }
  return parsed.segments.sort((a, b) => a.start - b.start)
}

// ... normalize, firstWords, buildEventTimeline unchanged ...

// ---- Get actual WAV duration from header (avoids spawning ffprobe) ----
function wavDurationSeconds(wavBytes) {
  const view = new DataView(wavBytes.buffer || wavBytes)
  const byteRate = view.getUint32(28, true)
  const dataSize = view.getUint32(40, true)
  return dataSize / byteRate
}

// ---- Main ----
async function main() {
  const env = loadEnv()
  const apiKey = process.env.VITE_GEMINI_API_KEY || env.VITE_GEMINI_API_KEY
  if (!apiKey) {
    console.error('✗ No VITE_GEMINI_API_KEY found in .env or environment.')
    process.exit(1)
  }

  console.log(`\n--- Starting Voiceover Generation [Lang: ${LANG}] ---`)

  const phases = await loadPhases()
  const targets = ONLY ? phases.filter((p) => p.id === ONLY) : phases
  if (ONLY && targets.length === 0) {
    console.error(`✗ No phase with id "${ONLY}". Available:`, phases.map((p) => p.id).join(', '))
    process.exit(1)
  }

  let generated = 0
  let skipped = 0
  let timelineRegenerated = 0
  for (const phase of targets) {
    // Determine path from phase.audioFile if local, otherwise fallback to voiceover-<id>.wav
    let filename = `voiceover-${phase.id}.wav`
    let jsonName = `voiceover-${phase.id}.json`
    
    if (phase.audioFile && phase.audioFile.startsWith('/')) {
      filename = phase.audioFile.startsWith('/') ? phase.audioFile.slice(1) : phase.audioFile
      jsonName = filename.replace('.wav', '.json').replace('.mp3', '.json')
    } else if (LANG !== 'en') {
        // Force language subfolder for non-english to avoid collisions
        filename = `audio/${LANG}/voiceover-${phase.id}.wav`
        jsonName = `audio/${LANG}/voiceover-${phase.id}.json`
    }

    const outPath = join(PUBLIC_DIR, filename)
    const jsonPath = join(PUBLIC_DIR, jsonName)

    // Ensure directory exists
    mkdirSync(dirname(outPath), { recursive: true })

    let wav
    const wavExists = existsSync(outPath)
    if (wavExists && !FORCE) {
      console.log(`⊙ ${filename} exists — skipped (use --force to regenerate)`)
      skipped++
      wav = readFileSync(outPath)
    } else {
      console.log(`⏳ Generating ${filename} (${phase.title})...`)
      try {
        wav = await generatePhaseWav(phase, apiKey)
        writeFileSync(outPath, wav)
        console.log(`✓ Saved ${filename} (${(wav.length / 1024).toFixed(0)} KB)`)
        generated++
      } catch (err) {
        console.error(`  ✗ Failed to generate audio for ${phase.id}: ${err.message}`)
        continue
      }
    }

    // Sidecar timeline
    const needsTimeline = !existsSync(jsonPath) || !wavExists || FORCE
    if (!needsTimeline) {
      console.log(`⊙ ${jsonName} exists — skipped`)
      continue
    }

    console.log(`⏳ Transcribing ${filename} for sentence timestamps...`)
    try {
      const segments = await transcribeWithTimestamps(wav, phase, apiKey)
      const duration = wavDurationSeconds(wav)
      const events = buildEventTimeline(phase, segments, duration)
      writeFileSync(
        jsonPath,
        JSON.stringify({ id: phase.id, duration, segments, events }, null, 2)
      )
      console.log(`✓ Saved ${jsonName} (${segments.length} segments, ${events.length} events)`)
      timelineRegenerated++
    } catch (err) {
      console.warn(`  ⚠ Timeline generation failed for ${phase.id}: ${err.message}`)
    }
  }

  console.log(
    `\nDone. Audio generated: ${generated}, skipped: ${skipped}. Timelines: ${timelineRegenerated}.`
  )
}

main().catch((err) => {
  console.error('✗', err.message || err)
  process.exit(1)
})
