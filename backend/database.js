// database.js - Avanza Solutions DB Module
require('dotenv').config();
const { Pool } = require('pg');

const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'call_center_ai',
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT) || 5432,
    };

poolConfig.max = 20;
poolConfig.idleTimeoutMillis = 30000;
poolConfig.connectionTimeoutMillis = 2000;

// Enable SSL for production environments (e.g. Supabase, Render, Neon)
if (process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true') {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

pool.on('connect', () => console.log('✅ Connected to PostgreSQL'));
pool.on('error', (err) => { console.error('❌ DB error:', err); process.exit(-1); });
process.on('SIGTERM', () => pool.end(() => console.log('🔌 Pool closed')));

/**
 * Ensure any schema columns that are added dynamically exist on startup.
 * Safe to call every time — uses IF NOT EXISTS.
 */
async function initSchema() {
  try {
    await pool.query(`
      ALTER TABLE call_transcriptions
      ADD COLUMN IF NOT EXISTS diarized_conversation JSONB
    `);
    console.log('✅ Schema init complete (diarized_conversation column ensured)');
  } catch (err) {
    console.warn('⚠️ Schema init warning (non-fatal):', err.message);
  }
}

// ============================================
// CUSTOMER OPERATIONS
// ============================================

/**
 * Find customer by phone number (primary lookup for incoming calls)
 * This is what you'll use when a call comes in — match by caller ID
 */
async function findCustomerByPhone(phoneNumber) {
  try {
    const result = await pool.query(
      'SELECT * FROM customers WHERE phone_number = $1',
      [phoneNumber]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding customer by phone:', error);
    throw error;
  }
}

/**
 * Find customer by CNIC
 */
async function findCustomerByCNIC(cnic) {
  try {
    const result = await pool.query(
      'SELECT * FROM customers WHERE cnic = $1',
      [cnic]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding customer by CNIC:', error);
    throw error;
  }
}

/**
 * Find or create customer — used when a call arrives and we may or may not
 * recognise the caller. Pass cnic and/or phoneNumber.
 */
async function findOrCreateCustomer(cnic, phoneNumber, additionalData = {}) {
  try {
    // 1. Try CNIC first
    if (cnic && !cnic.startsWith('TEMP-')) {
      const byCnic = await findCustomerByCNIC(cnic);
      if (byCnic) {
        console.log(`👤 Found customer by CNIC: ${cnic}`);
        return byCnic;
      }
    }

    // 2. Try phone number
    if (phoneNumber) {
      const byPhone = await findCustomerByPhone(phoneNumber);
      if (byPhone) {
        console.log(`👤 Found customer by phone: ${phoneNumber}`);
        return byPhone;
      }
    }

    // 3. Create new customer
    const insertQuery = `
      INSERT INTO customers (cnic, phone_number, email, full_name, company_name, city, address)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await pool.query(insertQuery, [
      cnic && !cnic.startsWith('TEMP-') ? cnic : null,
      phoneNumber,
      additionalData.email || null,
      additionalData.full_name || 'Unknown Customer',
      additionalData.company_name || null,
      additionalData.city || null,
      additionalData.address || null,
    ]);
    console.log(`✨ Created new customer (phone: ${phoneNumber})`);
    return result.rows[0];
  } catch (error) {
    console.error('Error in findOrCreateCustomer:', error);
    throw error;
  }
}

/**
 * Search customers — direct SQL with ILIKE.
 * NOTE: We intentionally bypass the search_customers() PostgreSQL stored function
 * because its RETURNS TABLE declaration uses varchar but the actual table columns
 * are text after the schema migration, which causes a type-mismatch error.
 */
async function searchCustomers(searchTerm) {
  try {
    const pattern = `%${searchTerm}%`;
    const result = await pool.query(
      `SELECT
         customer_id,
         cnic,
         phone_number,
         full_name,
         company_name,
         email,
         total_calls,
         overall_sentiment,
         sentiment_trend,
         churn_risk
       FROM customers
       WHERE
         cnic         ILIKE $1
         OR phone_number ILIKE $1
         OR full_name    ILIKE $1
         OR company_name ILIKE $1
       ORDER BY total_calls DESC, full_name ASC
       LIMIT 20`,
      [pattern]
    );
    return result.rows;
  } catch (error) {
    console.error('Error searching customers:', error);
    throw error;
  }
}

/**
 * Get customer by CNIC
 */
async function getCustomerByCNIC(cnic) {
  return findCustomerByCNIC(cnic);
}

/**
 * Get full customer profile — queries customers table directly
 * (the customer_complete_profile view does not exist in the current schema)
 */
async function getCustomerCompleteProfile(cnic) {
  try {
    const result = await pool.query(
      `SELECT
         c.*,
         (SELECT COUNT(*) FROM calls WHERE customer_id = c.customer_id) AS total_calls_count
       FROM customers c
       WHERE c.cnic = $1`,
      [cnic]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting customer profile by CNIC:', error);
    throw error;
  }
}

/**
 * Get customer profile by ID — queries customers table directly
 */
async function getCustomerProfile(customerId) {
  try {
    const result = await pool.query(
      `SELECT
         c.*,
         (SELECT COUNT(*) FROM calls WHERE customer_id = c.customer_id) AS total_calls_count
       FROM customers c
       WHERE c.customer_id = $1`,
      [customerId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting customer profile:', error);
    throw error;
  }
}

/**
 * Get all calls for a customer (calls + report summary)
 * includes a calculated customer_call_number sequence.
 */
async function getCustomerAllCalls(customerId) {
  try {
    const result = await pool.query(
      `SELECT 
         *,
         ROW_NUMBER() OVER (ORDER BY call_date ASC) as customer_call_number
       FROM customer_call_history 
       WHERE customer_id = $1 
       ORDER BY call_date DESC`,
      [customerId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting customer calls:', error);
    throw error;
  }
}

// Alias used in some places
const getCustomerCallHistory = getCustomerAllCalls;

/**
 * Get last call info for a phone number — used to give context before a new call
 * (e.g. "This customer last called 3 days ago about billing")
 */
async function getCustomerLastCall(phoneNumber) {
  try {
    const result = await pool.query(
      `SELECT
         calls.call_date       AS last_call_date,
         cr.call_summary       AS last_call_summary,
         calls.primary_intent  AS last_primary_intent,
         calls.sentiment       AS last_sentiment,
         cr.emotional_tone     AS last_emotional_tone,
         cr.recommended_communication_style AS recommended_approach,
         cr.churn_risk_assessment AS churn_risk,
         cust.total_calls
       FROM customers cust
       LEFT JOIN calls       ON cust.customer_id = calls.customer_id
       LEFT JOIN call_reports cr ON calls.call_id = cr.call_id
       WHERE cust.phone_number = $1
       ORDER BY calls.call_date DESC
       LIMIT 1`,
      [phoneNumber]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting customer last call:', error);
    return null;  // non-fatal — return null rather than throwing
  }
}

/**
 * Get customer sentiment timeline (per-call scores)
 */
async function getCustomerSentimentTimeline(customerId) {
  try {
    const result = await pool.query(
      `SELECT
         call_id,
         call_date       AS recorded_at,
         sentiment       AS sentiment_category,
         sentiment_score AS sentiment_score
       FROM calls
       WHERE customer_id = $1 AND sentiment IS NOT NULL
       ORDER BY call_date DESC
       LIMIT 20`,
      [customerId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting sentiment timeline:', error);
    throw error;
  }
}

/**
 * Calculate and persist overall customer sentiment.
 * NOTE: We bypass the calculate_customer_sentiment() stored function because
 * its RETURNS TABLE uses varchar but calls table columns are now text.
 * Inline SQL avoids the type mismatch entirely.
 */
async function updateCustomerSentiment(customerId) {
  try {
    // 1. Count sentiments
    const countsRes = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE sentiment = 'Positive') AS pos,
         COUNT(*) FILTER (WHERE sentiment = 'Negative') AS neg,
         COUNT(*) FILTER (WHERE sentiment = 'Neutral')  AS neu,
         AVG(sentiment_score)                           AS avg_score
       FROM calls
       WHERE customer_id = $1`,
      [customerId]
    );
    const { pos, neg, neu, avg_score } = countsRes.rows[0];
    const posN = parseInt(pos) || 0;
    const negN = parseInt(neg) || 0;
    const neuN = parseInt(neu) || 0;

    let overall_sentiment;
    if (posN >= negN && posN >= neuN) overall_sentiment = 'Positive';
    else if (negN > posN && negN >= neuN) overall_sentiment = 'Negative';
    else overall_sentiment = 'Neutral';

    // 2. Calculate trend (recent 3 vs previous 3)
    const trendRes = await pool.query(
      `SELECT
         AVG(recent.sentiment_score) AS recent_avg,
         AVG(prev.sentiment_score)   AS prev_avg
       FROM (
         SELECT sentiment_score FROM calls
         WHERE customer_id = $1 AND sentiment_score IS NOT NULL
         ORDER BY call_date DESC LIMIT 3
       ) recent
       CROSS JOIN (
         SELECT sentiment_score FROM calls
         WHERE customer_id = $1 AND sentiment_score IS NOT NULL
         ORDER BY call_date DESC LIMIT 3 OFFSET 3
       ) prev`,
      [customerId]
    );
    const { recent_avg, prev_avg } = trendRes.rows[0] || {};
    let sentiment_trend = 'stable';
    if (recent_avg != null && prev_avg != null) {
      if (parseFloat(recent_avg) > parseFloat(prev_avg)) sentiment_trend = 'improving';
      else if (parseFloat(recent_avg) < parseFloat(prev_avg)) sentiment_trend = 'declining';
    }

    // 3. Persist
    await pool.query(
      `UPDATE customers
       SET overall_sentiment       = $1,
           overall_sentiment_score = $2,
           sentiment_trend         = $3,
           last_analyzed_at        = CURRENT_TIMESTAMP,
           updated_at              = CURRENT_TIMESTAMP
       WHERE customer_id = $4`,
      [overall_sentiment, parseFloat(avg_score) || 0, sentiment_trend, customerId]
    );
    console.log(`📊 Updated sentiment for customer ${customerId}: ${overall_sentiment} (${sentiment_trend})`);
    return { overall_sentiment, overall_score: parseFloat(avg_score) || 0, sentiment_trend };
  } catch (error) {
    console.error('Error updating customer sentiment (non-fatal):', error.message);
    return null;
  }
}

/**
 * Update customer churn risk
 */
async function updateCustomerChurnRisk(customerId, churnRisk) {
  try {
    const result = await pool.query(
      `UPDATE customers SET churn_risk = $1, updated_at = CURRENT_TIMESTAMP
       WHERE customer_id = $2 RETURNING *`,
      [churnRisk, customerId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error updating churn risk:', error);
    throw error;
  }
}

// ============================================
// CALL OPERATIONS
// ============================================

/**
 * Create a new call record in the database
 */
async function createCall(customerId, agentId, audioFileInfo) {
  try {
    const result = await pool.query(
      `INSERT INTO calls
         (customer_id, agent_id, audio_filename, audio_filepath, audio_filesize, audio_format, processing_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'uploaded')
       RETURNING *`,
      [
        customerId || null,
        agentId || null,
        audioFileInfo.filename,
        audioFileInfo.filepath,
        audioFileInfo.size,
        audioFileInfo.format || 'm4a',
      ]
    );
    console.log(`📞 Created call record ID: ${result.rows[0].call_id}`);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating call:', error);
    throw error;
  }
}

/**
 * Update call status + optional quick-access fields
 */
async function updateCallStatus(callId, status, additionalData = {}) {
  try {
    const result = await pool.query(
      `UPDATE calls
       SET processing_status  = $1,
           call_duration      = COALESCE($2,  call_duration),
           primary_intent     = COALESCE($3,  primary_intent),
           sentiment          = COALESCE($4,  sentiment),
           sentiment_score    = COALESCE($5,  sentiment_score),
           urgency            = COALESCE($6,  urgency),
           quality_score      = COALESCE($7,  quality_score),
           csat_estimate      = COALESCE($8,  csat_estimate),
           resolution_status  = COALESCE($9,  resolution_status),
           updated_at         = CURRENT_TIMESTAMP
       WHERE call_id = $10
       RETURNING *`,
      [
        status,
        additionalData.duration || null,
        additionalData.primary_intent || null,
        additionalData.sentiment || null,
        additionalData.sentiment_score || null,
        additionalData.urgency || null,
        additionalData.quality_score || null,
        additionalData.csat_estimate || null,
        additionalData.resolution_status || null,
        callId,
      ]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error updating call status:', error);
    throw error;
  }
}

/**
 * Get a single call record
 */
async function getCallById(callId) {
  try {
    const result = await pool.query('SELECT * FROM calls WHERE call_id = $1', [callId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting call by ID:', error);
    throw error;
  }
}

// ============================================
// TRANSCRIPTION OPERATIONS
// ============================================

/**
 * Save (or upsert) transcription for a call
 */
async function saveTranscription(callId, transcriptionData) {
  try {
    const wordCount = transcriptionData.text
      ? transcriptionData.text.split(/\s+/).filter(Boolean).length
      : 0;

    const quality =
      (transcriptionData.confidence >= 0.9) ? 'excellent' :
        (transcriptionData.confidence >= 0.7) ? 'good' :
          (transcriptionData.confidence >= 0.5) ? 'fair' : 'poor';

    const result = await pool.query(
      `INSERT INTO call_transcriptions
         (call_id, transcription_text, word_count, transcription_duration,
          confidence_score, language_detected, transcription_quality)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (call_id) DO UPDATE
         SET transcription_text      = EXCLUDED.transcription_text,
             word_count              = EXCLUDED.word_count,
             transcription_duration  = EXCLUDED.transcription_duration,
             confidence_score        = EXCLUDED.confidence_score,
             transcription_quality   = EXCLUDED.transcription_quality
       RETURNING *`,
      [
        callId,
        transcriptionData.text,
        wordCount,
        transcriptionData.duration || null,
        transcriptionData.confidence || null,
        transcriptionData.language || 'en',
        quality,
      ]
    );
    console.log(`📝 Saved transcription for call ${callId} (${wordCount} words)`);
    return result.rows[0];
  } catch (error) {
    console.error('Error saving transcription:', error);
    throw error;
  }
}

/**
 * Save diarized conversation JSON for a call
 * @param {number} callId
 * @param {Array} turns - [{speaker, text}, ...]
 */
async function saveDiarization(callId, turns) {
  try {
    // AUTO-CREATE the column if it doesn't exist (safe to run every time)
    await pool.query(`
      ALTER TABLE call_transcriptions
      ADD COLUMN IF NOT EXISTS diarized_conversation JSONB
    `);

    const result = await pool.query(
      `UPDATE call_transcriptions
       SET diarized_conversation = $1
       WHERE call_id = $2
       RETURNING *`,
      [JSON.stringify(turns), callId]
    );
    console.log(`💬 Saved diarization for call ${callId} (${turns.length} turns)`);
    return result.rows[0];
  } catch (error) {
    console.error('Error saving diarization:', error);
    // Non-fatal — don't break the pipeline
    return null;
  }
}

/**
 * Save a single audio segment (for long calls that are chunked)
 */
async function saveCallSegment(callId, segmentData) {
  try {
    const result = await pool.query(
      `INSERT INTO call_segments
         (call_id, segment_number, segment_start_time, segment_end_time,
          segment_duration, segment_transcription, segment_summary,
          segment_sentiment, segment_sentiment_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        callId,
        segmentData.segment_number,
        segmentData.segment_start_time,
        segmentData.segment_end_time,
        segmentData.segment_duration,
        segmentData.segment_transcription,
        segmentData.segment_summary || null,
        segmentData.segment_sentiment || null,
        segmentData.segment_sentiment_score || null,
      ]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error saving call segment:', error);
    throw error;
  }
}

/**
 * Get all segments for a call (ordered)
 */
async function getCallSegments(callId) {
  try {
    const result = await pool.query(
      'SELECT * FROM call_segments WHERE call_id = $1 ORDER BY segment_number',
      [callId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting call segments:', error);
    throw error;
  }
}

// ============================================
// REPORT OPERATIONS
// ============================================

/**
 * Save AI analysis report for a call
 * NOTE: column is `full_ai_analysis` (not `ai_analysis`) — matches fixed schema
 */
async function saveCallReport(callId, reportData) {
  try {
    const result = await pool.query(
      `INSERT INTO call_reports (
         call_id, intent_data, full_ai_analysis, call_summary,
         customer_pain_points, customer_expectations,
         emotional_tone, emotional_intensity, primary_sensitivity,
         churn_risk_assessment, churn_risk_score,
         escalation_risk, escalation_risk_score,
         refund_likelihood, refund_likelihood_score,
         quality_score, csat_estimate, nps_estimate,
         resolution_status, crm_tags,
         agent_opening_line, agent_approach_do, agent_approach_avoid,
         key_insights, conversation_highlights
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
       ON CONFLICT (call_id) DO UPDATE
         SET intent_data       = EXCLUDED.intent_data,
             full_ai_analysis  = EXCLUDED.full_ai_analysis,
             call_summary      = EXCLUDED.call_summary,
             updated_at        = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        callId,
        JSON.stringify(reportData.intent_data || {}),
        reportData.ai_analysis || null,  // field from server is ai_analysis
        reportData.call_summary || null,
        reportData.customer_pain_points || [],
        reportData.customer_expectations || [],
        reportData.emotional_tone || null,
        reportData.emotional_intensity || 'medium',
        reportData.primary_sensitivity || null,
        reportData.churn_risk_assessment || 'low',
        reportData.churn_risk_score || 0,
        reportData.escalation_risk || 'low',
        reportData.escalation_risk_score || 0,
        reportData.refund_likelihood || 'low',
        reportData.refund_likelihood_score || 0,
        reportData.quality_score || null,
        reportData.csat_estimate || null,
        reportData.nps_estimate || null,
        reportData.resolution_status || 'pending',
        reportData.crm_tags || [],
        reportData.agent_opening_line || null,
        reportData.agent_approach_do || [],
        reportData.agent_approach_avoid || [],
        reportData.key_insights || [],
        reportData.conversation_highlights || [],
      ]
    );
    console.log(`📊 Saved report for call ${callId}`);
    return result.rows[0];
  } catch (error) {
    console.error('Error saving call report:', error);
    throw error;
  }
}

/**
 * Get full report for a call — JOINs all relevant tables.
 * NOTE: diarized_conversation is fetched via a sub-select so the query
 * never crashes even if the column hasn't been added to the DB yet.
 */
async function getCallReport(callId) {
  try {
    const result = await pool.query(
      `SELECT
         -- Call core fields
         c.call_id, c.customer_id, c.agent_id,
         c.call_date, c.call_duration, c.call_status,
         c.audio_filename, c.processing_status,
         c.primary_intent, c.sentiment, c.sentiment_score,
         c.urgency, c.quality_score, c.csat_estimate, c.resolution_status,

         -- Transcription
         ct.transcription_text, ct.word_count, ct.confidence_score,

         -- Report / AI analysis
         cr.report_id,
         cr.intent_data,
         cr.full_ai_analysis    AS ai_analysis,
         cr.call_summary,
         cr.customer_pain_points,
         cr.emotional_tone,
         cr.emotional_intensity,
         cr.primary_sensitivity,
         cr.churn_risk_assessment,
         cr.churn_risk_score,
         cr.recommended_communication_style,
         cr.escalation_risk, cr.escalation_risk_score,
         cr.refund_likelihood,  cr.refund_likelihood_score,
         cr.nps_estimate,
         cr.resolution_status   AS report_resolution_status,
         cr.agent_opening_line,
         cr.agent_approach_do,
         cr.agent_approach_avoid,
         cr.crm_tags,
         cr.key_insights,

         -- Customer
         cust.cnic,
         cust.full_name         AS customer_name,
         cust.phone_number,
         cust.email             AS customer_email,
         cust.customer_tier,
         cust.overall_sentiment AS customer_overall_sentiment,
         cust.churn_risk        AS customer_churn_risk,

         -- Agent
         a.agent_name, a.employee_id
       FROM calls c
       LEFT JOIN call_transcriptions ct ON c.call_id    = ct.call_id
       LEFT JOIN call_reports        cr ON c.call_id    = cr.call_id
       LEFT JOIN customers         cust ON c.customer_id = cust.customer_id
       LEFT JOIN agents               a ON c.agent_id   = a.agent_id
       WHERE c.call_id = $1`,
      [callId]
    );

    if (!result.rows[0]) return null;
    const row = result.rows[0];

    // Fetch diarized_conversation separately — column may not exist yet.
    // initSchema() adds it on startup; this guard prevents any crash.
    try {
      const dRes = await pool.query(
        `SELECT diarized_conversation FROM call_transcriptions WHERE call_id = $1`,
        [callId]
      );
      row.diarized_conversation = dRes.rows[0]?.diarized_conversation || null;
    } catch {
      row.diarized_conversation = null; // column not yet added — safe fallback
    }

    return row;
  } catch (error) {
    console.error('Error getting call report:', error);
    throw error;
  }
}

// ============================================
// ACTION ITEMS
// ============================================

async function createActionItems(callId, customerId, actionItems) {
  try {
    const results = [];
    for (const item of actionItems) {
      const result = await pool.query(
        `INSERT INTO action_items
           (call_id, customer_id, action_type, action_category, action_description, priority, status)
         VALUES ($1,$2,$3,$4,$5,$6,'pending')
         RETURNING *`,
        [
          callId,
          customerId || null,
          item.type || 'after_call',
          item.category || null,
          item.description,
          item.priority || 'medium',
        ]
      );
      results.push(result.rows[0]);
    }
    console.log(`✅ Created ${results.length} action items for call ${callId}`);
    return results;
  } catch (error) {
    console.error('Error creating action items:', error);
    throw error;
  }
}

async function getCallActionItems(callId) {
  try {
    const result = await pool.query(
      `SELECT * FROM action_items WHERE call_id = $1 ORDER BY priority DESC, created_at DESC`,
      [callId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting action items:', error);
    throw error;
  }
}

// ============================================
// AGENT OPERATIONS
// ============================================

async function findOrCreateAgent(agentName, agentEmail) {
  try {
    const find = await pool.query('SELECT * FROM agents WHERE email = $1', [agentEmail]);
    if (find.rows.length > 0) return find.rows[0];

    const employeeId = 'AG' + String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const result = await pool.query(
      `INSERT INTO agents (agent_name, email, employee_id) VALUES ($1,$2,$3) RETURNING *`,
      [agentName, agentEmail, employeeId]
    );
    console.log(`👨‍💼 Created agent: ${agentName}`);
    return result.rows[0];
  } catch (error) {
    console.error('Error finding/creating agent:', error);
    throw error;
  }
}

// ============================================
// ANALYTICS
// ============================================

async function getDashboardStats() {
  try {
    const result = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM calls)                                                AS total_calls,
         (SELECT COUNT(*) FROM customers)                                            AS total_customers,
         (SELECT COUNT(*) FROM calls WHERE call_date > NOW() - INTERVAL '24 hours') AS calls_today,
         (SELECT COUNT(*) FROM calls WHERE call_date > NOW() - INTERVAL '7 days')   AS calls_this_week,
         (SELECT ROUND(AVG(quality_score),1) FROM call_reports)                     AS avg_quality_score,
         (SELECT ROUND(AVG(csat_estimate),2) FROM call_reports)                     AS avg_csat,
         (SELECT COUNT(*) FROM customers WHERE churn_risk IN ('high','critical'))   AS high_risk_customers`
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  pool,

  // Schema init — call once on server startup
  initSchema,

  // Customer
  findOrCreateCustomer,
  findCustomerByPhone,
  findCustomerByCNIC,
  searchCustomers,
  getCustomerByCNIC,
  getCustomerCompleteProfile,
  getCustomerProfile,
  getCustomerCallHistory,
  getCustomerAllCalls,
  getCustomerSentimentTimeline,
  getCustomerLastCall,
  updateCustomerSentiment,
  updateCustomerChurnRisk,

  // Calls
  createCall,
  updateCallStatus,
  getCallById,

  // Transcription
  saveTranscription,
  saveDiarization,
  saveCallSegment,
  getCallSegments,

  // Reports
  saveCallReport,
  getCallReport,

  // Action items
  createActionItems,
  getCallActionItems,

  // Agents
  findOrCreateAgent,

  // Analytics
  getDashboardStats,
};