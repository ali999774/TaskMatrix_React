# TaskMatrix — UI/UX Synthesis & Recommendations

> **Compiled:** June 5, 2026  
> **Sources:** Apple HIG (Liquid Glass, iOS 26), Material Design 3 Expressive, Capacitor cross-platform guides, 2026 mobile UX best practices, PWA UX strategies  
> **Context:** React + Tailwind + Capacitor (iOS wrapper), Eisenhower Matrix task manager

---

## 1. iOS 26 & Liquid Glass — What Changed

Apple's most significant visual redesign since iOS 7 landed in mid-2025. Key implications for TaskMatrix:

- **Translucent, floating elements** — toolbars and controls appear as glass-like floating elements, not pinned to bezels
- **Dynamic response to light/content** — UI elements react to what's behind them
- **Unified across all Apple platforms** — same design language on iPhone, iPad, Mac
- **SF Symbols 6,900+ icons** — free, integrated with San Francisco font

**Our take:** TaskMatrix already uses `backdrop-blur` on the sticky header — that's Liquid Glass-aligned. The collapse-to-header feature we just built leans into this: minimal chrome, content-first.

---

## 2. Touch & Gesture Design

### Critical Numbers
| Rule | Value | Source |
|------|-------|--------|
| Minimum touch target | **44×44 pt** (≈59px) | iOS HIG |
| Touch target spacing | **8–12 pt** between elements | Material Design |
| Error rate below 44pt | **3× higher** | CatDoes 2026 |

### Thumb Zone (One-Handed Use)
- **Natural reach:** bottom half of screen, center-biased
- **Hard reach:** top corners (especially top-left on right-handed use)
- **Bottom navigation bars → 65–70% increase in DAU and session time** (Appmysite)

### Gesture Rules
- Gestures must be **shortcuts, not requirements** — always provide visible fallbacks
- **Swipe-back** is expected on iOS (built into Capacitor stack nav)
- **Pull-to-refresh** is a native iOS expectation
- **Long-press** for context menus (secondary actions)
- **Respect "Reduce Motion"** system setting — disable spring/parallax animations when set

**TaskMatrix status:**
- ✅ Touch targets generally fine (Tailwind `py-1.5 px-3` on buttons ≈ 30×36px — slightly small, bump to `py-2 px-3.5`)
- ❌ No pull-to-refresh on task list
- ❌ No swipe gestures on task cards (swipe to complete/delete)
- ❌ No haptic feedback

### Priority Actions
1. **Bump touch targets** — quick-add buttons, quadrant routing buttons, context switcher pills — all should hit ≥44px
2. **Add haptic feedback** on task complete/delete via Capacitor Haptics plugin (`@capacitor/haptics`)
3. **Swipe-to-complete** on task cards (iOS-native expectation)

---

## 3. Navigation & Information Architecture

### Current State
```
Top Bar (sticky)
  ├── App title
  ├── Quick-add input + voice button
  ├── Quadrant routing dropdown (appears when typing)
  ├── Task/note counts
  ├── Theme toggle
  ├── Pomodoro toggle
  └── Collapse toggle
Context Switcher (All / Clinic / Launch / Dev / Personal)
Body
  ├── Today Strip (overdue + due today)
  ├── 2×2 Matrix (Do First / Schedule / Delegate / Don't Do)
  ├── Completed Section (expandable)
  └── Sticky Notes Sidebar
```

### Best Practice: Bottom Tab Bar
iOS users expect primary navigation at the bottom (thumb reach). For TaskMatrix, a bottom tab bar could hold:
- **Matrix** (home — current 2×2 view)
- **Notes** (sticky notes wall, currently sidebar)
- **Calendar/Upcoming** (today strip + due dates)
- **Settings/Profile**

**However:** TaskMatrix is fundamentally a single-view app — the matrix IS the app. A tab bar would add navigation depth that doesn't match the use case. The current top bar + context switcher is appropriate.

### What We Should Do
- **Keep single-view paradigm** — don't over-navigate
- **Move context switcher into the collapsed header** — when collapsed, show context as a compact dropdown, not a full bar
- **Sticky notes could be a slide-over sheet** (iOS sheet presentation) instead of a sidebar — more native-feeling on phone

---

## 4. Performance Targets

