---
name: nextjs-app-router-api-conventions
description: Applies Next.js App Router conventions for route handlers including request parsing, typed responses, status codes, and caching. Use when the user mentions Next.js route handlers, NextRequest, NextResponse, adding new API routes, or app/api/ routes.
---

# Next.js App Router API Conventions

## Quick Reference

- **Location**: `app/api/{route}/route.ts`
- **Imports**: `NextRequest`, `NextResponse` from `next/server`
- **HTTP methods**: Export named functions `GET`, `POST`, `PUT`, `PATCH`, `DELETE`

## Route Handler Template

```typescript
// app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const param = searchParams.get('param');
    
    // Business logic...
    
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in GET /api/example:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse JSON body
    const body = await request.json();
    
    // Validate required fields
    if (!body.requiredField) {
      return NextResponse.json(
        { error: 'Missing required field: requiredField' },
        { status: 400 }
      );
    }
    
    // Business logic...
    
    return NextResponse.json(
      { success: true, data: result },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/example:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Status Codes

| Status | When to Use |
|--------|-------------|
| 200 | Successful GET/PUT/PATCH |
| 201 | Successful POST (created) |
| 204 | Successful DELETE (no content) |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (no auth) |
| 403 | Forbidden (auth but no access) |
| 404 | Resource not found |
| 500 | Internal server error |

## Request Parsing

### Query Parameters

```typescript
const searchParams = request.nextUrl.searchParams;
const id = searchParams.get('id');                    // string | null
const limit = parseInt(searchParams.get('limit') || '20');
const tags = searchParams.getAll('tag');              // string[]
```

### JSON Body

```typescript
const body = await request.json();
// Type assertion if needed
const { field1, field2 } = body as { field1: string; field2: number };
```

### Headers

```typescript
const authHeader = request.headers.get('authorization');
const contentType = request.headers.get('content-type');
```

## Response Patterns

### JSON Response

```typescript
return NextResponse.json(data);
return NextResponse.json(data, { status: 201 });
```

### With Headers

```typescript
return NextResponse.json(data, {
  headers: {
    'Cache-Control': 'max-age=60',
    'X-Custom-Header': 'value',
  },
});
```

### Redirect

```typescript
import { redirect } from 'next/navigation';
redirect('/new-path');
```

## Caching

### Opt Out of Caching (Dynamic)

```typescript
export const dynamic = 'force-dynamic';
export const revalidate = 0;
```

### Static with Revalidation

```typescript
export const revalidate = 3600; // Revalidate every hour
```

## Environment Variables

Access server-side env vars directly:

```typescript
const apiKey = process.env.CONGRESS_API_KEY;
if (!apiKey) {
  return NextResponse.json(
    { error: 'API key not configured' },
    { status: 500 }
  );
}
```

## Error Handling Pattern

```typescript
function handleError(error: unknown, context: string) {
  console.error(`Error in ${context}:`, error);
  return NextResponse.json(
    {
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    },
    { status: 500 }
  );
}

// Usage
export async function GET(request: NextRequest) {
  try {
    // ...
  } catch (error) {
    return handleError(error, 'GET /api/example');
  }
}
```

## Dynamic Route Segments

```typescript
// app/api/bills/[congressId]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ congressId: string }> }
) {
  const { congressId } = await params;
  // ...
}
```

## Middleware-like Validation

```typescript
function validateApiKey(request: NextRequest): NextResponse | null {
  const apiKey = request.headers.get('x-api-key');
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }
  return null; // Valid
}

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;
  
  // Continue with handler...
}
```

## Checklist for New Routes

```
- [ ] File at app/api/{path}/route.ts
- [ ] Exports named HTTP method functions
- [ ] Try/catch with consistent error responses
- [ ] Query params validated and typed
- [ ] Body parsed and validated for POST/PUT
- [ ] Correct status codes used
- [ ] Console.error for debugging
- [ ] Environment variables checked before use
```
