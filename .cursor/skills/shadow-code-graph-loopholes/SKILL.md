---
name: shadow-code-graph-loopholes
description: Implements graph construction and loophole detection in lib/graph.ts including cycles, orphans, ambiguous refs, and stores results to the loopholes table. Use when the user mentions Shadow Code Graph, circular references, loophole detection, severity scoring, dependency analysis, or analyzing cross-references.
---

# Shadow Code Graph & Loophole Detection

## Quick Reference

- **File**: `lib/graph.ts`
- **Types**: `USLMNode`, `USLMEdge`, `ShadowCodeGraph`
- **Storage**: `loopholes` table in Supabase

## Graph Structure

```typescript
// Nodes: USLM identifiers
interface USLMNode {
  identifier: string;        // e.g., "/us/usc/t42/s1983"
  citation: string;          // e.g., "42 U.S.C. § 1983"
  nodeType: 'title' | 'chapter' | 'section' | ...;
}

// Edges: References between nodes
interface USLMEdge {
  from: string;              // Source identifier
  to: string;                // Target identifier
  refType: 'citation' | 'amendment' | 'repeal' | 'definition';
  context?: string;          // Optional context text
}
```

## Building the Graph

```typescript
import { createParser, USLMDocument } from './parser';

async function buildGraphFromDocuments(
  documents: USLMDocument[]
): Promise<ShadowCodeGraph> {
  const graph = createGraph();
  
  for (const doc of documents) {
    // Add root node
    graph.addNode({
      identifier: doc.identifier,
      citation: formatCitation(doc.identifier),
      nodeType: inferNodeType(doc.root.type),
    });
    
    // Add edges from references
    for (const ref of doc.references) {
      graph.addEdge({
        from: doc.identifier,
        to: ref.target,
        refType: ref.type,
        context: ref.text,
      });
    }
  }
  
  return graph;
}
```

## Loophole Detection Algorithms

### 1. Circular References (High Severity)

```typescript
detectCircularReferences(): LoopholeResult[] {
  const loopholes: LoopholeResult[] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  
  const dfs = (nodeId: string, path: string[]): void => {
    if (stack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      const cycle = path.slice(cycleStart);
      loopholes.push({
        type: 'circular_dependency',
        severity: 'high',
        description: `Circular reference chain: ${cycle.join(' → ')} → ${nodeId}`,
        affectedNodes: [...cycle, nodeId],
      });
      return;
    }
    
    if (visited.has(nodeId)) return;
    
    visited.add(nodeId);
    stack.add(nodeId);
    
    for (const edge of this.getEdgesFrom(nodeId)) {
      dfs(edge.to, [...path, nodeId]);
    }
    
    stack.delete(nodeId);
  };
  
  for (const node of this.getAllNodes()) {
    dfs(node.identifier, []);
  }
  
  return loopholes;
}
```

### 2. Orphaned Sections (Medium Severity)

```typescript
detectOrphanedSections(): LoopholeResult[] {
  const loopholes: LoopholeResult[] = [];
  const referenced = new Set<string>();
  
  // Collect all referenced nodes
  for (const edge of this.getAllEdges()) {
    referenced.add(edge.to);
  }
  
  // Find nodes that reference others but are never referenced
  for (const node of this.getAllNodes()) {
    const hasOutgoing = this.getEdgesFrom(node.identifier).length > 0;
    const hasIncoming = referenced.has(node.identifier);
    
    if (hasOutgoing && !hasIncoming) {
      loopholes.push({
        type: 'orphaned_section',
        severity: 'medium',
        description: `Section ${node.citation} references other sections but is never referenced`,
        affectedNodes: [node.identifier],
      });
    }
  }
  
  return loopholes;
}
```

### 3. Dangling References (Medium Severity)

```typescript
detectDanglingReferences(): LoopholeResult[] {
  const loopholes: LoopholeResult[] = [];
  const nodeIds = new Set(this.getAllNodes().map(n => n.identifier));
  
  for (const edge of this.getAllEdges()) {
    if (!nodeIds.has(edge.to)) {
      loopholes.push({
        type: 'dangling_reference',
        severity: 'medium',
        description: `Reference to non-existent section: ${edge.to}`,
        affectedNodes: [edge.from, edge.to],
      });
    }
  }
  
  return loopholes;
}
```

### 4. Ambiguous References (Low Severity)

```typescript
detectAmbiguousReferences(): LoopholeResult[] {
  const loopholes: LoopholeResult[] = [];
  
  // Group edges by similar targets
  const edgesByTarget = new Map<string, USLMEdge[]>();
  for (const edge of this.getAllEdges()) {
    const base = edge.to.replace(/\/[^/]+$/, ''); // Remove last segment
    const group = edgesByTarget.get(base) || [];
    group.push(edge);
    edgesByTarget.set(base, group);
  }
  
  // Find groups with multiple similar but not identical targets
  for (const [base, edges] of edgesByTarget) {
    const uniqueTargets = new Set(edges.map(e => e.to));
    if (uniqueTargets.size > 1 && uniqueTargets.size < 5) {
      loopholes.push({
        type: 'ambiguous_reference',
        severity: 'low',
        description: `Multiple similar references under ${base}`,
        affectedNodes: [...uniqueTargets],
      });
    }
  }
  
  return loopholes;
}
```

## Complete detectLoopholes Implementation

```typescript
async detectLoopholes(): Promise<LoopholeResult[]> {
  return [
    ...this.detectCircularReferences(),
    ...this.detectOrphanedSections(),
    ...this.detectDanglingReferences(),
    ...this.detectAmbiguousReferences(),
  ];
}
```

## Storing Results

```typescript
import { createSupabaseClient } from '@/lib/supabase';

async function storeLoopholes(
  billId: string | null,
  loopholes: LoopholeResult[]
) {
  const supabase = createSupabaseClient();
  
  const rows = loopholes.map(l => ({
    bill_id: billId,
    type: l.type,
    severity: l.severity,
    description: l.description,
    affected_sections: l.affectedNodes,
    reviewed: false,
  }));
  
  const { error } = await supabase.from('loopholes').insert(rows);
  if (error) throw error;
}
```

## Severity Rubric

| Severity | Criteria | Examples |
|----------|----------|----------|
| **high** | Creates legal ambiguity or exploitable gap | Circular refs, conflicting definitions |
| **medium** | Structural issue, may cause confusion | Orphans, dangling refs |
| **low** | Style/consistency issue | Similar references, minor ambiguity |

## Checklist

```
- [ ] Graph built from parsed USLM documents
- [ ] Circular reference detection with DFS
- [ ] Orphaned section detection
- [ ] Dangling reference detection
- [ ] Severity correctly assigned
- [ ] Results stored to loopholes table
- [ ] Affected sections use USLM identifiers
```