| Metric | Target | Why |
|--------|--------|-----|
| First contentful paint | < 1.5s | PWA expectation |
| Time to interactive | < 3s | 53% abandon after 3s |
| LCP (Largest Contentful Paint) | < 2.5s | Google ranking factor |
| Bundle size | < 200KB JS (gzipped) | Mobile network resilience |

### What's Working
- ✅ Vite code-splitting
- ✅ Tailwind purges unused CSS
- ✅ Supabase realtime (no polling overhead)

### Gaps
- ❌ No skeleton screens — matrix shows "Loading tasks..." text
- ❌ No service worker for offline caching
- ❌ No lazy loading for CompletedSection (it fetches on expand, which is good)
- ❌ No WebP/AVIF for any images

### Priority Actions
1. **Add skeleton screens** — a shimmer placeholder for the 2×2 grid while tasks load
2. **Service worker with stale-while-revalidate** — serve cached tasks instantly, update in background
3. **Optimize the initial load path** — tasks should render in < 1s from cache

---

## 5. Dark Mode

- **82% of users prefer dark mode** (CatDoes 2026)
- OLED screens: **14–58% power reduction**
- **92% of top-tier apps** support system-wide dark themes

### TaskMatrix Status: ✅ Done
- System-preference detection + manual toggle
- `slate-950` backgrounds, `slate-800` surfaces
- Proper contrast maintained

### Refinements
- Use **off-white text on dark gray** (`#E0E0E0` on `#121212`), not pure white on pure black — prevents halation for users with astigmatism
- Quadrant accent colors should **desaturate slightly** in dark mode for comfort

---

## 6. Accessibility (A11y)

**Legal reality:** EU Accessibility Act enforced since June 2025. Penalties: €75K–€100K per violation. EN 301 549 v4.1.0 (referencing WCAG 2.2) expected finalized Q3 2026.

### Non-Negotiables
| Requirement | Status | Action |
|-------------|--------|--------|
| 4.5:1 contrast ratio (normal text) | ⚠️ Check | Audit color palette |
| 3:1 contrast ratio (large text) | ✅ Likely OK | Verify quadrant headers |
| Dynamic type support | ❌ | Respect system font size — don't hardcode `text-sm` |
| Screen reader labels | ❌ | Add `aria-label` to all icon-only buttons |
| Gesture alternatives | ❌ | Any swipe action needs tap fallback |
| Motion sensitivity | ❌ | Check `prefers-reduced-motion` before animating |
| 44pt touch targets | ⚠️ Partial | Audit all interactive elements |

### Priority Actions
1. **`aria-label` all icon buttons** — theme toggle, pomodoro, collapse, voice
2. **Add `prefers-reduced-motion` media query** — disable transitions when set
3. **Dynamic type** — switch from fixed `text-sm`/`text-base` to relative units or `rem`-based scaling

---

## 7. Micro-Interactions & Perceived Performance

> "Users don't read apps — they scan them. Every screen should have one clear primary action." — CatDoes 2026

### What Makes an App Feel Native
| Technique | Why | TaskMatrix Status |
|-----------|-----|-------------------|
| **Tap feedback** | Ripple/highlight confirms action | ⚠️ Partial — hover states exist, no active/press states |
| **Haptic feedback** | Taptic Engine on complete/delete | ❌ Missing |
| **Skeleton screens** | Perceived speed during load | ❌ Shows text "Loading..." |
| **Optimistic updates** | UI updates before server confirms | ✅ Done (task add/status change) |
| **Spring animations** | Natural-feeling motion | ❌ No animations |
| **Layout stability** | No content jumps during load | ✅ Generally stable |
| **Swipe gestures** | Fast actions without precision taps | ❌ Missing |

### Priority Actions
1. **Add `active:` states** to all buttons (Tailwind `active:scale-95` + `active:opacity-80`)
2. **Haptics on task complete and delete** — `Haptics.impact({ style: .light })` via Capacitor
3. **Skeleton shimmer** for initial load — a 2×2 grid of pulsing placeholder cards
4. **Spring transition on collapse/expand** — `transition-all duration-300 ease-spring` or similar

---

## 8. Offline & Resilience

PWAs are expected to work offline. TaskMatrix currently goes blank without network.

### Target Behavior
| Scenario | Current | Desired |
|----------|---------|---------|
| Fresh load, online | Supabase fetch | Same — but served from SW cache instantly |
| Fresh load, offline | Blank/auth error | Show cached tasks + "Offline" indicator |
| Add task, offline | Fails silently | Queued → sync when online |
| Status change, offline | Fails silently | Optimistic update + sync queue |

