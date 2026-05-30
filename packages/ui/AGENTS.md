# UI Package — Agent Instructions

## Purpose

Shared shadcn/ui component library consumed by all frontend apps.

```
src/
├── components/    # shadcn/ui components (Button, etc.)
├── hooks/         # Shared React hooks
├── lib/           # Utilities (cn, etc.)
├── styles/        # Global CSS (Tailwind, theme, fonts)
```

## Export Map

Defined in `package.json` under `exports`:

| Import Path | Resolves To |
|-------------|-------------|
| `@workspace/ui/globals.css` | `src/styles/globals.css` |
| `@workspace/ui/lib/*` | `src/lib/*.ts` |
| `@workspace/ui/components/*` | `src/components/*.tsx` |
| `@workspace/ui/hooks/*` | `src/hooks/*.ts` |

## Agent Rules

1. **All components are source code** — edit them directly in this package
2. **Add components via CLI**: `npm exec shadcn@latest add <name> -c apps/web`
3. **Use `cn()`** for conditional class merging
4. **Semantic colors only** — `bg-primary`, `text-muted-foreground`, never raw values
5. **No `space-x/y`** — use `flex gap-*`
6. **Follow shadcn/ui rules**: see `.agents/skills/shadcn/rules/` for full styling/forms conventions
7. **TSDoc** on all exported components