## Context

Exstudeo currently has no configuration system. Reader preferences, directory paths, and locale are either hardcoded or nonexistent. The `mount-store.ts` module provides a template for IndexedDB-backed persistent storage, but there is no shared config layer that both the React app and the Service Worker can read from.

The config system must be:
- **Typed** — each domain has its own interface; the composite type is `AppConfig`
- **Persistent** — stored in IndexedDB so it survives page reloads and is accessible to the SW
- **Merge-on-read** — new keys added in future versions automatically get default values
- **Reactive** — React components observe config changes via `useSyncExternalStore`
- **Simple** — no validation library, no schema registry, no migration framework

## Goals / Non-Goals

**Goals:**
- Define typed config interfaces for `epub`, `ghgist`, and `general` domains
- Provide an IndexedDB-backed store (`config-store.ts`) that reads/writes per-domain documents
- Always merge stored values with defaults on read so new keys are automatically populated
- Provide a React hook (`use-config.ts`) following the `useSyncExternalStore` pattern
- Add a `/settings` SPA route with a raw JSON editor (textarea) + Save / Discard / Reset buttons
- Wire the new tab into the app shell and route definitions

**Non-Goals:**
- Form-based settings UI (individual fields/sliders/toggles) — the JSON editor is the v1 interface
- Config → SW propagation via `postMessage` — deferred to a future change
- Per-user or multi-profile config
- Schema versioning or migration framework — merge-on-read eliminates the need
- `state-store.ts` for ephemeral state (scroll position, last-read page) — separate concern

## Decisions

### Decision 1: Per-domain IDB documents (not a single document)

**Choice:** Store each config domain as a separate document in IndexedDB, keyed by domain name.

- **Rationale:** The Service Worker may only need `general` config (e.g., caching flags). A single document forces reading all domains. Per-domain reads are cheaper and concurrent writes don't clobber unrelated domains.
- **Alternatives considered:**
  - *Single document* — simpler read (one `getAll()`), but risk of write conflicts and unnecessary data transfer.
  - *Flat key-value* — each property as its own IDB record. Too granular, no type grouping.

### Decision 2: Merge-on-read, no schema versioning

**Choice:** On every `getConfig()` call, merge the stored value over the defaults: `{ ...DEFAULT_CONFIG[domain], ...storedValue }`. No `schemaVersion` field, no migration logic.

- **Rationale:** When new properties are added to a config interface, existing stored values simply lack them. Merge-on-read fills them in automatically. Old properties that are removed from the interface are silently dropped. This is zero-maintenance forward compatibility.
- **Alternatives considered:**
  - *Schema version per document* — robust but adds complexity with no current benefit (the app has no backward-compatibility constraints yet).
  - *Write full config on save* — caller must spread defaults explicitly; more error-prone.

### Decision 3: Discard reverts to persisted state (not auto-save)

**Choice:** The Save button is explicit. Discard reloads the textarea from IDB, discarding all edits. No auto-save, no debounced writes.

- **Rationale:** Users should be able to experiment with JSON without fear of corrupting state. Explicit save matches the "edit JSON file" mental model.
- **Alternatives considered:**
  - *Auto-save on blur* — could cause partial/invalid JSON to be saved if user steps away.
  - *Debounced auto-save* — adds complexity and risks saving transient invalid state.

### Decision 4: `zenFSPath` defaults to `/epubs`

**Choice:** The `EpubConfig.zenFSPath` default is `/epubs`.

- **Rationale:** Short, clear, improbable to collide with user-defined mount paths. Users can change it in settings.

### Decision 5: Reactive hook mirrors `use-zenfs` pattern

**Choice:** `use-config.ts` uses `useSyncExternalStore` with `subscribe`/`getSnapshot` callbacks, exactly like `use-zenfs.ts`.

- **Rationale:** Consistency within the codebase. Components that need config get reactive updates without polling or prop drilling.

## Risks / Trade-offs

- **[Risk] Invalid JSON on Save** → The Save button attempts `JSON.parse()`. If it fails, the error message (line/col from native parser) is shown inline and the save is aborted. No data is lost — the previous persisted version remains intact.
- **[Risk] Structural mismatch** → User saves valid JSON that doesn't match `AppConfig` shape (e.g., missing `epub` key). Mitigation: merge-on-read fills missing top-level keys from defaults, but unknown keys are silently dropped. This is acceptable for v1 — the UI shows the full config on reload, so surprises are visible.
- **[Risk] User edits config simultaneously with app code relying on it** → React hook re-renders on save, so components consuming config will see the new values immediately. No stale-state risk.
- **[Risk] IDB write failure** (quota exceeded, private browsing) → `setConfig()` rejects with an error. The settings page shows a toast or error state. The app continues with in-memory config until reload (defaults will be used next time).