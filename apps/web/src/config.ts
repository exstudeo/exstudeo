/**
 * Typed configuration interfaces for Exstudeo.
 *
 * Each domain (epub, ghgist, general) has its own interface and a default
 * value. The composite {@link AppConfig} type aggregates all domains.
 *
 * Persisted values are merged over defaults on read — see {@link config-store}.
 *
 * @module config
 */

// ── Per-domain config types ───────────────────────────────────────────────

/** General application configuration. */
export interface GeneralConfig {
  /** User locale / language code. */
  locale: string
  /** Whether to restore the last active tab on reload. */
  rememberLastTab: boolean
  /** The last active tab path (only set if rememberLastTab is true). */
  lastActiveTab?: string
}


export interface ExplorerConfig {
  /** ZenFS mount path prefixes whose files should render as hyperlinks to the SW-served URL. */
  fsUrlBidirectional: string[]
}


/** Configuration for the EPUB reader. */
export interface EpubConfig {
  /**
   * ZenFS directory path where EPUB files are managed.
   * This is a convention, not a binding — the user/programming logic ensures
   * a mount exists at this path.
   * @default "/epubs"
   */
  zenFSPath: string
}

/** Configuration for the GitHub Gist integration (reserved for future use). */
export interface GhGistConfig {
  // Reserved for future GitHub Gist integration
  [key: string]: never
}


// ── Composite config ──────────────────────────────────────────────────────

/**
 * Root application config, composed of all per-domain configs.
 */
export interface AppConfig {
  explorer: ExplorerConfig
  general: GeneralConfig
  epub: EpubConfig
  ghgist: GhGistConfig
}

/** All config domain keys. */
export type ConfigDomain = keyof AppConfig

// ── Defaults ──────────────────────────────────────────────────────────────

/**
 * Default configuration used when no persisted value exists for a domain.
 *
 * When reading config, stored values are merged over these defaults so that
 * newly-added properties are automatically populated without a migration.
 */
export const DEFAULT_CONFIG: AppConfig = {
  explorer: {
    fsUrlBidirectional: ["/epubs"],
  },
  epub: {
    zenFSPath: "/epubs",
  },
  ghgist: {},
  general: {
    locale: "en",
    rememberLastTab: true,
  },
}