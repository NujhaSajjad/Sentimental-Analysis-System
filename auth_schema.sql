-- ============================================
-- AVANZA SOLUTIONS - AUTHENTICATION DATABASE SCHEMA
-- Complete implementation with security best practices
-- ============================================

-- ────────────────────────────────────────────
-- 1. CREATE DATABASE (if starting fresh)
-- ────────────────────────────────────────────
-- Run these commands only if creating new database:
-- CREATE DATABASE call_center_ai;
-- \c call_center_ai

-- ────────────────────────────────────────────
-- 2. ADD AUTHENTICATION COLUMNS TO AGENTS TABLE
-- ────────────────────────────────────────────

-- Add authentication and security columns
ALTER TABLE agents ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMP;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Make email unique (required for login)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'agents_email_key'
    ) THEN
        ALTER TABLE agents ADD CONSTRAINT agents_email_key UNIQUE (email);
    END IF;
END $$;

-- Make email lowercase and not null
UPDATE agents SET email = LOWER(email) WHERE email IS NOT NULL;
ALTER TABLE agents ALTER COLUMN email SET NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agents_email ON agents(email);
CREATE INDEX IF NOT EXISTS idx_agents_is_active ON agents(is_active);
CREATE INDEX IF NOT EXISTS idx_agents_last_login ON agents(last_login DESC);
CREATE INDEX IF NOT EXISTS idx_agents_password_reset_token ON agents(password_reset_token) WHERE password_reset_token IS NOT NULL;

