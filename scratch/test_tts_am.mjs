
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Basic .env loader
function loadEnv() {
  const envPath = resolve(ROOT, '.env');
  try {
    const content = readFileSync(envPath, 'utf-8');
    const env = {};
    content.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length === 2) env[parts[0].trim()] = parts[1].trim();
    });
    return env;
  } catch (e) { return {}; }
}

const env = loadEnv();
const API_KEY = env.VITE_GEMINI_API_KEY;

async function testAmharicTts() {
  if (!API_KEY) {
    console.error('No API Key found');
    return;
  }

  const script = "ሰላም፣ እንኳን ወደ ፌሎው ፍሎው በደህና መጡ።";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent`;
  
  console.log('Testing Amharic TTS...');
  
  const res = await fetch(url + `?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: script }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('TTS Failed:', data);
    return;
  }

  const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (inlineData?.data) {
    console.log('SUCCESS: Received Amharic Audio data!');
    writeFileSync(resolve(ROOT, 'scratch/test-am.wav'), Buffer.from(inlineData.data, 'base64'));
    console.log('Saved to scratch/test-am.wav');
  } else {
    console.warn('No audio data received. Might not support Amharic for this voice.');
    console.log(JSON.stringify(data, null, 2));
  }
}

testAmharicTts();
