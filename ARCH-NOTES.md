# ARCH-NOTES — S2 Matrix Refactor

Architecture notes for the Matrix screen data/layout separation completed in S2.
This document serves as the handoff reference for S3 (styling) and S4 (polish).

---

## Breakpoint Constant

| Location | Value | Note |
|----------|-------|------|
| `src/lib/matrix.ts` → `MATRIX_GRID_BREAKPOINT` | `640` (px) | JS constant — available for any runtime logic |
| `src/index.css` → `@container matrix (min-width: 640px)` | `640px` | CSS mirror — must be kept in sync manually |

The breakpoint is keyed off the **container's inline-size**, not the viewport.
This means iPad split-view / multitasking correctly degrades to the list layout
when the app is given a narrow column, even on a large-screen device.

---

## Props Contract — MatrixLayoutProps

Both `MatrixGrid` and `MatrixList` implement this identical interface:

```ts
interface MatrixLayoutProps {
  buckets: QuadrantBucket[]
  onMove: (taskId: string, toQuadrant: Quadrant) => void
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
  onTaskClick: (task: Task) => void
  categories: CategoryDef[]
}
```

### QuadrantBucket

```ts
interface QuadrantBucket {
  quadrant: Quadrant          // 1 | 2 | 3 | 4
  label: string               // e.g. "Do First", "Invest"
  subtitle: string            // e.g. "urgent · important"
  tasks: Task[]
}
```

Produced by `groupTasksByQuadrant(tasks)` in `src/lib/matrix.ts`.
Called **once** in `MatrixScreen` — both layouts consume the same output.

---

## Shared Sub-Components

| Component | File | Purpose |
|-----------|------|---------|
| `QuadrantHeader` | `src/components/matrix/QuadrantHeader.tsx` | Icon tile + title + subtitle + count badge + collapse toggle |
| `CountBadge` | `src/components/matrix/CountBadge.tsx` | Numeric pill with optional quadrant tint |
| `CheckCircle` | `src/components/matrix/CheckCircle.tsx` | Status toggle (○/●) with haptic + chime |
| `TaskCard` | `src/components/TaskCard.tsx` | Full task card — DnD, long-press, move popup |

### Component Hierarchy

```
MatrixScreen (orchestrator — groups data, container query context)
├── MatrixList (narrow — single column)
│   └── ListQuadrant
│       ├── QuadrantHeader
│       │   └── CountBadge
│       └── TaskCard
│           └── CheckCircle
└── MatrixGrid (wide — 2×2 grid)
    └── GridQuadrant
        ├── QuadrantHeader
        │   └── CountBadge
        └── TaskCard
            └── CheckCircle
```

---

## Responsive Switch Mechanism

- **CSS-only**: `display: contents` / `display: none` driven by `@container matrix`.
- Both components are always in the DOM; only one is visible and laid out.
- No JS re-mounts on resize → DnD state and React state are preserved.
- No manual toggle or persisted preference — the container's width decides.

---

## "Schedule" → "Invest" Rename

All occurrences updated:

| File | What changed |
|------|-------------|
| `src/types.ts` | `QUADRANT_LABELS[2]` → `'Invest'` |
| `src/types.ts` | New `QUADRANT_SUBTITLES` map added |
| `src/types.ts` | New `QuadrantId` type, `QUADRANT_ID_MAP`, `QUADRANT_FROM_ID` |
| `src/components/TaskCard.tsx` | Local duplicate removed — now imports from `types.ts` |
| `src/components/Icons.tsx` | JSDoc comment already said "Invest" (updated in S1) |

---

## Files Changed in S2

| Action | Path |
|--------|------|
| MODIFY | `src/types.ts` |
| NEW    | `src/lib/matrix.ts` |
| NEW    | `src/components/matrix/CountBadge.tsx` |
| NEW    | `src/components/matrix/CheckCircle.tsx` |
| NEW    | `src/components/matrix/QuadrantHeader.tsx` |
| NEW    | `src/components/matrix/MatrixGrid.tsx` |
| NEW    | `src/components/matrix/MatrixList.tsx` |
| NEW    | `src/components/matrix/MatrixScreen.tsx` |
| MODIFY | `src/components/TaskCard.tsx` |
| MODIFY | `src/index.css` |
| MODIFY | `src/App.tsx` |
| NEW    | `ARCH-NOTES.md` |

`src/components/QuadrantPanel.tsx` is retained but no longer imported — can be
removed once S3/S4 styling is confirmed stable.
