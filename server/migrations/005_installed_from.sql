-- Track which hub validator a custom copy was installed from
ALTER TABLE validators ADD COLUMN IF NOT EXISTS installed_from UUID REFERENCES validators(id);

-- Index for fast lookup of installed copies
CREATE INDEX IF NOT EXISTS idx_validators_installed_from ON validators(installed_from) WHERE installed_from IS NOT NULL;
