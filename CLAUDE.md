# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev              # Main marketing site (port 5173)
npm run dev:apisite      # FastAPI catalog backend (port 8001)
npm run dev:all          # All services concurrently

# Build
npm run build            # TypeScript check + Vite build (main site)
npm run build:all        # Build all services

# Code quality
npm run lint             # ESLint
npm run format           # Prettier
```

For the Python tenderbot backend:
```bash
cd tenderbot
pip install -r requirements.txt
python run.py            # Start Telegram bot
# FastAPI is started via npm run dev:apisite
```

## Architecture

This is a **multi-service monorepo** with three distinct applications:

1. **Main marketing site** (`src/`) — React 18 + TypeScript + Vite SPA for elektromontazh.kz
2. **Product catalog** (`tenderbot/apisite/`) — FastAPI backend serving a nested React SPA on port 8001
3. **Telegram bot** (`tenderbot/`) — Python async bot with web admin on port 8000

### Frontend Architecture (Feature-Sliced Design)

The `src/` directory follows a layered FSD structure:
- `src/pages/` — Route-level components (one per route)
- `src/widgets/` — Large self-contained feature blocks composed into pages
- `src/features/` — Reusable feature modules (lead-form, toast)
- `src/entities/` — Data model interfaces
- `src/shared/` — UI kit, content, API clients, contexts, utilities

**Routing:** React Router v6 with a layout-based nested route structure in `src/app/`. The `/catalog` route redirects to the FastAPI backend, with cookie-based fallback detection.

**State management:**
- **Zustand** (`src/store/calculatorStore.ts`) — calculator steps/parameters/results
- **Context API** — `CartContext` (cart + cookie sync + FastAPI), `OpenAssistantContext` (assistant widget)
- Local component state for everything else

**Styling:** CSS Modules only — no Tailwind. Design tokens in `src/styles/`.

**Path alias:** `@/` maps to `src/` everywhere.

### Content Management

All user-facing copy and configuration is centralized in `src/shared/content/`:
- `home.ts`, `services.ts`, `prices.ts`, `contacts.ts`, `faq.ts` — page content
- `calculatorConfig.ts` — calculator pricing logic
- `assistant.ts` — AI assistant prompts

Edit these files to update content without touching components.

### Mock-to-Real API Migration

Lead forms and the AI assistant currently use mock implementations:
- `src/mock/leadApi.mock.ts` → replace with `src/api/leadApi.ts`
- `src/mock/assistantApi.mock.ts` → replace with `src/api/assistantApi.ts`

Swap the import in the consuming widget to switch from mock to real API.

### Deployment

This is a SPA — all routes must rewrite to `index.html`. Configs already exist:
- `vercel.json` for Vercel
- `_redirects` for Netlify
- Configure nginx/reverse proxy for other hosts

PM2 configuration in `ecosystem.config.cjs` manages production processes.
