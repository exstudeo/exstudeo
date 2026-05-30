# Config System

## Purpose

Typed configuration types, defaults, IndexedDB-backed store with merge-on-read, and a React hook for reactive access across the app and service worker.

## ADDED Requirements

### Requirement: Config type definitions
The system SHALL provide typed configuration interfaces for each domain (`EpubConfig`, `GhGistConfig`, `GeneralConfig`) and a composite `AppConfig` type with default values.

#### Scenario: EpubConfig has zenFSPath
- **WHEN** the system reads `EpubConfig`
- **THEN** it SHALL contain `zenFSPath` (string) with a default value of `/epubs`

#### Scenario: GhGistConfig is empty
- **WHEN** the system reads `GhGistConfig`
- **THEN** it SHALL be an empty interface reserved for future use

#### Scenario: GeneralConfig has locale and tab settings
- **WHEN** the system reads `GeneralConfig`
- **THEN** it SHALL contain `locale` (string, default `"en"`), `rememberLastTab` (boolean, default `true`), and optionally `lastActiveTab` (string)

#### Scenario: DEFAULT_CONFIG provides fallback values
- **WHEN** no persisted config exists for a domain
- **THEN** the system uses `DEFAULT_CONFIG` values for that domain

### Requirement: IndexedDB-backed config store
The system SHALL persist config in IndexedDB under database name `"exstudeo-configs"` with a store name `"config"` keyed by domain name.

#### Scenario: Read single domain with merge-on-read
- **WHEN** `getConfig("epub")` is called
- **THEN** the stored `epub` document is loaded and merged with `DEFAULT_CONFIG.epub` — any missing keys in the stored document are filled from defaults

#### Scenario: Read all domains returns full AppConfig
- **WHEN** `getAllConfigs()` is called
- **THEN** all stored domain documents are merged with defaults and returned as a complete `AppConfig` object

#### Scenario: Write partial update to a domain
- **WHEN** `setConfig("epub", { zenFSPath: "/custom" })` is called
- **THEN** only the `epub` domain is updated in IDB; other domains are unchanged

#### Scenario: Reset a single domain
- **WHEN** `resetConfig("epub")` is called
- **THEN** the `epub` document is deleted from IDB; subsequent reads return the default

#### Scenario: Reset all domains
- **WHEN** `resetConfig()` is called with no arguments
- **THEN** all config documents are deleted from IDB

### Requirement: Reactive config hook for React
The system SHALL provide a `useConfig()` React hook using `useSyncExternalStore` that returns the current `AppConfig` and re-renders components when config changes.

#### Scenario: Hook returns merged config
- **WHEN** a component calls `useConfig()`
- **THEN** it receives `{ config: AppConfig, setDomain, resetDomain }` with config merged from defaults and persisted values

#### Scenario: Component re-renders on config change
- **WHEN** `setDomain("epub", { ... })` is called
- **THEN** all components subscribed via `useConfig()` re-render with the new config

### Requirement: Settings tab with JSON editor
The system SHALL provide a `/settings` SPA route with a tab in the app shell, displaying the full `AppConfig` as a JSON textarea with Save, Discard, and Reset buttons.

#### Scenario: Settings tab exists in tab bar
- **WHEN** the app loads
- **THEN** a "Settings" tab is displayed in the tab bar alongside "Files" and "Reader"

#### Scenario: JSON is pre-formatted on load
- **WHEN** the user navigates to the Settings tab
- **THEN** the textarea contains the current config formatted as pretty-printed JSON (2-space indent)

#### Scenario: Save persists valid JSON
- **WHEN** the user edits the JSON and clicks Save
- **THEN** the JSON is parsed and persisted to IDB via `setConfig()` for each domain, and the config snapshot updates

#### Scenario: Invalid JSON shows error on Save
- **WHEN** the user enters invalid JSON and clicks Save
- **THEN** the save is aborted and the error message (with line/column from `JSON.parse`) is displayed; no data is persisted

#### Scenario: Discard reverts to last persisted state
- **WHEN** the user clicks Discard
- **THEN** the textarea reloads its content from IDB, discarding all unsaved edits

#### Scenario: Reset clears all config
- **WHEN** the user clicks Reset
- **THEN** all config documents are deleted from IDB and the textarea reloads with the full default config

### Requirement: Config is accessible from Service Worker
The system SHALL allow the Service Worker to import and read config from the same `config-store.ts` module.

#### Scenario: SW reads general config
- **WHEN** the Service Worker imports `config-store.ts` and calls `getConfig("general")`
- **THEN** it receives the merged `GeneralConfig` with persisted values overlaid on defaults