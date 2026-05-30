# UI Package — Developer Reference

## Overview

This package (`@workspace/ui`) contains the shared shadcn/ui component library. Components are installed via the shadcn CLI and stored as source code in `src/components/`.

## Styling Stack

- **Tailwind CSS 4** via `@tailwindcss/vite`
- **shadcn/ui** base-nova style (Tailwind CSS 4 variant)
- **tw-animate-css** — animation utilities
- **Inter variable font** via `@fontsource-variable/inter`
- **clsx + tailwind-merge** via `cn()` utility

Global CSS is at `src/styles/globals.css` and includes Tailwind imports, shadcn theme variables, and font loading.

## Theming System

- CSS variables for all design tokens (background, foreground, primary, etc.)
- Dark mode via `.dark` class selector
- Components use semantic tokens only
- RTL support enabled

## Adding New Components

```bash
npm exec shadcn@latest add <component> -c apps/web
```

This places the component in `packages/ui/src/components/`.

## Available Components

| Component | Source |
|-----------|--------|
| `Button` | `packages/ui/src/components/button.tsx` |

Add more via the shadcn CLI as needed.

## Utilities

| Export | Location | Purpose |
|--------|----------|---------|
| `cn()` | `src/lib/utils.ts` | Merge Tailwind classes conditionally |

## Key Dependencies

- `@base-ui/react` — headless UI primitives
- `class-variance-authority` — component variant API
- `zod` — schema validation (for future data models)
- `lucide-react` — icons