-- ────────────────────────────────────────────
-- 3. CREATE AUDIT LOG TABLE (Best Practice)
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS auth_audit_log (
    log_id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(agent_id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'login', 'logout', 'failed_login', 'password_change', 'password_reset'
    ip_address VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    metadata JSONB, -- Additional context
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_agent_id ON auth_audit_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_event_type ON auth_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_created_at ON auth_audit_log(created_at DESC);

-- ────────────────────────────────────────────
-- 4. CREATE ACTIVE SESSIONS TABLE (Optional - for JWT blacklisting)
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS active_sessions (
    session_id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(agent_id) ON DELETE CASCADE,
    token_jti VARCHAR(255) UNIQUE NOT NULL, -- JWT ID
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_agent_id ON active_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_token_jti ON active_sessions(token_jti);
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires_at ON active_sessions(expires_at);

-- ────────────────────────────────────────────
-- 5. CREATE TRIGGER FOR UPDATED_AT
-- ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_agents_updated_at ON agents;
CREATE TRIGGER update_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ────────────────────────────────────────────
-- 6. SEED DEFAULT AGENTS WITH PASSWORDS
-- ────────────────────────────────────────────

-- Password: avanza123
-- Bcrypt hash (cost=12): $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/Lewmynd/qUjfNqYPe

-- Update existing agents or insert new ones
INSERT INTO agents (agent_name, email, department, employee_id, password_hash, is_active, email_verified)
VALUES 
    ('John Smith', 'john.smith@avanza.com', 'Technical Support', 'AG001', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/Lewmynd/qUjfNqYPe', true, true),
    ('Sarah Johnson', 'sarah.johnson@avanza.com', 'Billing', 'AG002', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/Lewmynd/qUjfNqYPe', true, true),
    ('Mike Chen', 'mike.chen@avanza.com', 'Customer Success', 'AG003', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/Lewmynd/qUjfNqYPe', true, true),
    ('Emma Williams', 'emma.williams@avanza.com', 'Technical Support', 'AG004', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/Lewmynd/qUjfNqYPe', true, true)
ON CONFLICT (email) 
DO UPDATE SET 
    password_hash = EXCLUDED.password_hash,
    is_active = EXCLUDED.is_active,
    email_verified = EXCLUDED.email_verified,
    updated_at = CURRENT_TIMESTAMP;

-- ────────────────────────────────────────────
-- 7. CREATE HELPER FUNCTIONS
-- ────────────────────────────────────────────

-- Function to check if account is locked
CREATE OR REPLACE FUNCTION is_account_locked(p_agent_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    locked_until TIMESTAMP;
BEGIN
    SELECT account_locked_until INTO locked_until
    FROM agents
    WHERE agent_id = p_agent_id;
    
    RETURN locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to unlock account (auto-unlock after time expires)
CREATE OR REPLACE FUNCTION auto_unlock_accounts()
RETURNS INTEGER AS $$
DECLARE
    unlocked_count INTEGER;
BEGIN
    UPDATE agents
    SET 
        account_locked_until = NULL,
        failed_login_attempts = 0
    WHERE 
        account_locked_until IS NOT NULL 
        AND account_locked_until <= CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS unlocked_count = ROW_COUNT;
    RETURN unlocked_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired sessions
CREATE OR REPLACE FUNCTION clean_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM active_sessions
    WHERE expires_at < CURRENT_TIMESTAMP
       OR revoked_at IS NOT NULL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean old audit logs (keep last 90 days)
CREATE OR REPLACE FUNCTION clean_old_audit_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM auth_audit_log
    WHERE created_at < CURRENT_TIMESTAMP - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────
-- 8. CREATE VIEWS FOR MONITORING
-- ────────────────────────────────────────────

-- View: Active agents
CREATE OR REPLACE VIEW active_agents AS
SELECT 
    agent_id,
    agent_name,
    email,
    department,
    employee_id,
    last_login,
    email_verified,
    created_at
FROM agents
WHERE is_active = true
ORDER BY last_login DESC NULLS LAST;

-- View: Login activity (last 24 hours)
CREATE OR REPLACE VIEW recent_login_activity AS
SELECT 
    a.agent_id,
    a.agent_name,
    a.email,
    a.department,
    al.event_type,
    al.ip_address,
    al.success,
    al.created_at
FROM auth_audit_log al
JOIN agents a ON al.agent_id = a.agent_id
WHERE al.event_type IN ('login', 'failed_login')
  AND al.created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY al.created_at DESC;

-- View: Account security status
CREATE OR REPLACE VIEW agent_security_status AS
SELECT 
    agent_id,
    agent_name,
    email,
    is_active,
    email_verified,
    failed_login_attempts,
    CASE 
        WHEN account_locked_until > CURRENT_TIMESTAMP THEN 'LOCKED'
        WHEN is_active = false THEN 'DISABLED'
        WHEN email_verified = false THEN 'UNVERIFIED'
        ELSE 'ACTIVE'
    END as status,
    account_locked_until,
    last_login,
    COALESCE(
        (SELECT COUNT(*) FROM auth_audit_log 
         WHERE agent_id = agents.agent_id 
         AND event_type = 'failed_login' 
         AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'),
        0
    ) as failed_logins_24h
FROM agents
ORDER BY agent_name;

-- ────────────────────────────────────────────
-- 9. VERIFICATION QUERIES
-- ────────────────────────────────────────────

-- Check table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'agents'
ORDER BY ordinal_position;

-- Verify default accounts
SELECT 
    agent_id,
    agent_name,
    email,
    department,
    is_active,
    email_verified,
    CASE WHEN password_hash IS NOT NULL THEN '✓ Set' ELSE '✗ Missing' END as password_status
FROM agents
ORDER BY agent_id;

-- Check indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'agents'
   OR tablename = 'auth_audit_log'
   OR tablename = 'active_sessions'
ORDER BY tablename, indexname;

-- ────────────────────────────────────────────
-- 10. SECURITY RECOMMENDATIONS
-- ────────────────────────────────────────────

-- Run these periodically (setup as cron jobs):
-- SELECT clean_expired_sessions();        -- Daily
-- SELECT auto_unlock_accounts();          -- Hourly
-- SELECT clean_old_audit_logs(90);        -- Weekly

-- Grant appropriate permissions (adjust for your setup):
-- GRANT SELECT, INSERT, UPDATE ON agents TO app_user;
-- GRANT SELECT, INSERT ON auth_audit_log TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON active_sessions TO app_user;

-- ════════════════════════════════════════════
-- INSTALLATION COMPLETE
-- ════════════════════════════════════════════

-- Default Login Credentials:
-- ┌─────────────────────────────────┬────────────┐
-- │ Email                           │ Password   │
-- ├─────────────────────────────────┼────────────┤
-- │ john.smith@avanza.com           │ avanza123  │
-- │ sarah.johnson@avanza.com        │ avanza123  │
-- │ mike.chen@avanza.com            │ avanza123  │
-- │ emma.williams@avanza.com        │ avanza123  │
-- └─────────────────────────────────┴────────────┘

-- Next Steps:
-- 1. Run this script: psql -U postgres -d call_center_ai -f database_schema.sql
-- 2. Install backend dependencies: npm install bcryptjs jsonwebtoken express-rate-limit
-- 3. Configure environment variables in .env
-- 4. Integrate auth.js into your Express server
-- 5. Test login flow with default credentials