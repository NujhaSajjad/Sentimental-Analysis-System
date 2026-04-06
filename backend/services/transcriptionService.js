// transcriptionService.js
// ─────────────────────────────────────────────────────────────────────────────
// Sends the full audio file directly to the Python Gladia transcription service.
// Gladia handles transcription + diarization (agent vs customer) natively.
// No local chunking needed — Gladia processes the file server-side.
// ─────────────────────────────────────────────────────────────────────────────

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const GLADIA_SERVICE_URL = process.env.WHISPER_SERVICE_URL || 'http://localhost:5000';

// 10 minutes — Gladia is cloud-based but long calls may still take time to upload + process
const TRANSCRIBE_TIMEOUT_MS = parseInt(process.env.GLADIA_TIMEOUT_MS || process.env.WHISPER_TIMEOUT_MS) || 600_000;

/**
 * Transcribe an audio file using the Gladia-powered Python service.
 * Sends the full file in one request. Gladia handles upload, transcription,
 * and diarization (Speaker 1 = Agent, Speaker 2 = Customer) server-side.
 *
 * @param {string} audioPath  - Absolute path to the audio file on disk
 * @returns {Promise<Object>} - { success, transcription, utterances, language, duration, ... }
 */
async function transcribeFile(audioPath) {
  const filename = path.basename(audioPath);
  console.log(`\n🎤 [transcriptionService] Sending to Gladia: ${filename}`);

  const form = new FormData();
  form.append('audio', fs.createReadStream(audioPath), { filename });

  const response = await axios.post(`${GLADIA_SERVICE_URL}/transcribe`, form, {
    headers: {
      ...form.getHeaders(),
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: TRANSCRIBE_TIMEOUT_MS,
  });

  if (!response.data.success) {
    throw new Error(`Gladia service returned failure: ${JSON.stringify(response.data)}`);
  }

  const { transcription, language, duration, chunks_processed, word_count } = response.data;
  console.log(`✅ Gladia transcription done | ${duration}s | ${chunks_processed} utterances | lang=${language} | ${word_count} words`);

  return response.data;
}

/**
 * Main entry point — transcribes any call (short or long).
 * The Python service auto-adjusts chunking based on audio length.
 *
 * @param {number} callId    - Database call ID (used for logging only)
 * @param {string} audioPath - Absolute path to audio file
 * @returns {Promise<Object>}
 */
async function transcribeCall(callId, audioPath) {
  console.log(`\n📞 [transcribeCall → Gladia] call_id=${callId}`);

  // Quick health check before spending time uploading
  try {
    await axios.get(`${GLADIA_SERVICE_URL}/health`, { timeout: 3000 });
    console.log('✅ Gladia service available');
  } catch {
    throw new Error(
      'Gladia service is not running. Start it with: python whisper_server.py (now Gladia-powered)'
    );
  }

  const result = await transcribeFile(audioPath);
  return result;
}

/**
 * Check if the Gladia transcription service is reachable.
 * @returns {Promise<boolean>}
 */
async function checkWhisperService() {
  try {
    const res = await axios.get(`${GLADIA_SERVICE_URL}/health`, { timeout: 3000 });
    return res.status === 200;
  } catch {
    return false;
  }
}

module.exports = {
  transcribeCall,
  transcribeFile,
  checkWhisperService,
};