-- Migration: Add publish failure tracking columns to contents table
-- Date: 2026-06-01
-- Purpose: Track WHY content failed to publish and enable automatic retry

-- Add publish_failure_reason column (stores detailed failure explanation)
ALTER TABLE contents 
ADD COLUMN IF NOT EXISTS publish_failure_reason TEXT;

-- Add publish_retry_count column (tracks number of retry attempts)
ALTER TABLE contents 
ADD COLUMN IF NOT EXISTS publish_retry_count INTEGER DEFAULT 0;

-- Add publish_last_retry_at column (timestamp of last retry attempt)
ALTER TABLE contents 
ADD COLUMN IF NOT EXISTS publish_last_retry_at TIMESTAMP WITH TIME ZONE;

-- Add publish_next_retry_at column (timestamp when next retry will occur)
ALTER TABLE contents 
ADD COLUMN IF NOT EXISTS publish_next_retry_at TIMESTAMP WITH TIME ZONE;

-- Add index on publish_next_retry_at for efficient retry queries
CREATE INDEX IF NOT EXISTS idx_contents_publish_next_retry_at 
ON contents(publish_next_retry_at) 
WHERE publish_next_retry_at IS NOT NULL;

-- Add index on publish_failure_reason for querying by failure type
CREATE INDEX IF NOT EXISTS idx_contents_publish_failure_reason 
ON contents(publish_failure_reason) 
WHERE publish_failure_reason IS NOT NULL;

-- Comment: These columns enable the fallback strategy:
-- 1. When publish fails, we classify the reason and store it in publish_failure_reason
-- 2. If the failure is retryable (network error, rate limit, etc.), we keep status='scheduled'
-- 3. We set publish_next_retry_at with exponential backoff delay
-- 4. The publish worker will automatically retry at the scheduled time
-- 5. If not retryable (no platform connected, token expired), we mark status='failed'
-- 6. User can see the failure reason and required action in the UI
