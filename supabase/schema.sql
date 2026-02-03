-- Legislative Red Team - Supabase Schema
-- Schema for tracking US Code, bills, and potential loopholes

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS vector; -- For embeddings

-- Table: us_code
-- Stores sections of the United States Code
CREATE TABLE us_code (
  citation TEXT PRIMARY KEY, -- e.g., "42 U.S.C. § 1983"
  text TEXT NOT NULL, -- Full text of the code section
  identifier_path TEXT NOT NULL, -- USLM identifier path, e.g., "/us/usc/t42/s1983"
  embedding vector(1536), -- OpenAI ada-002 embedding dimension
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for vector similarity search
CREATE INDEX us_code_embedding_idx ON us_code 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index for identifier path lookups
CREATE INDEX us_code_identifier_path_idx ON us_code (identifier_path);

-- Table: bills
-- Stores congressional bills from Congress.gov
CREATE TABLE bills (
  congress_id TEXT PRIMARY KEY, -- e.g., "118-hr-1234"
  last_version_xml TEXT, -- Latest version of bill in USLM XML format
  title TEXT, -- Bill title
  sponsor TEXT, -- Bill sponsor
  introduced_date DATE, -- Date introduced
  status TEXT, -- Current status
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for searching by congress number
CREATE INDEX bills_congress_idx ON bills (SUBSTRING(congress_id FROM '^[0-9]+'));

-- Table: loopholes
-- Stores identified potential loopholes in bills or existing code
CREATE TABLE loopholes (
  id BIGSERIAL PRIMARY KEY,
  bill_id TEXT REFERENCES bills(congress_id), -- Reference to bill (null if in existing code)
  type TEXT NOT NULL, -- Type of loophole (e.g., 'ambiguous_reference', 'circular_dependency', 'scope_gap')
  severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  description TEXT NOT NULL, -- Description of the loophole
  affected_sections TEXT[], -- Array of affected USLM identifiers
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT
);

-- Index for querying by bill
CREATE INDEX loopholes_bill_id_idx ON loopholes (bill_id);

-- Index for querying by severity
CREATE INDEX loopholes_severity_idx ON loopholes (severity);

-- Index for querying unreviewed loopholes
CREATE INDEX loopholes_reviewed_idx ON loopholes (reviewed) WHERE reviewed = FALSE;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_us_code_updated_at
  BEFORE UPDATE ON us_code
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bills_updated_at
  BEFORE UPDATE ON bills
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
-- Enable RLS on all tables
ALTER TABLE us_code ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE loopholes ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables (data is CC0)
CREATE POLICY "Public read access for us_code"
  ON us_code FOR SELECT
  USING (true);

CREATE POLICY "Public read access for bills"
  ON bills FOR SELECT
  USING (true);

CREATE POLICY "Public read access for loopholes"
  ON loopholes FOR SELECT
  USING (true);

-- Authenticated write access (can be adjusted based on auth requirements)
CREATE POLICY "Authenticated write access for us_code"
  ON us_code FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated update access for us_code"
  ON us_code FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated write access for bills"
  ON bills FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated update access for bills"
  ON bills FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated write access for loopholes"
  ON loopholes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated update access for loopholes"
  ON loopholes FOR UPDATE
  USING (auth.role() = 'authenticated');
