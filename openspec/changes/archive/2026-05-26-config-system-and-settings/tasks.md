## 1. Config types and defaults

- [x] 1.1 Create `src/lib/config.ts` with `EpubConfig`, `GhGistConfig`, `GeneralConfig` interfaces, `AppConfig` composite type, and `DEFAULT_CONFIG` object (default `epub.zenFSPath` = `"/epubs"`)

## 2. IndexedDB config store

- [x] 2.1 Create `src/lib/config-store.ts` — CRUD operations for per-domain config documents in IndexedDB (`exstudeo-configs`), closely following the `mount-store.ts` pattern
- [x] 2.2 Implement `getConfig<K>(key)` with merge-on-read: `{ ...DEFAULT_CONFIG[key], ...stored }`
- [x] 2.3 Implement `getAllConfigs()` that reads all domains and merges with defaults
- [x] 2.4 Implement `setConfig<K>(key, partial)` — upsert one domain document
- [x] 2.5 Implement `resetConfig(key?)` — delete one or all domain documents
- [x] 2.6 Add reactive subscribe/getSnapshot infrastructure (matching `zenfs.ts` pattern) so the config store can be consumed by `useSyncExternalStore`

## 3. React hook

- [x] 3.1 Create `src/hooks/use-config.ts` — `useConfig()` hook returning `{ config: AppConfig, setDomain, resetDomain }` using `useSyncExternalStore`

## 4. Settings tab page

- [x] 4.1 Create `src/components/settings/page.tsx` — JSON editor textarea with Save, Discard, and Reset buttons
- [x] 4.2 Implement Save flow: parse JSON, split by domain, call `setConfig()` for each domain; show error inline if JSON is invalid
- [x] 4.3 Implement Discard flow: reload textarea content from `getAllConfigs()` (reverts all in-memory edits)
- [x] 4.4 Implement Reset flow: call `resetConfig()`, reload textarea with defaults

## 5. Route and shell integration

- [x] 5.1 Add `"/settings"` to `SPA_ROUTES` in `src/route.path.ts`
- [x] 5.2 Add `<Route path="settings" element={<SettingsPage />} />` to `App.tsx`
- [x] 5.3 Add `{ value: "/settings", label: "Settings" }` to the `TABS` array in `app-shell.tsx`
- [x] 5.4 Add `<TabsContent value="/settings">` with `<Outlet />` in `app-shell.tsx`