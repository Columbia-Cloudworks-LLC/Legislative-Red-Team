---
name: supabase-bills-storage
description: Adds and maintains Supabase client usage for writing bills and loopholes rows, matching supabase/schema.sql and lib/types.ts. Use when the user mentions Supabase, SUPABASE_URL, SUPABASE_ANON_KEY, upsert, RLS, storing bills, or storing loopholes.
---

# Supabase Bills & Loopholes Storage

## Quick Reference

- **Schema**: `supabase/schema.sql`
- **Types**: `lib/types.ts`
- **Env vars**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`

## Client Setup

Create a server-only Supabase client factory:

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export function createSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }
  
  return createClient<Database>(url, key);
}
```

**Install**: `npm install @supabase/supabase-js`

## Table Schemas

### bills

| Column | Type | Notes |
|--------|------|-------|
| `congress_id` | TEXT PK | Format: `{congress}-{type}-{number}` |
| `last_version_xml` | TEXT | USLM XML content |
| `title` | TEXT | Bill title |
| `sponsor` | TEXT | Sponsor name |
| `introduced_date` | DATE | Introduction date |
| `status` | TEXT | Latest action text |

### loopholes

| Column | Type | Notes |
|--------|------|-------|
| `id` | BIGSERIAL PK | Auto-generated |
| `bill_id` | TEXT FK | References bills.congress_id |
| `type` | TEXT | e.g., 'ambiguous_reference' |
| `severity` | TEXT | 'high', 'medium', 'low' |
| `description` | TEXT | Loophole description |
| `affected_sections` | TEXT[] | USLM identifiers |
| `reviewed` | BOOLEAN | Default false |

## Common Operations

### Upsert a bill

```typescript
import { createSupabaseClient } from '@/lib/supabase';
import type { Bill } from '@/lib/types';

const supabase = createSupabaseClient();

const bill: Bill = {
  congress_id: `${congress}-${billType}-${billNumber}`,
  title: billData.title,
  sponsor: billData.sponsors?.[0]?.lastName,
  introduced_date: billData.introducedDate,
  status: billData.latestAction?.text,
  last_version_xml: xmlContent,
};

const { error } = await supabase
  .from('bills')
  .upsert(bill, { onConflict: 'congress_id' });

if (error) throw error;
```

### Insert a loophole

```typescript
import type { Loophole } from '@/lib/types';

const loophole: Omit<Loophole, 'id' | 'detected_at'> = {
  bill_id: congressId,
  type: 'circular_dependency',
  severity: 'high',
  description: 'Section A references Section B which references Section A',
  affected_sections: ['/us/usc/t42/s1983', '/us/usc/t42/s1984'],
  reviewed: false,
};

const { error } = await supabase.from('loopholes').insert(loophole);
```

### Query unreviewed loopholes

```typescript
const { data, error } = await supabase
  .from('loopholes')
  .select('*')
  .eq('reviewed', false)
  .order('severity', { ascending: false });
```

## RLS Policies

Current policies (defined in schema.sql):

| Table | SELECT | INSERT/UPDATE |
|-------|--------|---------------|
| bills | Public (anyone) | Authenticated only |
| loopholes | Public (anyone) | Authenticated only |
| us_code | Public (anyone) | Authenticated only |

**For server-side writes**: Use service role key if bypassing RLS:

```typescript
// Only for trusted server-side operations
const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

## Checklist

```
- [ ] Supabase client created with correct env vars
- [ ] Types imported from lib/types.ts
- [ ] Upsert uses onConflict for idempotency
- [ ] Errors are caught and logged
- [ ] RLS policy matches use case (anon vs service role)
```
