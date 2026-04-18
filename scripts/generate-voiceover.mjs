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
 *   node scripts/generate-voiceover.mjs
 *   node scripts/generate-voiceover.mjs --only kote
 *   node scripts/generate-voiceover.mjs --force
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PUBLIC_DIR = join(ROOT, 'public')

// ---- CLI args ----
const args = process.argv.slice(2)
const FORCE = args.includes('--force')
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
  // Dynamic import of the ESM source. Works because constants has no React imports.
  const mod = await import(resolve(ROOT, 'src/data/tutorialConstants.js'))
  if (!Array.isArray(mod.PHASES)) {
    throw new Error('Could not find PHASES export in tutorialConstants.js')
  }
  return mod.PHASES
}

// ---- Audio helpers ----
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
  const MODEL = 'gemini-2.5-flash-preview-tts'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

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

// ---- Audio understanding: ask Gemini to transcribe and timestamp each sentence ----
async function transcribeWithTimestamps(wavBytes, phase, apiKey) {
  const MODEL = 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

  // Convert WAV to base64 for inline upload (fine for files up to ~20MB)
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

// ---- Match each scripted event to the closest transcribed segment ----
function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}
function firstWords(s, n) {
  return normalize(s).split(' ').slice(0, n).join(' ')
}

function buildEventTimeline(phase, segments, audioDurationSec) {
  // --- Phase 1: assign each event to a segment index (may repeat) -----------
  // Gemini's segmentation varies run-to-run. Sometimes two scripted sentences
  // are merged into one segment. We therefore allow multiple events to map to
  // the same segment, and we don't forcibly advance the cursor past it.
  const segMap = new Array(phase.events.length).fill(-1)
  const segEnds = segments.map((s, idx) =>
    idx + 1 < segments.length ? segments[idx + 1].start : audioDurationSec
  )
  let cursor = 0
  for (let i = 0; i < phase.events.length; i++) {
    const evWords = normalize(phase.events[i].text).split(' ').filter(Boolean)
    let matchIdx = -1
    for (const n of [6, 5, 4, 3, 2, 1]) {
      const key = evWords.slice(0, n).join(' ')
      if (!key) continue
      for (let j = cursor; j < segments.length; j++) {
        const segNorm = normalize(segments[j].text)
        if (segNorm.startsWith(key) || segNorm.includes(key)) {
          matchIdx = j
          break
        }
      }
      if (matchIdx !== -1) break
    }
    segMap[i] = matchIdx
    if (matchIdx !== -1) cursor = matchIdx // don't skip past; next event may share segment
  }

  // --- Phase 2: compute voice timestamps -----------------------------------
  // For events that share a segment, distribute their start times proportionally
  // within that segment's span (using word-count ratio of the event prefix).
  const out = []
  for (let i = 0; i < phase.events.length; i++) {
    const ev = phase.events[i]
    const segIdx = segMap[i]
    let voiceSec
    if (segIdx !== -1) {
      // Group consecutive events that fell into this same segment
      const groupStart = (() => {
        let k = i
        while (k > 0 && segMap[k - 1] === segIdx) k--
        return k
      })()
      const groupEnd = (() => {
        let k = i
        while (k + 1 < segMap.length && segMap[k + 1] === segIdx) k++
        return k
      })()
      const groupSize = groupEnd - groupStart + 1
      const posInGroup = i - groupStart
      const segStart = segments[segIdx].start
      const segEnd = segEnds[segIdx]
      const segSpan = Math.max(0.1, segEnd - segStart)
      voiceSec = segStart + segSpan * (posInGroup / groupSize)
    } else {
      const prevPct = out.length ? (out[out.length - 1].subtitlePct ?? out[out.length - 1].pct) : 0
      const remaining = phase.events.length - i
      const tailSpan = 1 - prevPct
      const pctStep = tailSpan / (remaining + 1)
      voiceSec = (prevPct + pctStep) * audioDurationSec
      console.warn(`  ⚠ ${phase.id} event step=${ev.step}: no match; estimated @ ${voiceSec.toFixed(2)}s`)
    }

    // Optional leadMs: fire the *visual* step early to pre-start CSS
    // transitions so the new slide is in place as the voice arrives at its
    // cue. The subtitle still waits for the voice.
    const leadSec = typeof ev.leadMs === 'number' && ev.leadMs > 0 ? ev.leadMs / 1000 : 0
    const visualSec = Math.max(0, voiceSec - leadSec)

    // Ensure strict monotonicity on both tracks
    let finalVisualSec = visualSec
    if (out.length && finalVisualSec <= out[out.length - 1].pct * audioDurationSec) {
      finalVisualSec = out[out.length - 1].pct * audioDurationSec + 0.05
    }
    let finalVoiceSec = voiceSec
    const prevSub = out.length ? (out[out.length - 1].subtitlePct ?? out[out.length - 1].pct) : 0
    if (finalVoiceSec <= prevSub * audioDurationSec) {
      finalVoiceSec = prevSub * audioDurationSec + 0.05
    }

    out.push({
      step: ev.step,
      text: ev.text,
      pct: Math.min(0.999, Math.max(0, finalVisualSec / audioDurationSec)),
      subtitlePct: Math.min(0.999, Math.max(0, finalVoiceSec / audioDurationSec)),
    })
  }
  return out
}

// ---- Get actual WAV duration from header (avoids spawning ffprobe) ----
function wavDurationSeconds(wavBytes) {
  const view = new DataView(wavBytes.buffer || wavBytes)
  // fmt chunk begins at byte 12. Sample rate at offset 24, byte rate at 28.
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
    const filename = `voiceover-${phase.id}.wav`
    const jsonName = `voiceover-${phase.id}.json`
    const outPath = join(PUBLIC_DIR, filename)
    const jsonPath = join(PUBLIC_DIR, jsonName)

    let wav
    const wavExists = existsSync(outPath)
    if (wavExists && !FORCE) {
      console.log(`⊙ ${filename} exists — skipped (use --force to regenerate)`)
      skipped++
      wav = readFileSync(outPath)
    } else {
      console.log(`⏳ Generating ${filename} (${phase.title})...`)
      wav = await generatePhaseWav(phase, apiKey)
      writeFileSync(outPath, wav)
      console.log(`✓ Saved ${filename} (${(wav.length / 1024).toFixed(0)} KB)`)
      generated++
    }

    // Sidecar timeline: regenerate if WAV was just created, JSON missing, or --force
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
      console.warn(`    App will fall back to hardcoded pcts in PHASES.`)
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