### Priority Actions
1. **Service Worker** — cache app shell + last-known task state
2. **Offline indicator** — subtle banner "You're offline. Changes will sync when connected."
3. **Sync queue** — store pending mutations in IndexedDB, flush on reconnect

---

## 9. Collapse Pattern — Specific UX Notes

Our newly-built collapse-to-header feature is a power-user move. Here's how to make it feel native:

### Do
- **Remember state** across sessions ✅ (already using localStorage)
- **Animate the transition** — spring or ease-out, 250–350ms
- **Show task count in collapsed header** — e.g., "12 tasks · 5 notes" so the header isn't dead space
- **Quick-add still works when collapsed** — maybe even emphasize it: the whole point of collapsing is to focus

### Don't
- Don't auto-collapse on mobile — let the user choose
- Don't hide the collapse button — make it discoverable but not prominent
- Don't collapse if the user is mid-edit on a task

### Ideas for Collapsed Mode
- **Minimal widget mode** — header shows task count, next due task, pomodoro status
- **Focus mode** — collapsed by default when Pomodoro timer is running
- **Dashboard mode** — collapsed shows only critical/overdue counts

---

## 10. Capacitor-Specific Considerations

### Platform Detection
```typescript
import { Capacitor } from '@capacitor/core';
const isIOS = Capacitor.getPlatform() === 'ios';
```

### iOS-Only Behaviors to Add
- **Safe area insets** — respect notch/Dynamic Island: `env(safe-area-inset-top)` in CSS
- **Swipe-back gesture** — Capacitor handles this if using proper navigation
- **Keyboard avoidance** — `@capacitor/keyboard` — ensure quick-add input isn't hidden by keyboard
- **Status bar style** — set to match theme (light content for dark mode)
- **Haptics** — `@capacitor/haptics` for tactile feedback on actions

### Things That Break on iOS WebView
- **`100vh` is unreliable** — Safari/iOS WebView has its own viewport behavior. Use `dvh` (dynamic viewport height) or `-webkit-fill-available`
- **Overscroll bounce** — iOS WebView has rubber-banding by default. Usually fine, but can interfere with custom scroll containers
- **`position: fixed` with keyboard open** — iOS WebView has historic bugs here; test with keyboard open

---

## 11. Prioritized Roadmap

### Quick Wins (This Week)
1. **Bump touch targets** to ≥44px on all interactive elements
2. **`active:` press states** on all buttons (Tailwind `active:scale-95`)
3. **`aria-label` on icon buttons** (theme, pomodoro, collapse, voice)
4. **Task count in collapsed header**
5. **Animate collapse/expand** transition

### Short-Term (Next 2 Weeks)
6. **Haptic feedback** on task complete/delete (Capacitor Haptics)
7. **Skeleton shimmer** for initial task load
8. **`prefers-reduced-motion`** support
9. **Safe area insets** for notch/island
10. **Dynamic type** — switch fixed font sizes to relative

### Medium-Term (Next Month)
11. **Swipe-to-complete** on task cards
12. **Service Worker** with stale-while-revalidate caching
13. **Offline indicator** + sync queue
14. **Sticky notes as iOS sheet** (slide-over instead of sidebar on mobile)
15. **Collapse auto-mode** — collapse when Pomodoro starts

### Longer-Term
16. Pull-to-refresh on task list
17. Context switcher dropdown in collapsed mode
18. Widget/home screen quick actions
19. Siri Shortcuts integration ("Add task to TaskMatrix")

---

## 12. Key References

- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines) — iOS 26 / Liquid Glass
- [Material Design 3 Expressive](https://m3.material.io/) — Google's 2025 update
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — Accessibility standard
- [Capacitor Documentation](https://capacitorjs.com/docs) — Cross-platform native runtime
- [CatDoes: 7 App Design Best Practices for 2026](https://catdoes.com/blog/app-design-best-practices)
- [Capgo: Cross-Platform UI/UX for Capacitor](https://capgo.app/blog/cross-platform-uiux-best-practices-for-capacitor-apps/)
- [Lollypop: PWA UX Tips 2025](https://lollypop.design/blog/2025/september/progressive-web-app-ux-tips-2025/)
- [Tapptitude: iOS App Design Guidelines 2025](https://tapptitude.com/blog/i-os-app-design-guidelines-for-2025)

---

*This is a living document. Update as we implement features and learn what works on real devices.*
