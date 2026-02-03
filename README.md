# Legislative Red Team

An application for finding loopholes in existing and proposed laws that bad actors can exploit. The goal is to strengthen legislative language by identifying these problems at scale across the entire corpus of United States law.

## Overview

Legislative Red Team uses AI and graph analysis to analyze U.S. Code and congressional bills, identifying potential loopholes, ambiguities, and exploitable gaps in legal language.

### Key Features

- **Shadow Code Graph**: Tracks relationships between USLM (United States Legislative Markup) identifiers to map dependencies and cross-references
- **USLM 2.0.17 Parser**: Extracts hierarchical structure and references from legislative XML documents
- **Congress.gov Integration**: Automatically ingests bills via Congress.gov API v3
- **Loophole Detection**: Identifies potential issues including circular references, ambiguous language, and scope gaps

## Tech Stack

- **Next.js 16** (meets Next.js 14+ requirement) with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Supabase** for PostgreSQL database with vector embeddings
- **Vercel** for deployment

## Database Schema

### Tables

#### `us_code`
Stores sections of the United States Code with embeddings for semantic search.

| Column | Type | Description |
|--------|------|-------------|
| `citation` | TEXT (PK) | Human-readable citation (e.g., "42 U.S.C. § 1983") |
| `text` | TEXT | Full text of the code section |
| `identifier_path` | TEXT | USLM identifier (e.g., "/us/usc/t42/s1983") |
| `embedding` | vector(1536) | OpenAI embedding for semantic search |

#### `bills`
Stores congressional bills from Congress.gov.

| Column | Type | Description |
|--------|------|-------------|
| `congress_id` | TEXT (PK) | Unique identifier (e.g., "118-hr-1234") |
| `last_version_xml` | TEXT | Latest bill version in USLM XML format |
| `title` | TEXT | Bill title |
| `sponsor` | TEXT | Bill sponsor name |
| `introduced_date` | DATE | Date bill was introduced |
| `status` | TEXT | Current status of bill |

#### `loopholes`
Stores identified potential loopholes.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL (PK) | Auto-generated ID |
| `bill_id` | TEXT | Reference to bill (null if in existing code) |
| `type` | TEXT | Type of loophole |
| `severity` | TEXT | Severity: 'high', 'medium', or 'low' |
| `description` | TEXT | Detailed description |
| `affected_sections` | TEXT[] | Array of affected USLM identifiers |
| `reviewed` | BOOLEAN | Whether loophole has been reviewed |

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Congress.gov API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Columbia-Cloudworks-LLC/Legislative-Red-Team.git
cd Legislative-Red-Team
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:
- Get Congress.gov API key from: https://api.congress.gov/sign-up/
- Get Supabase credentials from your project settings

4. Set up Supabase database:

Run the schema in `supabase/schema.sql` in your Supabase SQL editor.

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Routes

### `/api/ingest`

Ingests bills from Congress.gov API v3.

**GET**: Fetch bills
- Query params: `congress`, `billType`, `limit`, `offset`
- Example: `/api/ingest?congress=118&billType=hr&limit=20`

**POST**: Ingest a specific bill
- Body: `{ congress: number, billType: string, billNumber: number }`
- Stores bill data in Supabase

## Project Structure

```
Legislative-Red-Team/
├── app/
│   ├── api/
│   │   └── ingest/
│   │       └── route.ts          # Congress.gov API integration
│   ├── page.tsx                  # Home page
│   └── layout.tsx                # Root layout
├── lib/
│   ├── graph.ts                  # Shadow Code Graph engine
│   ├── parser.ts                 # USLM 2.0.17 parser
│   └── types.ts                  # TypeScript type definitions
├── supabase/
│   └── schema.sql                # Database schema
├── public/                       # Static assets
├── LICENSE                       # AGPLv3 license
└── README.md                     # This file
```

## Development

### Build
```bash
npm run build
```

### Lint
```bash
npm run lint
```

### Type Check
```bash
npm run type-check
```

## Deployment

This app is designed to be deployed on Vercel with Supabase as the database.

1. Push your code to GitHub
2. Import project in Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

## Contributing

Contributions are welcome! Please ensure:

1. Code passes TypeScript checks
2. Code passes ESLint
3. New features include appropriate documentation

## License

This software is licensed under AGPLv3 (see LICENSE file).

**Public Utility / Data is CC0** - All data generated and published by this application is released into the public domain under the Creative Commons Zero (CC0) license.

## Acknowledgments

- Congress.gov API v3 for legislative data
- USLM (United States Legislative Markup) specification
- Supabase for database and vector search capabilities
