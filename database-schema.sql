

-- ============================================
-- AVANZA SOLUTIONS - CALL CENTER DATABASE
-- PostgreSQL Schema
-- ============================================

-- Drop existing tables if they exist (for fresh start)
DROP TABLE IF EXISTS action_items CASCADE;
DROP TABLE IF EXISTS call_transcriptions CASCADE;
DROP TABLE IF EXISTS call_reports CASCADE;
DROP TABLE IF EXISTS calls CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS agents CASCADE;

-- ============================================
-- TABLE 1: CUSTOMERS
-- Store customer information
-- ============================================
CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255),
    full_name VARCHAR(255),
    company_name VARCHAR(255),
    
    -- Customer Profile
    preferred_language VARCHAR(50) DEFAULT 'en',
    customer_tier VARCHAR(50) DEFAULT 'standard', -- standard, premium, vip
    account_status VARCHAR(50) DEFAULT 'active', -- active, suspended, closed
    
    -- Analytics
    total_calls INTEGER DEFAULT 0,
    average_sentiment VARCHAR(50), -- Positive, Neutral, Negative
    churn_risk VARCHAR(50) DEFAULT 'low', -- low, medium, high, critical
    last_contact_date TIMESTAMP,
    
    -- Customer Behavior Profile
    communication_preference VARCHAR(100), -- email, phone, chat
    typical_issue_category VARCHAR(100), -- billing, technical, general
    emotional_tone VARCHAR(100), -- calm, anxious, frustrated, assertive
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for fast lookups
    CONSTRAINT customer_phone_check CHECK (phone_number ~ '^\+?[0-9]{10,15}$')
);

CREATE INDEX idx_customers_phone ON customers(phone_number);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_churn_risk ON customers(churn_risk);

