// transcriptionService.js - Enhanced Transcription Service
// Handles both short and long calls with automatic chunking
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { 
  splitAudioIntoChunks, 
  isLongAudio, 
  cleanupChunks,
  getAudioMetadata,
  estimateProcessingTime 
} = require('../utils/audioProcessor');
const db = require('../database');

const WHISPER_SERVICE_URL = process.env.WHISPER_SERVICE_URL || 'http://localhost:5000';
const LONG_CALL_THRESHOLD = parseInt(process.env.LONG_CALL_THRESHOLD) || 300; // 5 minutes

/**
 * Transcribe a single audio file (short call)
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<Object>} Transcription result
 */
async function transcribeSingleFile(audioPath) {
  try {
    console.log(`📝 Transcribing: ${path.basename(audioPath)}`);
    
    const formData = new FormData();
    formData.append('audio', fs.createReadStream(audioPath));

    const response = await axios.post(`${WHISPER_SERVICE_URL}/transcribe`, formData, {
      headers: formData.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 120000 // 2 minutes timeout
    });

    if (response.data.success) {
      console.log(`✅ Transcription completed: ${response.data.duration.toFixed(2)}s`);
      return response.data;
    } else {
      throw new Error('Transcription failed - no success flag');
    }
  } catch (error) {
    console.error('❌ Transcription error:', error.message);
    throw error;
  }
}

/**
 * Transcribe long audio by chunking into segments
 * @param {number} callId - Database call ID
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<Object>} Combined transcription result
 */
async function transcribeLongAudio(callId, audioPath) {
  console.log(`🎬 Processing long audio for call ${callId}...`);
  
  const chunkDir = path.join(path.dirname(audioPath), 'chunks');
  
  try {
    // Get audio metadata
    const metadata = await getAudioMetadata(audioPath);
    console.log(`📊 Audio info: ${Math.floor(metadata.duration / 60)}m, ${(metadata.size / 1024 / 1024).toFixed(2)}MB`);
    
    // Estimate processing time
    const estimate = estimateProcessingTime(metadata.duration);
    console.log(`⏱️ Estimated processing time: ~${estimate.totalMinutes} minutes`);
    
    // Split into chunks (4-minute chunks for optimal processing)
    const chunks = await splitAudioIntoChunks(audioPath, 240);
    console.log(`✂️ Created ${chunks.length} chunks`);
    
    let fullTranscription = '';
    const segments = [];
    let totalTranscriptionTime = 0;
    
    // Transcribe each chunk
    for (const chunk of chunks) {
      console.log(`\n📝 Transcribing chunk ${chunk.index + 1}/${chunks.length}...`);
      
      const startTime = Date.now();
      const result = await transcribeSingleFile(chunk.path);
      const processingTime = (Date.now() - startTime) / 1000;
      
      if (result.success) {
        fullTranscription += result.transcription + ' ';
        totalTranscriptionTime += processingTime;
        
        // Save segment to database
        const segmentData = {
          segment_number: chunk.index + 1,
          segment_start_time: Math.floor(chunk.startTime),
          segment_end_time: Math.floor(chunk.startTime + chunk.duration),
          segment_duration: Math.floor(chunk.duration),
          segment_transcription: result.transcription
        };
        
        await db.saveCallSegment(callId, segmentData);
        segments.push(segmentData);
        
        console.log(`✅ Chunk ${chunk.index + 1} done in ${processingTime.toFixed(1)}s`);
      } else {
        console.warn(`⚠️ Chunk ${chunk.index + 1} failed, continuing...`);
      }
    }
    
    // Cleanup chunk files
    cleanupChunks(chunkDir);
    
    const avgTranscriptionTime = totalTranscriptionTime / chunks.length;
    
    console.log(`\n✅ Long audio transcribed successfully!`);
    console.log(`   - Segments: ${chunks.length}`);
    console.log(`   - Total time: ${totalTranscriptionTime.toFixed(1)}s`);
    console.log(`   - Avg per chunk: ${avgTranscriptionTime.toFixed(1)}s`);
    
    return {
      success: true,
      transcription: fullTranscription.trim(),
      segments: segments.length,
      totalDuration: metadata.duration,
      processingTime: totalTranscriptionTime,
      isLongCall: true
    };
    
  } catch (error) {
    console.error('❌ Long audio transcription failed:', error);
    
    // Cleanup on error
    try {
      cleanupChunks(chunkDir);
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup failed:', cleanupError.message);
    }
    
    throw error;
  }
}

/**
 * Main transcription router - handles both short and long calls
 * @param {number} callId - Database call ID
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<Object>} Transcription result
 */
async function transcribeCall(callId, audioPath) {
  try {
    console.log(`\n🎤 Starting transcription for call ${callId}`);
    
    // Check if Whisper service is available
    try {
      await axios.get(`${WHISPER_SERVICE_URL}/health`, { timeout: 2000 });
      console.log('✅ Whisper service is available');
    } catch (healthError) {
      throw new Error('Whisper service not available. Please start: python whisper_server.py');
    }
    
    // Check if audio is long
    const isLong = await isLongAudio(audioPath, LONG_CALL_THRESHOLD);
    
    let result;
    
    if (isLong) {
      console.log(`⏱️ Call ${callId} is LONG - using chunked processing`);
      result = await transcribeLongAudio(callId, audioPath);
    } else {
      console.log(`⏱️ Call ${callId} is SHORT - using direct transcription`);
      result = await transcribeSingleFile(audioPath);
      result.isLongCall = false;
    }
    
    return result;
    
  } catch (error) {
    console.error(`❌ Transcription failed for call ${callId}:`, error.message);
    throw error;
  }
}

/**
 * Check if Whisper service is running
 * @returns {Promise<boolean>} True if service is available
 */
async function checkWhisperService() {
  try {
    const response = await axios.get(`${WHISPER_SERVICE_URL}/health`, { timeout: 2000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Get transcription statistics
 * @param {number} callId - Database call ID
 * @returns {Promise<Object>} Transcription stats
 */
async function getTranscriptionStats(callId) {
  try {
    const query = `
      SELECT 
        ct.word_count,
        ct.transcription_duration,
        ct.confidence_score,
        ct.transcription_quality,
        ct.language_detected,
        (SELECT COUNT(*) FROM call_segments WHERE call_id = $1) as segment_count
      FROM call_transcriptions ct
      WHERE ct.call_id = $1
    `;
    
    const result = await db.pool.query(query, [callId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting transcription stats:', error);
    return null;
  }
}

module.exports = {
  transcribeCall,
  transcribeSingleFile,
  transcribeLongAudio,
  checkWhisperService,
  getTranscriptionStats
};