## Project Identity

**Exstudeo** — a web-based reader/viewer for notes and books in multiple formats (Markdown, EPUB, and more). Built as a monorepo with a PWA frontend, extensible to future backends.

## Agent Instructions

### Always Do

1. **Log your work.** After any significant change, append an entry to [`Development.log.md`](./Development.log.md) describing what was done, any design decisions, and encountered problems & solutions and inconsistency of documentation.
2. **Consult the docs.** Before making changes:
   - Read [`dev.readme.md`](./dev.readme.md) for architecture, conventions, and specs.
   - Read the nearest `AGENTS.md` or `readme.md` in the directory tree (VS Code reads nested `AGENTS.md` files when `useNestedAgentsMdFiles` is enabled).
3. **Write TypeScript properly.** All code (including service workers) must be typed with strict mode. Use TSDoc for public APIs. Comment non-obvious logic.
4. **Prefer modular composition.** Abstract multi-step string/state transformations into utility functions. Favor declarative patterns over imperative procedures.
5. **Recommend libraries.** When planning, consider if a well-known library cleanly solve the problem and recommend it to the user.
6. **Documentation Note.** You might need to search/fetch online for documentation, note relevant documentation fragment and link in [`used_doc`](./used_doc/)
7. **Work at correct location.** Change to correct directory before run npm scripts. For example, run `cd apps/web` before `npm run preview`.
8. **Logging and Error Handling (proper cleanup/finally)** Especially for effects and data storage.
9. **Prevent async data race** Add proper guard for effects to avoid reentrant.

## Codemap

```
/
├── apps/web/              # Vite + React PWA (current frontend)
│   ├── src/
│   │   ├── sw.ts          # Service worker (injectManifest)
│   │   ├── components/    # App-specific React components
│   │   │   └── *.test.tsx # Co-located tests
│   │   ├── lib/           # Utilities
│   │   │   └── *.test.ts  # Co-located tests
│   │   ├── test/          # Test setup & polyfills
│   │   ├── App.tsx        # Root component
│   │   └── main.tsx       # Entry point
│   ├── vitest.config.ts   # Test runner config (separate from Vite)
│   └── vite.config.ts     # Vite config with React + Tailwind CSS + VitePWA
│
├── packages/ui/           # Shared UI component library (shadcn/ui)
│   └── src/
│       ├── components/    # shadcn/ui components (Button, etc.)
│       ├── hooks/         # Shared React hooks
│       ├── lib/           # Utilities (cn, etc.)
│       └── styles/        # Global CSS (Tailwind, shadcn, fonts)
│
├── openspec/              # OpenSpec change management
│   ├── config.yaml        # Project context for spec generation
│   ├── specs/             # Main specification files
│   └── changes/           # Active/archived change proposals
│
├── used_doc/              # Reference documentation fragments & links
│
├── .agents/skills/        # Installed agent skills
├── .github/skills/        # OpenSpec workflow skills
│
├── dev.readme.md          # Developer reference (architecture, specs)
├── README.md              # Public-facing project readme
├── Development.log.md     # Achievement & problem log
├── package.json           # Root monorepo package (npm workspaces)
├── turbo.json             # Turborepo task orchestration
└── tsconfig.json          # Base TypeScript config
```

## Documentation Conventions

| File | Audience | Purpose |
|------|----------|---------|
| `AGENTS.md` | AI agents | Agent instructions + codemap |
| `readme.md` | Developers | Code explanation, specs, architecture, conventions |
| `dev.readme.md` | Developers | Root-level dev reference (replaces `readme.md` at root) |

Files are nested per directory — each directory's docs describe the code within that subtree.



