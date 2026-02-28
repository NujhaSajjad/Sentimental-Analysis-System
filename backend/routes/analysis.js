const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');
const db = require('../database');
const transcriptionService = require('../services/transcriptionService');
const analysisService = require('../services/analysisService');
const { generateReportPDF } = require('../utils/pdfGenerator');

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
            duration: result.totalDuration || result.duration,
            confidence: 0.95,
            language: 'en'
        });

        await db.updateCallStatus(callId, 'transcribed', {
            duration: Math.floor(result.totalDuration || result.duration || 0)
        });

        res.json({
            success: true,
            callId,
            transcription: result.transcription,
            duration: result.totalDuration || result.duration
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
            return res.status(404).json({ success: false, error: 'Call data incomplete' });
        }

        let intentData = typeof call.intent_data === 'string' ? JSON.parse(call.intent_data) : (call.intent_data || {
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
 * POST /api/analysis/process-complete/:callId
 */
router.post('/process-complete/:callId', async (req, res) => {
    try {
        const callId = parseInt(req.params.callId);
        const PORT = process.env.PORT || 3000;

        console.log(`\n🚀 Starting complete processing for call ${callId}...`);

        const results = {
            transcription: { success: false },
            intent: { success: false },
            analysis: { success: false }
        };

        // Step 1: Transcribe
        // Note: Calling via internal URL might be tricky with routers, 
        // better to invoke the logic directly or use the router instance.
        // For simplicity in refactoring, we'll hit the localhost URL as before.
        const internalUrl = `http://localhost:${PORT}/api/analysis`;

        try {
            const transcribeRes = await axios.post(`${internalUrl}/transcribe/${callId}`);
            results.transcription = { success: true, data: transcribeRes.data };
        } catch (error) {
            return res.status(500).json({ success: false, error: 'Transcription failed', results });
        }

        try {
            const intentRes = await axios.post(`${internalUrl}/extract-intent/${callId}`);
            results.intent = { success: true, data: intentRes.data };
        } catch (error) { console.warn('⚠️ Intent extraction failed'); }

        try {
            const analyzeRes = await axios.post(`${internalUrl}/analyze/${callId}`);
            results.analysis = { success: true, data: analyzeRes.data };
        } catch (error) { console.warn('⚠️ Analysis failed'); }

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
