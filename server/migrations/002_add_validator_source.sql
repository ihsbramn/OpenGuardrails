-- Add source column to distinguish hub vs custom validators
ALTER TABLE validators ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'hub' CHECK (source IN ('hub', 'custom'));

-- Add validation_code for custom/user-defined validators
ALTER TABLE validators ADD COLUMN IF NOT EXISTS validation_code TEXT;
ALTER TABLE validators ADD COLUMN IF NOT EXISTS validation_type VARCHAR(50) DEFAULT 'regex' CHECK (validation_type IN ('regex', 'llm', 'script', 'keyword', 'length', 'json_schema'));

-- Seed validators are from the hub
UPDATE validators SET source = 'hub' WHERE source IS NULL;

CREATE INDEX IF NOT EXISTS idx_validators_source ON validators(source);
