const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');
const db = require('../database');
const transcriptionService = require('../services/transcriptionService');
const analysisService = require('../services/analysisService');
const { generateReportPDF } = require('../utils/pdfGenerator');

// Retry config for background DB saves
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Diarize call transcription into Agent/Customer turns using AI
 * POST /api/analysis/diarize/:callId
 */
router.post('/diarize/:callId', async (req, res) => {
    try {
        const callId = parseInt(req.params.callId);
        console.log(`\n💬 Starting diarization for call ${callId}`);

        const call = await db.getCallReport(callId);
        if (!call || !call.transcription_text) {
            return res.status(404).json({ success: false, error: 'Call or transcription not found' });
        }

        const turns = await analysisService.diarizeConversation(call.transcription_text);
        await db.saveDiarization(callId, turns);

        res.json({
            success: true,
            callId,
            turns,
            turnCount: turns.length
        });
    } catch (error) {
        console.error('❌ Diarization route error:', error.message);
        res.status(500).json({ success: false, error: 'Diarization failed', details: error.message });
    }
});


/**
 * Transcribe audio
 * POST /api/analysis/transcribe/:callId
 */
router.post('/transcribe/:callId', async (req, res) => {
    try {
        const callId = parseInt(req.params.callId);
        console.log(`\n🎤 Starting transcription for call ${callId}`);

        const call = await db.getCallById(callId);
        if (!call) return res.status(404).json({ success: false, error: 'Call not found' });

        if (!fs.existsSync(call.audio_filepath)) {
            throw new Error('Audio file not found on disk');
        }

        const result = await transcriptionService.transcribeCall(callId, call.audio_filepath);

        await db.saveTranscription(callId, {
            text: result.transcription,
            duration: result.duration,
            confidence: 0.95,
            language: result.language || 'ur+en'  // use auto-detected language(s)
        });

        await db.updateCallStatus(callId, 'transcribed', {
            duration: Math.floor(result.duration || 0)
        });

        // If Gladia returned native diarization, save it immediately so the
        // diarize step in process-complete can be skipped.
        if (result.utterances && result.utterances.length > 0) {
            // Map Gladia speakers (Speaker 1/2) to Agent/Customer convention
            const turns = result.utterances.map(u => ({
                speaker: u.speaker === 'Speaker 1' ? 'Agent' : 'Customer',
                text: u.text
            }));
            try {
                await db.saveDiarization(callId, turns);
                console.log(`✅ Gladia diarization saved (${turns.length} turns) for call ${callId}`);
            } catch (diarErr) {
                console.warn('⚠️ Could not save Gladia diarization (non-fatal):', diarErr.message);
            }
        }

        res.json({
            success: true,
            callId,
            transcription: result.transcription,
            transcription_with_speakers: result.transcription_with_speakers || null,
            utterances: result.utterances || [],
            language: result.language,
            languages_detected: result.languages_detected || [],
            duration: result.duration,
            diarization_enabled: result.diarization_enabled || false
        });
    } catch (error) {
        console.error('❌ Transcription error:', error.message);
        res.status(500).json({ success: false, error: 'Transcription failed', details: error.message });
    }
});

/**
 * Extract intent using AI
 * POST /api/analysis/extract-intent/:callId
 */
router.post('/extract-intent/:callId', async (req, res) => {
    try {
        const callId = parseInt(req.params.callId);
        console.log(`\n🎯 Extracting intent for call ${callId}`);

        const call = await db.getCallReport(callId);
        if (!call || !call.transcription_text) {
            return res.status(404).json({ success: false, error: 'Call or transcription not found' });
        }

        const intentData = await analysisService.extractIntent(call.transcription_text);

        await db.updateCallStatus(callId, 'intent_extracted', {
            primary_intent: intentData.primary_intent,
            sentiment: intentData.sentiment,
            sentiment_score: intentData.sentiment_score || 0,
            urgency: intentData.urgency
        });

        res.json({ success: true, callId, intent: intentData });
    } catch (error) {
        console.error('❌ Intent extraction error:', error.message);
        res.status(500).json({ success: false, error: 'Intent extraction failed', details: error.message });
    }
});

/**
 * Generate comprehensive AI analysis
 * POST /api/analysis/analyze/:callId
 */
