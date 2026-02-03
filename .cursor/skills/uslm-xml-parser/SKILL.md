---
name: uslm-xml-parser
description: Implements USLM 2.0.17 XML parsing in lib/parser.ts including hierarchy extraction, identifier paths, ref extraction, and validation. Use when the user mentions USLM, XML parsing, parse bill text, identifier paths like /us/usc/, reference extraction, or legislative markup.
---

# USLM 2.0.17 XML Parser

## Quick Reference

- **File**: `lib/parser.ts`
- **Types**: `USLMDocument`, `USLMElement`, `USLMReference`
- **Namespace**: `http://xml.house.gov/schemas/uslm/1.0`

## USLM Hierarchy (top to bottom)

```
title → subtitle → chapter → subchapter → part → subpart → 
section → subsection → paragraph → subparagraph → 
clause → subclause → item → subitem
```

## Parsing Implementation

Use DOMParser (browser) or a library like `fast-xml-parser`:

```typescript
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true, // Strip namespace prefixes
});

async parse(xmlContent: string): Promise<USLMDocument> {
  const doc = parser.parse(xmlContent);
  const root = doc.lawDoc || doc.bill || doc.resolution;
  
  if (!root) {
    throw new Error('Invalid USLM document: no root element found');
  }
  
  const docType = root['@_docType'] || 'unknown';
  const identifier = root['@_identifier'] || '';
  
  return {
    docType,
    identifier,
    root: this.parseElement(root),
    references: this.extractAllReferences(root),
  };
}
```

**Install**: `npm install fast-xml-parser`

## Element Parsing

```typescript
private parseElement(node: any): USLMElement {
  const HIERARCHY = [
    'title', 'subtitle', 'chapter', 'subchapter', 
    'part', 'subpart', 'section', 'subsection',
    'paragraph', 'subparagraph', 'clause', 'subclause',
    'item', 'subitem'
  ];
  
  // Find element type
  let type = 'unknown';
  for (const h of HIERARCHY) {
    if (node[h]) {
      type = h;
      break;
    }
  }
  
  return {
    type,
    identifier: node['@_identifier'] || '',
    num: node.num?.['#text'] || node.num,
    heading: node.heading?.['#text'] || node.heading,
    content: this.extractContent(node),
    children: this.parseChildren(node, HIERARCHY),
    refs: this.extractReferences(node),
  };
}
```

## Reference Extraction

USLM uses `<ref>` tags for cross-references:

```typescript
extractReferences(element: any): USLMReference[] {
  const refs: USLMReference[] = [];
  
  const extractFromNode = (node: any) => {
    if (!node || typeof node !== 'object') return;
    
    // Handle ref elements
    if (node.ref) {
      const refNodes = Array.isArray(node.ref) ? node.ref : [node.ref];
      for (const ref of refNodes) {
        refs.push({
          type: this.classifyRefType(ref['@_href'] || ''),
          target: ref['@_href'] || '',
          text: ref['#text'] || '',
        });
      }
    }
    
    // Recurse into children
    for (const key of Object.keys(node)) {
      if (!key.startsWith('@_') && typeof node[key] === 'object') {
        extractFromNode(node[key]);
      }
    }
  };
  
  extractFromNode(element);
  return refs;
}

private classifyRefType(href: string): USLMReference['type'] {
  if (href.includes('/amend/')) return 'amendment';
  if (href.includes('/repeal/')) return 'repeal';
  if (href.includes('/def/')) return 'definition';
  return 'citation';
}
```

## Identifier Path Building

```typescript
buildIdentifierPath(element: USLMElement): string {
  // Example: /us/usc/t42/s1983
  // Pattern: /us/{docType}/t{title}/s{section}
  
  const parts = element.identifier.split('/').filter(Boolean);
  return '/' + parts.join('/');
}
```

Parse existing identifiers:

```typescript
// Already in lib/parser.ts
export function parseIdentifier(identifier: string): Record<string, string> {
  const parts = identifier.split('/').filter(Boolean);
  const result: Record<string, string> = {};
  
  // Pairs: us, usc, t42, s1983 → { us: 'usc', t: '42', s: '1983' }
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const match = part.match(/^([a-z]+)(\d+)?$/);
    if (match) {
      result[match[1]] = match[2] || parts[i + 1] || '';
    }
  }
  
  return result;
}
```

## Validation

```typescript
async validate(xmlContent: string): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    const doc = parser.parse(xmlContent);
    
    // Check for required root element
    if (!doc.lawDoc && !doc.bill && !doc.resolution) {
      errors.push('Missing required root element (lawDoc, bill, or resolution)');
    }
    
    // Check namespace (if attributes preserved)
    const root = doc.lawDoc || doc.bill || doc.resolution;
    if (root && !root['@_xmlns']?.includes('uslm')) {
      errors.push('Missing or invalid USLM namespace');
    }
    
  } catch (e) {
    errors.push(`XML parse error: ${e instanceof Error ? e.message : 'Unknown'}`);
  }
  
  return { valid: errors.length === 0, errors };
}
```

## Test Fixture Pattern

Create minimal test cases:

```typescript
// __tests__/parser.test.ts
const MINIMAL_USLM = `<?xml version="1.0"?>
<bill xmlns="http://xml.house.gov/schemas/uslm/1.0" identifier="/us/bill/118/hr/1">
  <section identifier="/us/bill/118/hr/1/s1">
    <num>1</num>
    <heading>Short title</heading>
    <content>This Act may be cited as the "Example Act".</content>
    <ref href="/us/usc/t42/s1983">42 U.S.C. 1983</ref>
  </section>
</bill>`;

test('parses minimal USLM document', async () => {
  const parser = createParser();
  const doc = await parser.parse(MINIMAL_USLM);
  
  expect(doc.docType).toBe('bill');
  expect(doc.references).toHaveLength(1);
  expect(doc.references[0].target).toBe('/us/usc/t42/s1983');
});
```

## Checklist

```
- [ ] fast-xml-parser installed
- [ ] Namespace handling configured (removeNSPrefix: true)
- [ ] All hierarchy levels parsed
- [ ] References extracted from <ref> tags
- [ ] Identifier paths follow /us/usc/tN/sN pattern
- [ ] Validation returns structured errors
```
