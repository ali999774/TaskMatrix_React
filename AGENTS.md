# AGENTS.md — TaskMatrix

Stack: React + TypeScript + Vite, Supabase (PostgREST + Realtime), Capacitor PWA wrapper.

## Standards modules

Apply with judgment — not rigid gates. Point at the repo, never copy content into this project.

**Backend:**
- https://github.com/ali999774/ali-agent-standards/blob/main/backend-standards/AGENTS.md
- data-classification.md (PHI fork — mandatory before data ingress)
- supabase-sync.md (PostgREST mechanism, dirty-flag pattern, debounce)
- auth-patterns.md (app session + secrets)

**UI/UX:**
- https://github.com/ali999774/ali-agent-standards/blob/main/ui-ux/AGENTS.md
- https://github.com/ali999774/ali-agent-standards/blob/main/ui-ux/stack-modules/stack-react-tailwind.md
- https://github.com/ali999774/ali-agent-standards/blob/main/ui-ux/stack-modules/stack-capacitor-ios.md
- https://github.com/ali999774/ali-agent-standards/blob/main/ui-ux/stack-modules/stack-pwa-offline.md

Project-specific UI status & roadmap: ./docs/UI-UX-AUDIT.md
Deliberate exceptions to the universal principles are documented there.

## Key architecture

- Supabase project: `xulnxwwwjpvgsaqnsllo`
- Auth: Google OAuth via Supabase, user-scoped RLS
- Sync: dirty-flag + 400ms debounce on updateNote/updateTask. updateStatus is immediate (infrequent discrete actions).
- Realtime: WebSocket for live updates across devices
- Tables: tasks, sticky_notes (user_id scoped, soft-delete via deleted_at)

## Gotchas

- WKWebView on iOS: silent JS failures — debug via Safari DevTools remote console
- Capacitor: `hostname: 'localhost'` in capacitor.config.ts
- Backend-standards directory not yet pushed to ali-agent-standards repo (only ui-ux/ exists)
