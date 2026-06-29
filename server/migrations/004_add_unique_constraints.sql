-- Add uniqueness constraints for better data integrity
ALTER TABLE ai_endpoints ADD CONSTRAINT uq_endpoints_name UNIQUE (name);
ALTER TABLE server_configs ADD CONSTRAINT uq_server_configs_name UNIQUE (name);
