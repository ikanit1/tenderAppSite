# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev              # Main marketing site (port 5173)
npm run dev:apisite      # FastAPI catalog backend (port 8001)
npm run dev:apisite:react # Catalog React frontend with hot reload (port 3000)
npm run dev:bot          # Telegram bot + web admin (port 8000)
npm run dev:all          # All services concurrently

# Build
npm run build            # TypeScript check + Vite build (main site)
npm run build:apisite    # Build catalog React frontend
npm run build:all        # Build all services

# Code quality
npm run lint             # ESLint
npm run format           # Prettier

# Performance
npm run lighthouse:audit # Run Lighthouse audit
npm run lighthouse:local # Run Lighthouse on localhost
npm run lighthouse:report # Open latest report
```

For the Python tenderbot backend:
```bash
cd tenderbot
pip install -r requirements.txt
python run.py            # Start Telegram bot + web admin on port 8000
# FastAPI catalog is started via npm run dev:apisite
```

## Architecture

This is a **multi-service monorepo** with three distinct applications deployed on the same production server:

1. **Main marketing site** (`src/`) — React 18 + TypeScript + Vite SPA at https://grgroup.kz
2. **Product catalog** (`tenderbot/apisite/`) — FastAPI backend serving a nested React SPA at https://grgroup.kz/catalog
3. **Telegram bot** (`tenderbot/`) — Python async bot with web admin at http://localhost:8000

### Service Ports

| Service | Dev Port | Production | Notes |
|---------|----------|------------|-------|
| Main site | 5173 | nginx → `/var/www/tenderAppSite/` | Static files from `dist/` |
| Catalog API | 8001 | nginx proxy → Docker | FastAPI serves API + React build |
| Catalog React dev | 3000 | not used | Hot reload only, proxies to 8001 |
| Bot web admin | 8000 | localhost only | Not exposed externally |

### Frontend Architecture (Feature-Sliced Design)

The `src/` directory follows a layered FSD structure:
- `src/pages/` — Route-level components (one per route)
- `src/widgets/` — Large self-contained feature blocks (Layout, Hero, Services, etc.)
- `src/features/` — Reusable feature modules (lead-form, toast)
- `src/entities/` — Data model interfaces (lead)
- `src/shared/` — UI kit, content files, contexts, utilities

**Routing:** React Router v6 in `src/app/App.tsx`. The `/catalog` route embeds the FastAPI backend in an iframe and syncs cart state via `postMessage`.

**State management:**
- **Zustand** (`src/store/calculatorStore.ts`) — calculator steps/parameters/results
- **Context API** — `CartContext` (cart + cookie sync with FastAPI), `OpenAssistantContext` (assistant widget state)
- Local component state for everything else

**Styling:** CSS Modules only — no Tailwind. Design tokens in `src/styles/variables.css`.

**Path alias:** `@/` maps to `src/` everywhere (configured in `vite.config.ts` and `tsconfig.json`).

### Content Management

All user-facing copy and configuration is centralized in `src/shared/content/`:
- `home.ts`, `services.ts`, `contacts.ts`, `faq.ts`, `projects.ts`, `work.ts` — page content
- `akuvoxSmartSystems.ts`, `digitalEcosystem.ts` — product/solution page content
- `calculatorConfig.ts` — calculator pricing logic and formulas
- `assistant.ts` — AI assistant prompts and fallback responses

**To update website text:** Edit these files directly — no component changes needed.

### Mock-to-Real API Migration

Lead forms and the AI assistant currently use mock implementations:
- `src/mock/leadApi.mock.ts` → replace with `src/api/leadApi.ts`
- `src/mock/assistantApi.mock.ts` → replace with `src/api/assistantApi.ts`

Swap the import in the consuming widget to switch from mock to real API.

### Catalog Integration

The catalog page (`src/pages/CatalogPage.tsx`) embeds the FastAPI React app in an iframe with `?embedded=1` parameter. Communication happens via:
- **Cart updates:** FastAPI posts `CATALOG_CART_UPDATE` message → main site refreshes cart
- **Navigation:** React Router handles `/catalog/*` routes and updates iframe src
- **Cookie sync:** Both apps share the `catalog_cart` cookie for cart state persistence

The catalog backend (`tenderbot/apisite/`) is a separate FastAPI + React app with its own build process.

### Production Deployment Workflow

The production server uses **Docker Compose** for backend services and **nginx** for the main site:

1. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

2. **Build main site:**
   ```bash
   npm run build  # Creates dist/ folder
   ```

3. **Deploy main site to nginx:**
   ```bash
   sudo cp -r dist/* /var/www/tenderAppSite/
   ```

4. **Rebuild and restart Docker containers:**
   ```bash
   cd tenderbot
   docker compose build apisite  # Rebuild catalog service
   docker compose up -d apisite  # Restart with new image
   docker compose build app      # Rebuild Telegram bot
   docker compose up -d app      # Restart with new image
   ```

5. **Reload nginx:**
   ```bash
   sudo systemctl reload nginx
   ```

6. **Verify all services:**
   ```bash
   docker compose ps             # Check container status
   curl https://grgroup.kz/      # Check main site
   curl https://grgroup.kz/catalog/  # Check catalog
   curl http://localhost:8001/   # Check API directly
   ```

**Docker services** (defined in `tenderbot/docker-compose.yml`):
- `apisite` — FastAPI catalog (port 8001) with volumes for data, images, portal_export
- `app` — Telegram bot + web admin (port 8000) with SQLite database
- `db` — PostgreSQL (port 5432) for historical data (currently unused by app)

**Important notes:**
- After editing `index.html` meta tags, rebuild and redeploy to `/var/www/tenderAppSite/`
- Docker builds can be cached — use `docker compose build --no-cache` if needed
- Check logs: `docker logs --tail 50 tenderbot-apisite-1` or `docker logs --tail 50 tenderbot-app-1`

### PM2 Alternative

For non-Docker deployments, use PM2 with `ecosystem.config.cjs`:
```bash
pm2 start ecosystem.config.cjs
pm2 logs
pm2 restart all
```
