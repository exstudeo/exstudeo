## Why

Exstudeo needs a centralized settings system. Currently, reader behaviour (EPUB path, display preferences, locale) is hardcoded or scattered. As new capabilities come online (EPUB reader, GitHub Gist integration), per-domain configuration with persistence across sessions is essential. A settings UI also gives users visibility and control without requiring code changes.

## What Changes

- **Config type system**: A new `config.ts` with typed per-domain config interfaces (`EpubConfig`, `GhGistConfig`, `GeneralConfig`) and a composite `AppConfig` type with defaults.
- **Persistent config store**: A new `config-store.ts` that reads/writes config to IndexedDB (`exstudeo-configs`) with merge-on-read semantics — missing keys are filled from defaults.
- **React hook**: A new `use-config.ts` hook following the existing `use-zenfs.ts` pattern (`useSyncExternalStore`) for reactive config consumption.
- **Settings tab**: A new `/settings` SPA route with a tab in the app shell. The settings page is a raw JSON editor (textarea) with Save, Discard, and Reset buttons. Discard reverts to the last-persisted version (no auto-save).
- **Route registration**: Add `/settings` to `SPA_ROUTES` and wire it through `App.tsx` and `app-shell.tsx`.

## Capabilities

### New Capabilities
- `config-system`: Typed configuration types, defaults, IndexedDB-backed store with merge-on-read, and a React hook for reactive access across the app and service worker.

### Modified Capabilities
*(none — this is a wholly new capability)*

## Impact

- **New files**: `src/lib/config.ts`, `src/lib/config-store.ts`, `src/hooks/use-config.ts`, `src/components/settings/page.tsx`
- **Modified files**: `src/route.path.ts`, `src/App.tsx`, `src/components/layout/app-shell.tsx`
- **No new dependencies** — uses the browser's native `indexedDB` API (same as `mount-store.ts`)
- **No breaking changes** — all readers still use their current hardcoded state until updated to consume config