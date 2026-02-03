---
name: schema-sql-rls-migrations
description: Safely edits supabase/schema.sql including pgvector, indexes, triggers, and RLS policies. Use when the user mentions schema changes, RLS, policies, indexes, triggers, migrations, Supabase SQL, or database schema.
---

# Supabase Schema & RLS Migrations

## Quick Reference

- **Schema file**: `supabase/schema.sql`
- **Extensions**: `vector` (pgvector)
- **Tables**: `us_code`, `bills`, `loopholes`

## Current Schema Overview

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- Tables
us_code (citation PK, text, identifier_path, embedding vector(1536))
bills (congress_id PK, last_version_xml, title, sponsor, introduced_date, status)
loopholes (id BIGSERIAL PK, bill_id FK, type, severity, description, affected_sections[])

-- All tables have: created_at, updated_at (auto-managed)
-- RLS: Public SELECT, Authenticated INSERT/UPDATE
```

## Adding New Columns

```sql
-- Add column with sensible default
ALTER TABLE bills ADD COLUMN analyzed BOOLEAN DEFAULT FALSE;

-- Add index if frequently queried
CREATE INDEX bills_analyzed_idx ON bills (analyzed) WHERE analyzed = FALSE;

-- Update types.ts to match
```

Always update `lib/types.ts` after schema changes.

## Adding New Tables

Template:

```sql
CREATE TABLE new_table (
  id BIGSERIAL PRIMARY KEY,
  -- columns...
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add updated_at trigger
CREATE TRIGGER update_new_table_updated_at
  BEFORE UPDATE ON new_table
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Add policies (see RLS section)
```

## RLS Policy Patterns

### Public Read, Authenticated Write

```sql
-- Read: anyone can SELECT
CREATE POLICY "Public read access for {table}"
  ON {table} FOR SELECT
  USING (true);

-- Write: must be authenticated
CREATE POLICY "Authenticated write access for {table}"
  ON {table} FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated update access for {table}"
  ON {table} FOR UPDATE
  USING (auth.role() = 'authenticated');
```

### Owner-Only Access

```sql
-- Only row owner can read/write
CREATE POLICY "Owner access for {table}"
  ON {table} FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Service Role Bypass

For server-side operations that need to bypass RLS:

```typescript
// Use SUPABASE_SERVICE_ROLE_KEY instead of ANON_KEY
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
```

## Index Guidelines

| Pattern | Index Type | When to Use |
|---------|------------|-------------|
| Exact match | B-tree (default) | `WHERE col = value` |
| Vector similarity | IVFFlat | `ORDER BY embedding <=>` |
| Partial index | B-tree + WHERE | Filtering common subset |
| Array contains | GIN | `WHERE arr @> ARRAY[...]` |

### Vector Index Tuning

```sql
-- Current: 100 lists (good for <100k rows)
CREATE INDEX us_code_embedding_idx ON us_code 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- For larger datasets (>1M rows): increase lists
-- Rule of thumb: lists = sqrt(num_rows)
DROP INDEX us_code_embedding_idx;
CREATE INDEX us_code_embedding_idx ON us_code 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 1000);
```

## Migration Checklist

Before applying schema changes:

```
- [ ] Backup existing data (for production)
- [ ] New columns have DEFAULT or are nullable
- [ ] Foreign keys reference valid tables
- [ ] RLS enabled on new tables
- [ ] Policies cover SELECT, INSERT, UPDATE as needed
- [ ] Indexes added for common query patterns
- [ ] updated_at trigger added
- [ ] lib/types.ts updated to match
- [ ] Changes tested in Supabase SQL editor
```

## Rollback Patterns

### Safe Column Removal

```sql
-- 1. Make column nullable first (if not already)
ALTER TABLE bills ALTER COLUMN old_column DROP NOT NULL;

-- 2. Remove from application code
-- 3. After confirming no usage:
ALTER TABLE bills DROP COLUMN old_column;
```

### Safe Index Removal

```sql
-- Indexes can be dropped without data loss
DROP INDEX IF EXISTS old_index_name;
```

### Policy Updates

```sql
-- Drop old policy
DROP POLICY IF EXISTS "Old policy name" ON table_name;

-- Create new policy
CREATE POLICY "New policy name" ON table_name ...;
```

## Common Patterns

### Add RPC Function

```sql
CREATE OR REPLACE FUNCTION function_name(param1 type1)
RETURNS return_type
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with creator's permissions
AS $$
BEGIN
  -- logic
END;
$$;
```

### Add CHECK Constraint

```sql
ALTER TABLE loopholes 
  ADD CONSTRAINT valid_severity 
  CHECK (severity IN ('high', 'medium', 'low'));
```

## Verification Queries

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public';

-- List policies
SELECT tablename, policyname, cmd, qual 
FROM pg_policies WHERE schemaname = 'public';

-- Check indexes
SELECT indexname, indexdef FROM pg_indexes 
WHERE schemaname = 'public';
```