router.post('/analyze/:callId', async (req, res) => {
    try {
        const callId = parseInt(req.params.callId);
        console.log(`\n🤖 Analyzing call ${callId}`);

        const call = await db.getCallReport(callId);
        if (!call || !call.transcription_text) {
            return res.status(404).json({ success: false, error: 'Call data incomplete — transcription missing' });
        }

        let intentData = typeof call.intent_data === 'string'
            ? JSON.parse(call.intent_data)
            : (call.intent_data || {
                primary_intent: call.primary_intent,
                sentiment: call.sentiment,
                sentiment_score: call.sentiment_score,
                urgency: call.urgency,
                topics: [],
                entities: []
            });

        const analysisText = await analysisService.generateAnalysis(call.transcription_text, intentData);
        const analysisStructure = analysisService.parseAnalysisStructure(analysisText);
        const qualityScore = analysisService.calculateQualityScore(intentData, analysisStructure);
        const csatEstimate = analysisService.estimateCSAT(intentData, analysisStructure);

        // Save to DB synchronously (with retry on failure) before responding.
        // This is required because process-complete calls this route and then
        // immediately fetches the report — the data must exist in DB by then.
        const saveWithRetry = async (attempt = 1) => {
            try {
                await db.saveCallReport(callId, {
                    intent_data: intentData,
                    ai_analysis: analysisText,
                    call_summary: analysisStructure.call_summary,
                    customer_pain_points: analysisStructure.customer_pain_points,
                    emotional_tone: analysisStructure.emotional_tone,
                    primary_sensitivity: analysisStructure.primary_sensitivity,
                    churn_risk_assessment: analysisStructure.churn_risk_assessment || 'low',
                    churn_risk_score: analysisStructure.churn_risk_score || 0,
                    recommended_communication_style: analysisStructure.recommended_communication_style,
                    escalation_risk: analysisStructure.churn_risk_assessment === 'critical' ? 'high' : 'low',
                    escalation_risk_score: analysisStructure.escalation_risk_score || 0,
                    refund_likelihood: 'low',
                    refund_likelihood_score: analysisStructure.refund_likelihood_score || 0,
                    quality_score: qualityScore,
                    csat_estimate: csatEstimate,
                    resolution_status: 'pending',
                    agent_opening_line: analysisStructure.agent_opening_line,
                    agent_approach_do: analysisStructure.agent_approach_do,
                    agent_approach_avoid: analysisStructure.agent_approach_avoid,
                    crm_tags: analysisStructure.crm_tags,
                    key_insights: [],
                    conversation_highlights: []
                });

                await db.updateCallStatus(callId, 'analyzed', {
                    quality_score: qualityScore,
                    csat_estimate: csatEstimate,
                    resolution_status: 'pending'
                });

                if (call.customer_id) {
                    await db.updateCustomerSentiment(call.customer_id);
                }
                console.log(`✅ Analysis for call ${callId} saved to DB.`);
            } catch (dbError) {
                console.error(`❌ DB save attempt ${attempt}/${MAX_RETRIES} failed for call ${callId}:`, dbError.message);
                if (attempt < MAX_RETRIES) {
                    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
                    await saveWithRetry(attempt + 1);
                } else {
                    console.error(`🚨 All ${MAX_RETRIES} DB save attempts exhausted for call ${callId}.`);
                    throw dbError; // propagate so the HTTP response reflects failure
                }
            }
        };

        await saveWithRetry();

        res.json({
            success: true,
            callId,
            analysis: analysisText,
            qualityScore,
            csatEstimate
        });

    } catch (error) {
        console.error('❌ Analysis error:', error.message);
        res.status(500).json({ success: false, error: 'Analysis failed', details: error.message });
    }
});

/**
 * Process complete pipeline: transcribe → intent → analyze
 */
