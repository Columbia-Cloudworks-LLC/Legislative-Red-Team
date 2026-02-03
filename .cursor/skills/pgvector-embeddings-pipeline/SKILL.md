---
name: pgvector-embeddings-pipeline
description: Builds the embeddings workflow for us_code.embedding vector(1536) and similarity search on Supabase/Postgres with pgvector. Use when the user mentions embeddings, vectors, semantic search, pgvector, OPENAI_API_KEY, embed US Code, or similarity search.
---

# pgvector Embeddings Pipeline

## Quick Reference

- **Table**: `us_code` with `embedding vector(1536)`
- **Model**: OpenAI `text-embedding-ada-002` (1536 dimensions)
- **Index**: IVFFlat with cosine similarity
- **Env var**: `OPENAI_API_KEY`

## Generate Embeddings

```typescript
// lib/embeddings.ts
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });
  return response.data[0].embedding;
}
```

**Install**: `npm install openai`

## Chunking Strategy

US Code sections can be long. Chunk by:

1. **Subsection boundaries** - Split at subsection markers
2. **Token limit** - Stay under 8191 tokens per chunk
3. **Overlap** - 100-200 token overlap for context continuity

```typescript
function chunkText(text: string, maxTokens = 4000): string[] {
  // Simple paragraph-based chunking
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';
  
  for (const para of paragraphs) {
    if ((current + para).length > maxTokens * 4) { // ~4 chars/token
      if (current) chunks.push(current.trim());
      current = para;
    } else {
      current += '\n\n' + para;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}
```

## Upsert with Embedding

```typescript
import { createSupabaseClient } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/embeddings';

async function upsertCodeSection(
  citation: string,
  text: string,
  identifierPath: string
) {
  const supabase = createSupabaseClient();
  const embedding = await generateEmbedding(text);
  
  const { error } = await supabase.from('us_code').upsert(
    {
      citation,
      text,
      identifier_path: identifierPath,
      embedding,
    },
    { onConflict: 'citation' }
  );
  
  if (error) throw error;
}
```

## Similarity Search

Create an RPC function in Supabase for vector search:

```sql
-- Add to supabase/schema.sql
CREATE OR REPLACE FUNCTION match_us_code(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  citation text,
  text text,
  identifier_path text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    us_code.citation,
    us_code.text,
    us_code.identifier_path,
    1 - (us_code.embedding <=> query_embedding) as similarity
  FROM us_code
  WHERE 1 - (us_code.embedding <=> query_embedding) > match_threshold
  ORDER BY us_code.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

Call from TypeScript:

```typescript
async function searchSimilar(queryText: string, limit = 10) {
  const supabase = createSupabaseClient();
  const embedding = await generateEmbedding(queryText);
  
  const { data, error } = await supabase.rpc('match_us_code', {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: limit,
  });
  
  if (error) throw error;
  return data;
}
```

## Batch Processing

For bulk embedding operations:

```typescript
async function batchEmbed(sections: { citation: string; text: string }[]) {
  const BATCH_SIZE = 20;
  const DELAY_MS = 100; // Rate limit buffer
  
  for (let i = 0; i < sections.length; i += BATCH_SIZE) {
    const batch = sections.slice(i, i + BATCH_SIZE);
    
    await Promise.all(
      batch.map(s => upsertCodeSection(s.citation, s.text, s.identifierPath))
    );
    
    await new Promise(r => setTimeout(r, DELAY_MS));
    console.log(`Processed ${Math.min(i + BATCH_SIZE, sections.length)}/${sections.length}`);
  }
}
```

## Index Health

The schema uses IVFFlat index. After bulk inserts, rebuild:

```sql
-- Check index health
SELECT * FROM pg_stat_user_indexes WHERE indexrelname = 'us_code_embedding_idx';

-- Rebuild if needed (after large batch inserts)
REINDEX INDEX us_code_embedding_idx;
```

## Checklist

```
- [ ] OPENAI_API_KEY configured
- [ ] Text chunked appropriately (<8k tokens)
- [ ] Embeddings stored as number[] arrays
- [ ] Upsert uses citation as conflict key
- [ ] match_us_code RPC function created
- [ ] Index rebuilt after bulk operations
```
