"""Add viral scoring and audience activity tables + scheduling columns.

Revision: 006_viral_scoring_schema
"""

-- Add scheduling metadata columns to contents table
ALTER TABLE contents ADD COLUMN IF NOT EXISTS viral_score INTEGER;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS viral_probability VARCHAR(20);
ALTER TABLE contents ADD COLUMN IF NOT EXISTS scheduling_confidence VARCHAR(100);
ALTER TABLE contents ADD COLUMN IF NOT EXISTS scheduling_reason TEXT;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS auto_scheduled BOOLEAN DEFAULT FALSE;

-- New table for viral score history
CREATE TABLE IF NOT EXISTS viral_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL,
    platform VARCHAR(50),
    total_score INTEGER,
    hook_score INTEGER,
    emotion_score INTEGER,
    trend_score INTEGER,
    historical_score INTEGER,
    uniqueness_score INTEGER,
    algorithm_score INTEGER,
    viral_probability VARCHAR(20),
    recommendation TEXT,
    scored_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_viral_scores_draft_id ON viral_scores(draft_id);
CREATE INDEX IF NOT EXISTS idx_viral_scores_workspace_id ON viral_scores(workspace_id);

-- New table for audience activity snapshots
CREATE TABLE IF NOT EXISTS audience_activity_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    platform VARCHAR(50),
    day_of_week INTEGER,
    hour INTEGER,
    avg_engagement_rate DECIMAL(5,2),
    post_count INTEGER DEFAULT 0,
    snapshot_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_snapshots_unique
ON audience_activity_snapshots(workspace_id, platform, day_of_week, hour, snapshot_date);