-- ============================================
-- TABLE 2: AGENTS
-- Store call center agent information
-- ============================================
CREATE TABLE agents (
    agent_id SERIAL PRIMARY KEY,
    agent_name VARCHAR(255) NOT NULL,
    employee_id VARCHAR(50) UNIQUE,
    email VARCHAR(255) UNIQUE,
    
    -- Agent Stats
    total_calls_handled INTEGER DEFAULT 0,
    average_quality_score DECIMAL(3,2), -- 0.00 to 100.00
    average_csat DECIMAL(3,2), -- 0.00 to 5.00
    
    -- Status
    status VARCHAR(50) DEFAULT 'active', -- active, on_break, offline
    department VARCHAR(100),
    
    -- Metadata
    hired_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agents_status ON agents(status);

-- ============================================
-- TABLE 3: CALLS
-- Main call records
-- ============================================
CREATE TABLE calls (
    call_id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(customer_id) ON DELETE SET NULL,
    agent_id INTEGER REFERENCES agents(agent_id) ON DELETE SET NULL,
    
    -- Call Information
    call_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    call_duration INTEGER, -- in seconds
    call_status VARCHAR(50) DEFAULT 'completed', -- completed, dropped, transferred
    
    -- Audio File Information
    audio_filename VARCHAR(500),
    audio_filepath VARCHAR(1000),
    audio_filesize BIGINT, -- in bytes
    
    -- Processing Status
    processing_status VARCHAR(50) DEFAULT 'uploaded', -- uploaded, transcribed, analyzed, completed
    
    -- Quick Reference Data (denormalized for speed)
    primary_intent VARCHAR(100),
    sentiment VARCHAR(50),
    urgency VARCHAR(50),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_calls_customer ON calls(customer_id);
CREATE INDEX idx_calls_agent ON calls(agent_id);
CREATE INDEX idx_calls_date ON calls(call_date);
CREATE INDEX idx_calls_status ON calls(processing_status);
CREATE INDEX idx_calls_sentiment ON calls(sentiment);

-- ============================================
-- TABLE 4: CALL_TRANSCRIPTIONS
-- Store transcription data
-- ============================================
CREATE TABLE call_transcriptions (
    transcription_id SERIAL PRIMARY KEY,
    call_id INTEGER UNIQUE REFERENCES calls(call_id) ON DELETE CASCADE,
    
    -- Transcription Content
    transcription_text TEXT NOT NULL,
    word_count INTEGER,
    language_detected VARCHAR(10) DEFAULT 'en',
    
    -- Processing Info
    transcription_duration DECIMAL(10,2), -- how long it took to transcribe
    transcription_method VARCHAR(50) DEFAULT 'whisper-local', -- whisper-local, whisper-api, etc
    
    -- Quality Metrics
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transcriptions_call ON call_transcriptions(call_id);

-- ============================================
-- TABLE 5: CALL_REPORTS
-- Store AI analysis and reports
-- ============================================
CREATE TABLE call_reports (
    report_id SERIAL PRIMARY KEY,
    call_id INTEGER UNIQUE REFERENCES calls(call_id) ON DELETE CASCADE,
    
    -- Intent Analysis (JSON structure)
    intent_data JSONB, -- stores: primary_intent, topics[], sentiment, urgency, entities[]
    
    -- AI Analysis
    ai_analysis TEXT, -- full AI-generated analysis
    call_summary TEXT, -- brief summary
    customer_pain_points TEXT[], -- array of pain points
    
    -- Customer Interaction Profile
    emotional_tone VARCHAR(100),
    primary_sensitivity VARCHAR(100),
    churn_risk_assessment VARCHAR(50),
    recommended_communication_style VARCHAR(200),
    
    -- Risk Assessment
    escalation_risk VARCHAR(50), -- low, medium, high
    refund_likelihood VARCHAR(50), -- low, medium, high
    
    -- Quality Metrics
    quality_score DECIMAL(5,2), -- 0.00 to 100.00
    csat_estimate DECIMAL(3,2), -- 0.00 to 5.00
    resolution_status VARCHAR(50), -- resolved, pending, escalated
    
    -- Agent Performance (for this call)
    agent_opening_line TEXT,
    agent_approach_do TEXT[],
    agent_approach_avoid TEXT[],
    
    -- Compliance
    compliance_status JSONB, -- {gdpr: 'completed', follow_up: 'pending', etc}
    
    -- CRM Tags
    crm_tags TEXT[], -- array of tags like #Billing, #PriceSensitive
    
    -- Metadata
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reports_call ON call_reports(call_id);
CREATE INDEX idx_reports_intent_data ON call_reports USING GIN(intent_data);
CREATE INDEX idx_reports_crm_tags ON call_reports USING GIN(crm_tags);

-- ============================================
-- TABLE 6: ACTION_ITEMS
-- Store follow-up actions
-- ============================================
CREATE TABLE action_items (
    action_id SERIAL PRIMARY KEY,
    call_id INTEGER REFERENCES calls(call_id) ON DELETE CASCADE,
    
    -- Action Details
    action_type VARCHAR(50), -- during_call, after_call
    action_description TEXT NOT NULL,
    priority VARCHAR(50) DEFAULT 'medium', -- low, medium, high, critical
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    assigned_to INTEGER REFERENCES agents(agent_id) ON DELETE SET NULL,
    
    -- Deadlines
    due_date TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_actions_call ON action_items(call_id);
CREATE INDEX idx_actions_status ON action_items(status);
CREATE INDEX idx_actions_assigned ON action_items(assigned_to);

-- ============================================
-- VIEWS FOR QUICK ACCESS
-- ============================================

-- View: Customer Call History with Latest Report
CREATE VIEW customer_call_history AS
SELECT 
    c.customer_id,
    cust.full_name,
    cust.phone_number,
    c.call_id,
    c.call_date,
    c.call_duration,
    c.primary_intent,
    c.sentiment,
    c.urgency,
    ct.transcription_text,
    cr.call_summary,
    cr.emotional_tone,
    cr.churn_risk_assessment,
    cr.recommended_communication_style,
    cr.quality_score,
    a.agent_name
FROM calls c
LEFT JOIN customers cust ON c.customer_id = cust.customer_id
LEFT JOIN call_transcriptions ct ON c.call_id = ct.call_id
LEFT JOIN call_reports cr ON c.call_id = cr.call_id
LEFT JOIN agents a ON c.agent_id = a.agent_id
ORDER BY c.call_date DESC;

-- View: Customer Profile with Stats
CREATE VIEW customer_profiles AS
SELECT 
    c.customer_id,
    c.full_name,
    c.phone_number,
    c.email,
    c.customer_tier,
    c.total_calls,
    c.average_sentiment,
    c.churn_risk,
    c.last_contact_date,
    COUNT(calls.call_id) as actual_call_count,
    AVG(cr.quality_score) as avg_quality_score,
    AVG(cr.csat_estimate) as avg_csat
FROM customers c
LEFT JOIN calls ON c.customer_id = calls.customer_id
LEFT JOIN call_reports cr ON calls.call_id = cr.call_id
GROUP BY c.customer_id;

-- View: Agent Performance Dashboard
CREATE VIEW agent_performance AS
SELECT 
    a.agent_id,
    a.agent_name,
    a.department,
    COUNT(c.call_id) as total_calls,
    AVG(cr.quality_score) as avg_quality_score,
    AVG(cr.csat_estimate) as avg_csat,
    SUM(CASE WHEN c.sentiment = 'Positive' THEN 1 ELSE 0 END) as positive_calls,
    SUM(CASE WHEN c.sentiment = 'Negative' THEN 1 ELSE 0 END) as negative_calls,
    SUM(CASE WHEN cr.resolution_status = 'resolved' THEN 1 ELSE 0 END) as resolved_calls
FROM agents a
LEFT JOIN calls c ON a.agent_id = c.agent_id
LEFT JOIN call_reports cr ON c.call_id = cr.call_id
GROUP BY a.agent_id;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function: Get Customer's Last Call Report
CREATE OR REPLACE FUNCTION get_customer_last_call(p_phone_number VARCHAR)
RETURNS TABLE (
    last_call_date TIMESTAMP,
    last_call_summary TEXT,
    last_primary_intent VARCHAR,
    last_sentiment VARCHAR,
    last_emotional_tone VARCHAR,
    recommended_approach VARCHAR,
    churn_risk VARCHAR,
    total_previous_calls INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        calls.call_date,
        cr.call_summary,
        calls.primary_intent,
        calls.sentiment,
        cr.emotional_tone,
        cr.recommended_communication_style,
        cr.churn_risk_assessment,
        cust.total_calls
    FROM customers cust
    LEFT JOIN calls ON cust.customer_id = calls.customer_id
    LEFT JOIN call_reports cr ON calls.call_id = cr.call_id
    WHERE cust.phone_number = p_phone_number
    ORDER BY calls.call_date DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function: Update Customer Stats (Trigger)
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE customers
    SET 
        total_calls = (SELECT COUNT(*) FROM calls WHERE customer_id = NEW.customer_id),
        last_contact_date = NEW.call_date,
        updated_at = CURRENT_TIMESTAMP
    WHERE customer_id = NEW.customer_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update customer stats when new call is added
CREATE TRIGGER trigger_update_customer_stats
AFTER INSERT ON calls
FOR EACH ROW
EXECUTE FUNCTION update_customer_stats();

-- Function: Calculate Average Sentiment for Customer
CREATE OR REPLACE FUNCTION update_customer_sentiment()
RETURNS TRIGGER AS $$
DECLARE
    pos_count INTEGER;
    neg_count INTEGER;
    neu_count INTEGER;
    total INTEGER;
    avg_sentiment VARCHAR;
BEGIN
    SELECT 
        COUNT(*) FILTER (WHERE sentiment = 'Positive'),
        COUNT(*) FILTER (WHERE sentiment = 'Negative'),
        COUNT(*) FILTER (WHERE sentiment = 'Neutral'),
        COUNT(*)
    INTO pos_count, neg_count, neu_count, total
    FROM calls
    WHERE customer_id = NEW.customer_id;
    
    IF pos_count > neg_count AND pos_count > neu_count THEN
        avg_sentiment := 'Positive';
    ELSIF neg_count > pos_count AND neg_count > neu_count THEN
        avg_sentiment := 'Negative';
    ELSE
        avg_sentiment := 'Neutral';
    END IF;
    
    UPDATE customers
    SET average_sentiment = avg_sentiment
    WHERE customer_id = NEW.customer_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update average sentiment
CREATE TRIGGER trigger_update_sentiment
AFTER INSERT OR UPDATE ON calls
FOR EACH ROW
WHEN (NEW.sentiment IS NOT NULL)
EXECUTE FUNCTION update_customer_sentiment();

-- ============================================
-- SAMPLE DATA FOR TESTING
-- ============================================

-- Insert Sample Agents
INSERT INTO agents (agent_name, employee_id, email, department) VALUES
('John Smith', 'AG001', 'john.smith@avanza.com', 'Technical Support'),
('Sarah Johnson', 'AG002', 'sarah.johnson@avanza.com', 'Billing'),
('Mike Chen', 'AG003', 'mike.chen@avanza.com', 'Customer Success'),
('Emma Williams', 'AG004', 'emma.williams@avanza.com', 'Technical Support');

-- Insert Sample Customers
INSERT INTO customers (phone_number, email, full_name, company_name, customer_tier) VALUES
('+923001234567', 'ali.ahmed@example.com', 'Ali Ahmed', 'Tech Solutions Pvt', 'premium'),
('+923009876543', 'fatima.khan@example.com', 'Fatima Khan', 'Digital Marketing Co', 'standard'),
('+923007654321', 'usman.malik@example.com', 'Usman Malik', 'Retail Enterprises', 'vip');

-- ============================================
-- HELPFUL QUERIES
-- ============================================

-- Query 1: Get complete customer history for incoming call
/*
SELECT * FROM get_customer_last_call('+923001234567');
*/

-- Query 2: Get all calls for a specific customer
/*
SELECT * FROM customer_call_history 
WHERE phone_number = '+923001234567'
ORDER BY call_date DESC;
*/

-- Query 3: Get customer profile with stats
/*
SELECT * FROM customer_profiles 
WHERE phone_number = '+923001234567';
*/

-- Query 4: Get pending action items
/*
SELECT * FROM action_items 
WHERE status = 'pending' 
ORDER BY priority DESC, due_date ASC;
*/

-- Query 5: Agent performance this week
/*
SELECT * FROM agent_performance
WHERE agent_id = 1;
*/

-- ============================================
-- END OF SCHEMA
-- ============================================




