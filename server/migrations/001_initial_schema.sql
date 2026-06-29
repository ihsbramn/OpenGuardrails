-- OpenGuardrails Management Console - Database Schema
-- PostgreSQL Migration

-- UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- RBAC: Users & Roles
-- ============================================================

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL,       -- admin, user
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- AI Endpoints (OpenAI-compatible / Anthropic-compatible)
-- ============================================================

CREATE TABLE ai_endpoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('openai', 'anthropic', 'openai_compatible', 'anthropic_compatible')),
  base_url VARCHAR(512) NOT NULL,
  api_key_encrypted TEXT,
  default_model VARCHAR(255),
  available_models JSONB DEFAULT '[]',
  headers JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Guardrails Hub: Validator Categories & Validators
-- ============================================================

CREATE TABLE validator_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE validators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hub_uri VARCHAR(512) UNIQUE NOT NULL,          -- e.g., hub://guardrails/regex_match
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES validator_categories(id) ON DELETE SET NULL,
  version VARCHAR(50) DEFAULT 'latest',
  parameters JSONB DEFAULT '[]',                 -- [{name, type, default, required, description}]
  on_fail_options JSONB DEFAULT '["exception","fix","filter","reask","noop"]',
  is_installed BOOLEAN DEFAULT false,
  install_path VARCHAR(512),
  source_url VARCHAR(512),
  docs_url VARCHAR(512),
  tags JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Guards (combinations of validators)
-- ============================================================

CREATE TABLE guards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  description TEXT,
  guard_type VARCHAR(50) DEFAULT 'output' CHECK (guard_type IN ('input', 'output', 'both')),
  on_fail_action VARCHAR(50) DEFAULT 'exception' CHECK (on_fail_action IN ('exception', 'fix', 'filter', 'reask', 'noop', 'log')),
  endpoint_id UUID REFERENCES ai_endpoints(id) ON DELETE SET NULL,
  model VARCHAR(255),
  prompt_template TEXT,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  use_server BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction: Guard <-> Validator
CREATE TABLE guard_validators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guard_id UUID REFERENCES guards(id) ON DELETE CASCADE,
  validator_id UUID REFERENCES validators(id) ON DELETE CASCADE,
  parameters JSONB DEFAULT '{}',        -- Override default validator params
  on_fail_action VARCHAR(50) DEFAULT 'exception',
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(guard_id, validator_id)
);

-- ============================================================
-- Guardrails Server Configurations
-- ============================================================

CREATE TABLE server_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  host VARCHAR(255) DEFAULT '0.0.0.0',
  port INTEGER DEFAULT 8000,
  is_ssl BOOLEAN DEFAULT false,
  ssl_cert_path VARCHAR(512),
  ssl_key_path VARCHAR(512),
  log_level VARCHAR(50) DEFAULT 'info' CHECK (log_level IN ('debug', 'info', 'warning', 'error')),
  max_request_size_mb INTEGER DEFAULT 10,
  request_timeout_seconds INTEGER DEFAULT 30,
  enable_cors BOOLEAN DEFAULT false,
  cors_origins JSONB DEFAULT '["*"]',
  config_file_path VARCHAR(512),
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Validation Results / Logs
-- ============================================================

CREATE TABLE validation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guard_id UUID REFERENCES guards(id) ON DELETE SET NULL,
  guard_name VARCHAR(255),
  input_text TEXT,
  output_text TEXT,
  validation_passed BOOLEAN,
  total_checks INTEGER DEFAULT 0,
  checks_passed INTEGER DEFAULT 0,
  checks_failed INTEGER DEFAULT 0,
  validator_results JSONB DEFAULT '[]',  -- [{validator_id, name, passed, message, score, metadata}]
  llm_model VARCHAR(255),
  llm_provider VARCHAR(100),
  latency_ms INTEGER,
  error_message TEXT,
  client_ip VARCHAR(45),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- API Keys for programmatic access
-- ============================================================

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,
  permissions JSONB DEFAULT '["read"]',
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Audit Log
-- ============================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  details JSONB DEFAULT '{}',
  client_ip VARCHAR(45),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_validators_category ON validators(category_id);
