---
name: repo-consistency-auditor
description: Keeps README, scripts, and environment docs consistent with actual codebase state. Use when the user mentions docs drift, scripts, setup instructions, preparing for contributors, onboarding, or documentation audit.
---

# Repository Consistency Auditor

## Quick Reference

- **README**: `README.md`
- **Package scripts**: `package.json` scripts section
- **Env template**: `.env.example`
- **Schema docs**: `supabase/schema.sql` comments + README tables

## Audit Checklist

Run through this checklist to identify inconsistencies:

```
README vs Reality:
- [ ] All npm scripts in README exist in package.json
- [ ] All env vars in README are in .env.example
- [ ] Database tables in README match schema.sql
- [ ] File structure diagram matches actual structure
- [ ] Prerequisites list is complete and accurate

package.json:
- [ ] All referenced scripts exist
- [ ] Dependencies match imports in code
- [ ] Version numbers are pinned appropriately

.env.example:
- [ ] All env vars used in code are listed
- [ ] Comments explain where to get each value
- [ ] No actual secrets included
```

## Common Issues in This Repo

### 1. Missing npm Scripts

README mentions `npm run type-check` but package.json doesn't define it.

**Fix**:
```json
{
  "scripts": {
    "type-check": "tsc --noEmit"
  }
}
```

### 2. Undocumented Environment Variables

Code uses env vars not in `.env.example`:

```typescript
// Search for process.env usage
const vars = new Set<string>();
// grep -r "process.env" --include="*.ts" --include="*.tsx"
```

Ensure each found var is in `.env.example` with explanation.

### 3. Schema Drift

When schema.sql changes, update:
1. README table documentation
2. `lib/types.ts` interfaces
3. Any migration notes

## Verification Commands

### Check Scripts Exist

```powershell
# List package.json scripts
npm run 2>&1 | Select-String "^  "

# Compare with README
Select-String "npm run" README.md
```

### Find Env Var Usage

```powershell
# Find all process.env references
Select-String -Path "app/**/*.ts","lib/**/*.ts" -Pattern "process\.env\.\w+"
```

### Validate File Structure

```powershell
# Generate current structure
Get-ChildItem -Recurse -Name -Exclude node_modules,.next,.git | 
  Where-Object { $_ -notmatch "node_modules|\.next|\.git" }
```

## Sync Workflow

When making changes that affect documentation:

1. **Before committing code changes**:
   - Note any new env vars, scripts, or schema changes

2. **Update in this order**:
   - `.env.example` (if new env vars)
   - `package.json` scripts (if new commands)
   - `lib/types.ts` (if schema changes)
   - `README.md` (last, after all else is stable)

3. **Verify**:
   - Run any new scripts to confirm they work
   - Fresh clone test: can someone follow README from scratch?

## README Section Templates

### Prerequisites Update

```markdown
### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account (free tier works)
- Congress.gov API key ([sign up here](https://api.congress.gov/sign-up/))
- OpenAI API key (for embeddings, optional)
```

### Environment Variables Table

```markdown
| Variable | Required | Description |
|----------|----------|-------------|
| `CONGRESS_API_KEY` | Yes | Congress.gov API access |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `OPENAI_API_KEY` | No | For embedding generation |
```

### Scripts Documentation

```markdown
## Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run type-check` | TypeScript validation |
```

## Automated Checks

Consider adding a CI step:

```yaml
# .github/workflows/docs-check.yml
name: Docs Consistency
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check env vars documented
        run: |
          # Extract env vars from code
          grep -roh "process\.env\.\w\+" app lib | sort -u > used.txt
          # Extract from .env.example
          grep -o "^\w\+" .env.example | sort -u > documented.txt
          # Find undocumented
          comm -23 used.txt documented.txt && exit 1 || exit 0
```

## Quick Fixes

### Add Missing Script

```json
// package.json
{
  "scripts": {
    "existing": "...",
    "new-script": "command here"
  }
}
```

### Add Missing Env Var

```bash
# .env.example
# Description of what this is for
NEW_VAR=placeholder_value_here
```

### Update File Structure in README

Replace the structure section with output from:
```powershell
tree /F /A | Select-String -NotMatch "node_modules|\.next|\.git"
```
