---
name: congressgov-ingestion
description: Implements and maintains Congress.gov API v3 ingestion in app/api/ingest/route.ts, including pagination, error handling, rate limiting, and bill text retrieval. Use when the user mentions ingesting bills, Congress.gov, /api/ingest, CONGRESS_API_KEY, billType, limit, offset, or importing bills.
---

# Congress.gov API v3 Ingestion

## Quick Reference

- **Route**: `app/api/ingest/route.ts`
- **API Base**: `https://api.congress.gov/v3`
- **Env var**: `CONGRESS_API_KEY`
- **Docs**: https://api.congress.gov/

## Bill Types

| Code | Description |
|------|-------------|
| `hr` | House Bill |
| `s` | Senate Bill |
| `hjres` | House Joint Resolution |
| `sjres` | Senate Joint Resolution |
| `hconres` | House Concurrent Resolution |
| `sconres` | Senate Concurrent Resolution |
| `hres` | House Simple Resolution |
| `sres` | Senate Simple Resolution |

## API Endpoints

### List bills
```
GET /bill/{congress}/{billType}?limit={n}&offset={n}&api_key={key}
```

### Get bill details
```
GET /bill/{congress}/{billType}/{billNumber}?api_key={key}
```

### Get bill text versions
```
GET /bill/{congress}/{billType}/{billNumber}/text?api_key={key}
```

## Implementation Checklist

When implementing or modifying ingestion:

```
- [ ] Validate query params (congress, billType, limit, offset)
- [ ] Check CONGRESS_API_KEY exists before calling
- [ ] Handle rate limits (1000 requests/hour)
- [ ] Parse response and handle errors gracefully
- [ ] Return typed response matching CongressAPIResponse
```

## Rate Limiting

Congress.gov limits to **1000 requests/hour**. Implement backoff:

```typescript
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchWithBackoff(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.status === 429) {
      await delay(Math.pow(2, i) * 1000);
      continue;
    }
    return res;
  }
  throw new Error('Rate limit exceeded after retries');
}
```

## Fetching Bill XML Text

To get USLM XML for a bill:

```typescript
// 1. Get text versions list
const textUrl = `${CONGRESS_API_BASE}/bill/${congress}/${billType}/${billNumber}/text?api_key=${apiKey}`;
const textRes = await fetch(textUrl);
const { textVersions } = await textRes.json();

// 2. Find XML format URL (prefer "Formatted XML")
const xmlVersion = textVersions.find(
  (v: { type: string }) => v.type === 'Formatted XML'
);

// 3. Fetch actual XML content
if (xmlVersion?.url) {
  const xmlRes = await fetch(xmlVersion.url);
  const xml = await xmlRes.text();
}
```

## Testing Locally

```powershell
# List bills
curl "http://localhost:3000/api/ingest?congress=118&billType=hr&limit=5"

# Ingest specific bill
curl -X POST http://localhost:3000/api/ingest `
  -H "Content-Type: application/json" `
  -d '{"congress": 118, "billType": "hr", "billNumber": 1}'
```

## Error Response Format

Always return consistent error shape:

```typescript
return NextResponse.json(
  {
    error: 'Human-readable message',
    details: error instanceof Error ? error.message : 'Unknown error',
  },
  { status: 500 }
);
```