CREATE INDEX idx_validators_hub_uri ON validators(hub_uri);
CREATE INDEX idx_guards_creator ON guards(created_by);
CREATE INDEX idx_guard_validators_guard ON guard_validators(guard_id);
CREATE INDEX idx_guard_validators_validator ON guard_validators(validator_id);
CREATE INDEX idx_validation_logs_guard ON validation_logs(guard_id);
CREATE INDEX idx_validation_logs_created ON validation_logs(created_at);
CREATE INDEX idx_validation_logs_user ON validation_logs(user_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- ============================================================
-- Seed Data
-- ============================================================

INSERT INTO roles (name, description) VALUES
  ('admin', 'Full access - can manage endpoints, validators, guards, users, and server configs'),
  ('user', 'Can add/configure validators and guards, view endpoints and logs');

-- Default admin user (password: admin123)
-- bcrypt hash for 'admin123'
INSERT INTO users (email, password_hash, full_name, role_id) 
VALUES ('admin@openguardrails.com', '$2a$10$placeholder_hash_replace_in_seed', 'Admin User', 
        (SELECT id FROM roles WHERE name = 'admin'));

-- Validator Categories
INSERT INTO validator_categories (name, slug, description, icon) VALUES
  ('Text Quality', 'text-quality', 'Validators for text readability, grammar, and quality', 'spellcheck'),
  ('Toxicity & Safety', 'toxicity-safety', 'Detect toxic, harmful, or unsafe content', 'shield'),
  ('PII & Privacy', 'pii-privacy', 'Detect personally identifiable information and privacy violations', 'lock'),
  ('Factual Accuracy', 'factual-accuracy', 'Validate factual correctness and hallucination detection', 'check-circle'),
  ('Competitive & Legal', 'competitive-legal', 'Detect competitor mentions and legal compliance issues', 'gavel'),
  ('Format & Structure', 'format-structure', 'Validate JSON, regex, length, and structural constraints', 'code'),
  ('Semantic & Topic', 'semantic-topic', 'Semantic similarity, topic detection, and relevance checks', 'topic'),
  ('Language & Translation', 'language-translation', 'Language detection and translation quality', 'translate'),
  ('Bias & Fairness', 'bias-fairness', 'Detect bias and ensure fairness in outputs', 'balance'),
  ('Security', 'security', 'Prompt injection, jailbreak, and security threat detection', 'security');

-- Sample validators from Guardrails Hub
INSERT INTO validators (hub_uri, name, display_name, description, category_id, parameters, is_installed, tags) VALUES
  ('hub://guardrails/regex_match', 'regex_match', 'Regex Match', 'Validates that a string matches a given regex pattern', 
   (SELECT id FROM validator_categories WHERE slug='format-structure'),
   '[{"name":"regex","type":"string","default":"","required":true,"description":"Regular expression pattern to match"}]',
   false, '["regex","validation","pattern"]'),
   
  ('hub://guardrails/toxic_language', 'toxic_language', 'Toxic Language', 'Detects toxic, offensive, or hateful language in text',
   (SELECT id FROM validator_categories WHERE slug='toxicity-safety'),
   '[{"name":"threshold","type":"number","default":0.5,"required":false,"description":"Confidence threshold for toxicity detection"},{"name":"validation_method","type":"string","default":"sentence","required":false,"description":"Granularity of validation: sentence or full"}]',
   false, '["toxicity","safety","content-moderation"]'),
   
  ('hub://guardrails/competitor_check', 'competitor_check', 'Competitor Check', 'Detects mentions of specified competitor names',
   (SELECT id FROM validator_categories WHERE slug='competitive-legal'),
   '[{"name":"competitors","type":"array","default":"[]","required":true,"description":"List of competitor names to detect"}]',
   false, '["competitive","legal","brand-protection"]'),
   
  ('hub://guardrails/gibberish_text', 'gibberish_text', 'Gibberish Text', 'Detects whether text is meaningful or gibberish',
   (SELECT id FROM validator_categories WHERE slug='text-quality'),
   '[]',
   false, '["text-quality","nonsense","readability"]'),
   
  ('hub://guardrails/two_words', 'two_words', 'Two Words', 'Validates that text contains exactly two words',
   (SELECT id FROM validator_categories WHERE slug='format-structure'),
   '[]',
   false, '["word-count","format"]'),
   
  ('hub://guardrails/detect_pii', 'detect_pii', 'Detect PII', 'Detects personally identifiable information in text',
   (SELECT id FROM validator_categories WHERE slug='pii-privacy'),
   '[{"name":"entities","type":"array","default":"[\"EMAIL\",\"PHONE\",\"SSN\",\"CREDIT_CARD\"]","required":false,"description":"Types of PII to detect"}]',
   false, '["pii","privacy","gdpr"]'),
   
  ('hub://guardrails/profanity_free', 'profanity_free', 'Profanity Free', 'Ensures text contains no profanity or offensive language',
   (SELECT id FROM validator_categories WHERE slug='toxicity-safety'),
   '[]',
   false, '["profanity","clean-language","content"]'),
   
  ('hub://guardrails/similar_to_document', 'similar_to_document', 'Similar to Document', 'Checks semantic similarity against reference documents',
   (SELECT id FROM validator_categories WHERE slug='semantic-topic'),
   '[{"name":"document","type":"string","default":"","required":true,"description":"Reference document text"},{"name":"threshold","type":"number","default":0.7,"required":false,"description":"Similarity threshold"}]',
   false, '["semantic","similarity","grounding"]'),
   
  ('hub://guardrails/valid_json', 'valid_json', 'Valid JSON', 'Validates that the output is valid JSON',
   (SELECT id FROM validator_categories WHERE slug='format-structure'),
   '[]',
   false, '["json","format","structured-output"]'),
   
  ('hub://guardrails/extracted_summary_sentences_match', 'extracted_summary_sentences_match', 'Summary Sentences Match', 'Checks that summary sentences are present in the source text',
   (SELECT id FROM validator_categories WHERE slug='factual-accuracy'),
   '[{"name":"threshold","type":"number","default":0.7,"required":false,"description":"Matching threshold"}]',
   false, '["summarization","factual-accuracy","grounding"]'),
   
  ('hub://guardrails/sensitive_topic', 'sensitive_topic', 'Sensitive Topic', 'Detects discussion of sensitive topics',
   (SELECT id FROM validator_categories WHERE slug='toxicity-safety'),
   '[{"name":"topics","type":"array","default":"[\"violence\",\"self-harm\",\"hate-speech\"]","required":false,"description":"Sensitive topics to detect"}]',
   false, '["sensitive","content-moderation","safety"]'),
   
  ('hub://guardrails/similar_to_list', 'similar_to_list', 'Similar to List', 'Checks if text is semantically similar to items in a reference list',
   (SELECT id FROM validator_categories WHERE slug='semantic-topic'),
   '[{"name":"reference_list","type":"array","default":"[]","required":true,"description":"Reference items to check against"},{"name":"threshold","type":"number","default":0.8,"required":false,"description":"Similarity threshold"}]',
   false, '["semantic","similarity","matching"]'),
   
  ('hub://guardrails/hate_speech', 'hate_speech', 'Hate Speech Detector', 'Detects hate speech and discriminatory language',
   (SELECT id FROM validator_categories WHERE slug='toxicity-safety'),
   '[{"name":"threshold","type":"number","default":0.5,"required":false,"description":"Detection threshold"}]',
   false, '["hate-speech","discrimination","safety"]'),
   
  ('hub://guardrails/nsfw_text', 'nsfw_text', 'NSFW Text', 'Detects not-safe-for-work content in text',
   (SELECT id FROM validator_categories WHERE slug='toxicity-safety'),
   '[{"name":"threshold","type":"number","default":0.7,"required":false,"description":"Detection threshold"}]',
   false, '["nsfw","adult-content","safety"]'),
   
  ('hub://guardrails/restricttotopic', 'restricttotopic', 'Restrict to Topic', 'Ensures output stays within a specified topic',
   (SELECT id FROM validator_categories WHERE slug='semantic-topic'),
   '[{"name":"topic","type":"string","default":"","required":true,"description":"The allowed topic"}]',
   false, '["topic","relevance","constraint"]'),
   
  ('hub://guardrails/provenance_v1', 'provenance_v1', 'Provenance V1', 'Verifies factual claims against provided context',
   (SELECT id FROM validator_categories WHERE slug='factual-accuracy'),
   '[{"name":"context","type":"string","default":"","required":true,"description":"Source context for fact verification"}]',
   false, '["factual","grounding","provenance"]'),
   
  ('hub://guardrails/reading_time', 'reading_time', 'Reading Time', 'Estimates reading time for the text',
   (SELECT id FROM validator_categories WHERE slug='text-quality'),
   '[{"name":"max_reading_time_minutes","type":"number","default":5,"required":false,"description":"Maximum allowed reading time in minutes"}]',
   false, '["reading-time","metrics","text-quality"]'),
   
  ('hub://guardrails/valid_url', 'valid_url', 'Valid URL', 'Validates that text contains valid URLs',
   (SELECT id FROM validator_categories WHERE slug='format-structure'),
   '[{"name":"must_contain_url","type":"boolean","default":false,"required":false,"description":"Require at least one URL"}]',
   false, '["url","format","validation"]'),
   
  ('hub://guardrails/prompt_injection', 'prompt_injection', 'Prompt Injection Detector', 'Detects prompt injection attempts',
   (SELECT id FROM validator_categories WHERE slug='security'),
   '[{"name":"threshold","type":"number","default":0.6,"required":false,"description":"Detection threshold"}]',
   false, '["security","jailbreak","injection"]'),
   
  ('hub://guardrails/politeness', 'politeness', 'Politeness Check', 'Checks if the text maintains a polite and professional tone',
   (SELECT id FROM validator_categories WHERE slug='text-quality'),
   '[{"name":"threshold","type":"number","default":0.5,"required":false,"description":"Politeness threshold"}]',
   false, '["politeness","tone","professionalism"]');
