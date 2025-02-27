-- GDPR Tables Migration Script

-- Table for storing user privacy settings
CREATE TABLE IF NOT EXISTS user_privacy_settings (
  id SERIAL PRIMARY KEY,
  uid VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  allow_analytics BOOLEAN NOT NULL DEFAULT TRUE,
  store_history BOOLEAN NOT NULL DEFAULT TRUE,
  retention_period VARCHAR(20) NOT NULL DEFAULT 'forever',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups by email
CREATE INDEX IF NOT EXISTS idx_privacy_settings_email ON user_privacy_settings(email);

-- Table for logging GDPR deletion requests (for compliance and audit)
CREATE TABLE IF NOT EXISTS gdpr_deletion_log (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  deletion_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  requested_by VARCHAR(255) NOT NULL,
  notes TEXT,
  ip_address VARCHAR(45)
);

-- Table for data access requests (optional, for tracking GDPR requests)
CREATE TABLE IF NOT EXISTS gdpr_data_access_log (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  request_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  requested_by VARCHAR(255) NOT NULL,
  fulfilled BOOLEAN DEFAULT FALSE,
  fulfilled_date TIMESTAMP WITH TIME ZONE,
  notes TEXT
);