router.post('/process-complete/:callId', async (req, res) => {
    try {
        const callId = parseInt(req.params.callId);

        console.log(`\n🚀 Starting complete processing for call ${callId}...`);

        const results = {
            transcription: { success: false },
            intent: { success: false },
            analysis: { success: false }
        };

        // Helper to simulate request/response for internal route logic
        // without making network calls.
        const mockReq = { params: { callId } };
        
        // --- Step 1: Transcribe ---
        let transcribeData = null;
        try {
            const call = await db.getCallById(callId);
            if (!call || !fs.existsSync(call.audio_filepath)) throw new Error('Audio file missing');
            const result = await transcriptionService.transcribeCall(callId, call.audio_filepath);
            await db.saveTranscription(callId, {
                text: result.transcription,
                duration: result.duration,
                confidence: 0.95,
                language: result.language || 'ur+en'
            });
            await db.updateCallStatus(callId, 'transcribed', { duration: Math.floor(result.duration || 0) });
            if (result.utterances && result.utterances.length > 0) {
                const turns = result.utterances.map(u => ({
                    speaker: u.speaker === 'Speaker 1' ? 'Agent' : 'Customer',
                    text: u.text
                }));
                try { await db.saveDiarization(callId, turns); } catch (e) {}
            }
            transcribeData = result;
            results.transcription = { success: true, data: result };
        } catch (error) {
            console.error('Transcription step failed:', error.message);
            return res.status(500).json({ success: false, error: 'Transcription failed', results });
        }

        // --- Step 2: Intent ---
        let intentDataResult = null;
        try {
            const call = await db.getCallReport(callId);
            const intentData = await analysisService.extractIntent(call.transcription_text);
            await db.updateCallStatus(callId, 'intent_extracted', {
                primary_intent: intentData.primary_intent,
                sentiment: intentData.sentiment,
                sentiment_score: intentData.sentiment_score || 0,
                urgency: intentData.urgency
            });
            intentDataResult = intentData;
            results.intent = { success: true, data: intentData };
        } catch (error) { console.warn('⚠️ Intent extraction failed:', error.message); }

        // --- Step 3: Analysis ---
        try {
            const call = await db.getCallReport(callId);
            const intentToUse = intentDataResult || { primary_intent: call.primary_intent, sentiment: call.sentiment, sentiment_score: call.sentiment_score, urgency: call.urgency, topics: [], entities: [] };
            const analysisText = await analysisService.generateAnalysis(call.transcription_text, intentToUse);
            const analysisStructure = analysisService.parseAnalysisStructure(analysisText);
            const qualityScore = analysisService.calculateQualityScore(intentToUse, analysisStructure);
            const csatEstimate = analysisService.estimateCSAT(intentToUse, analysisStructure);
            
            await db.saveCallReport(callId, {
                intent_data: intentToUse,
                ai_analysis: analysisText,
                call_summary: analysisStructure.call_summary,
                customer_pain_points: analysisStructure.customer_pain_points,
                emotional_tone: analysisStructure.emotional_tone,
                primary_sensitivity: analysisStructure.primary_sensitivity,
                churn_risk_assessment: analysisStructure.churn_risk_assessment || 'low',
                churn_risk_score: analysisStructure.churn_risk_score || 0,
                recommended_communication_style: analysisStructure.recommended_communication_style,
                escalation_risk: analysisStructure.churn_risk_assessment === 'critical' ? 'high' : 'low',
                escalation_risk_score: analysisStructure.escalation_risk_score || 0,
                refund_likelihood: 'low',
                refund_likelihood_score: analysisStructure.refund_likelihood_score || 0,
                quality_score: qualityScore,
                csat_estimate: csatEstimate,
                resolution_status: 'pending',
                agent_opening_line: analysisStructure.agent_opening_line,
                agent_approach_do: analysisStructure.agent_approach_do,
                agent_approach_avoid: analysisStructure.agent_approach_avoid,
                crm_tags: analysisStructure.crm_tags,
                key_insights: [],
                conversation_highlights: []
            });
            await db.updateCallStatus(callId, 'analyzed', { quality_score: qualityScore, csat_estimate: csatEstimate, resolution_status: 'pending' });
            if (call.customer_id) await db.updateCustomerSentiment(call.customer_id);
            results.analysis = { success: true, data: { analysis: analysisText, qualityScore, csatEstimate } };
        } catch (error) { console.warn('⚠️ Analysis failed:', error.message); }

        // --- Step 4: Diarization ---
        if (transcribeData && transcribeData.utterances && transcribeData.utterances.length > 0) {
            console.log(`ℹ️  Skipping LLM diarize — Gladia native diarization already saved.`);
            results.diarization = { success: true, source: 'gladia', turns: transcribeData.utterances.length };
        } else {
            try {
                const call = await db.getCallReport(callId);
                if (call && call.transcription_text) {
                    const turns = await analysisService.diarizeConversation(call.transcription_text);
                    await db.saveDiarization(callId, turns);
                    results.diarization = { success: true, source: 'llm', data: turns };
                }
            } catch (error) { console.warn('⚠️ Diarization failed (non-fatal):', error.message); }
        }

        await db.updateCallStatus(callId, 'completed');
        res.json({ success: true, message: 'Processing completed', callId, results });
    } catch (error) {
        console.error('Complete processing error:', error);
        res.status(500).json({ success: false, error: 'Processing failed', details: error.message });
    }
});

/**
 * Download call report as PDF
 * GET /api/analysis/reports/:callId/download
 */
router.get('/reports/:callId/download', async (req, res) => {
    try {
        const callId = parseInt(req.params.callId);
        const report = await db.getCallReport(callId);
        if (!report) return res.status(404).json({ success: false, error: 'Report not found' });

        const pdfBuffer = await generateReportPDF(report);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=call-report-${callId}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to generate PDF' });
    }
});

module.exports = router;
