# TaskMatrix — UI/UX Audit & Roadmap (Layer 3)

> **Project:** TaskMatrix (React + Tailwind + Capacitor/iOS, Supabase backend)
> **Stack modules in play:** `stack-react-tailwind.md`, `stack-capacitor-ios.md`,
> `stack-pwa-offline.md`
> **This doc holds:** current ✅/❌ status, deliberate exceptions, prioritized
> roadmap. Principles & mechanics are *referenced*, not repeated — see the root
> `AGENTS.md` and the stack modules above.
> **Last updated:** June 2026

---

## Deliberate exceptions to Layer 1

- **No bottom tab bar** (overrides the instinct to add platform-standard nav).
  TaskMatrix is single-view — the 2×2 matrix *is* the app. Per AGENTS.md §8
  ("match navigation depth to the use case"), adding tabs would be navigation
  the content doesn't need. Keep top bar + context switcher. **This is a
  decision, not a gap.**

## Status against the standards

| Area (→ source rule) | Status | Note |
|---|---|---|
| Optimistic updates (§4) | ✅ | add / status-change already optimistic |
| Dark mode (§6) | ✅ | system detect + manual toggle; refine off-white/halation |
| State persistence (§8) | ✅ | collapse state in localStorage |
| Touch targets ≥44px (§1) | ⚠️ | quick-add / routing / context pills slightly small — bump per react-tailwind module |
| Press/`active:` states (§4) | ❌ | hover only; add `active:scale-95` |
| Skeleton load (§4) | ❌ | shows "Loading tasks…" text — replace with 2×2 shimmer |
| `aria-label` on icon buttons (§7) | ❌ | theme/pomodoro/collapse/voice unlabeled |
| `prefers-reduced-motion` (§5) | ❌ | not yet gated |
| Dynamic type (§7) | ❌ | fixed `text-sm`/`text-base` |
| Haptics (capacitor module) | ❌ | add `@capacitor/haptics` on complete/delete |
| Safe-area insets (capacitor module) | ❌ | notch/island not yet respected |
| `100vh`→`dvh` (capacitor module) | ⚠️ | audit fixed-shell layout for this trap |
| Swipe-to-complete (§3) | ❌ | with tap fallback |
| Service worker / offline (§9, pwa module) | ❌ | goes blank offline |
| Sync queue (§9) | ❌ | offline mutations fail silently |

## Priority roadmap (high → low)

1. **PWA offline + sync queue** — most impactful: app is dead without connectivity. Service worker → shell cache → IndexedDB mutation queue → sync on reconnect.
2. **Accessibility baseline** — `aria-label` on all icon buttons + `prefers-reduced-motion` gate. Quick, high-leverage.
3. **Touch & feel** — press states, skeleton shimmer, swipe-to-complete. The "polish" layer.
4. **Capacitor native** — safe-area, `dvh`, haptics. Only matters on-device.
5. **Dynamic type** — relative units. Last because the current fixed sizes aren't broken at default zoom; this is about resilience.
