-- 006: Replace gateway_enabled/gateway_mode with independent toggles per mode
-- Both OpenAI and Anthropic can be independently turned on/off

-- Add new independent toggle columns
ALTER TABLE server_configs
  ADD COLUMN IF NOT EXISTS gateway_openai_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gateway_anthropic_enabled boolean NOT NULL DEFAULT false;

-- Migrate existing data: if gateway_enabled=true, set the matching mode
UPDATE server_configs
  SET gateway_openai_enabled = true
  WHERE gateway_enabled = true AND gateway_mode = 'openai';

UPDATE server_configs
  SET gateway_anthropic_enabled = true
  WHERE gateway_enabled = true AND gateway_mode = 'anthropic';

-- Keep old columns for backward compatibility (they become no-ops)
COMMENT ON COLUMN server_configs.gateway_enabled IS 'DEPRECATED — use gateway_openai_enabled and gateway_anthropic_enabled';
COMMENT ON COLUMN server_configs.gateway_mode IS 'DEPRECATED — both modes now run independently';
