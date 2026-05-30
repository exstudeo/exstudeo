# Exstudeo

A web-based reader/viewer for notes and books in multiple formats.

> **Status**: Early development — scaffolded from `shadcn@latest init --preset b0`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript (strict) |
| Build | Vite 7 + Turborepo |
| UI | shadcn/ui (base-nova style) + Tailwind CSS 4 |
| Icons | Lucide React |
| Fonts | Inter (variable) |
| Monorepo | npm workspaces + Turborepo |

## Quick Start

```bash
npm install
npm run dev        # Start dev server (apps/web)
npm run build      # Build all packages
npm run lint       # Lint all packages
npm run typecheck  # Type-check all packages
```

## Project Structure

```
exstudeo/
├── apps/web/          # PWA frontend (Vite + React)
├── packages/ui/       # Shared UI components (shadcn/ui)
├── openspec/          # OpenSpec change management
├── used_doc/          # Reference documentation
```

## Adding Components

```bash
npm exec shadcn@latest add <component> -c apps/web
```

Components are installed into `packages/ui/src/components/` and imported as:

```tsx
import { Button } from "@workspace/ui/components/button";
```

## Documentation

- `dev.readme.md` — Developer reference with full architecture and conventions
- `AGENTS.md` — Instructions for AI agents working in this codebase
