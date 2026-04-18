import { base64ToUint8Array, pcmToWav } from '../utils/audio'

const MODEL_TEXT = 'gemini-2.5-flash'
const MODEL_TTS = 'gemini-2.5-flash-preview-tts'

function getKey() {
  const k = import.meta.env.VITE_GEMINI_API_KEY
  return typeof k === 'string' ? k.trim() : ''
}

export function hasGeminiApiKey() {
  return Boolean(getKey())
}

/**
 * @param {string} userMessage
 * @returns {Promise<{ text: string; error?: string }>}
 */
export async function askGeminiChat(userMessage) {
  const key = getKey()
  if (!key) {
    return {
      text: 'Add VITE_GEMINI_API_KEY in a .env file (see .env.example) to enable the assistant.',
      error: 'NO_KEY',
    }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_TEXT}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: 'You are the AI assistant for FellowFlow conference registration. Keep answers brief and friendly.',
          },
        ],
      },
      contents: [{ parts: [{ text: userMessage }] }],
    }),
  })

  let data = {}
  try {
    data = await res.json()
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    const msg = data?.error?.message || `Request failed (${res.status})`
    return { text: `Sorry — ${msg}`, error: 'API' }
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  return {
    text: text || "I'm having trouble connecting to my AI brain.",
    error: null,
  }
}

/**
 * @param {string} script
 * @returns {Promise<{ blobUrl: string | null; error?: string }>}
 */
export async function generateTtsWavObjectUrl(script) {
  const key = getKey()
  if (!key) {
    return { blobUrl: null, error: 'NO_KEY' }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_TTS}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: script }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
      },
      model: MODEL_TTS,
    }),
  })

  let data = {}
  try {
    data = await res.json()
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    const msg = data?.error?.message || `TTS request failed (${res.status})`
    return { blobUrl: null, error: msg }
  }

  const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData
  if (!inlineData?.data || !inlineData?.mimeType) {
    return { blobUrl: null, error: 'No audio in response' }
  }

  const rateMatch = inlineData.mimeType.match(/rate=(\d+)/)
  const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000
  const wavData = pcmToWav(base64ToUint8Array(inlineData.data), sampleRate)
  const blob = new Blob([wavData], { type: 'audio/wav' })
  const blobUrl = URL.createObjectURL(blob)
  return { blobUrl, error: null }
}
