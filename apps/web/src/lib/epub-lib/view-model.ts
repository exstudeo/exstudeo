/**
 * @file view-model.ts
 *
 * ViewModel class that manages the EPUB collection — the bridge between
 * ZenFS storage and the React UI.
 *
 * ## Storage conventions
 *
 * EPUBs are stored under `AppConfig.epub.zenFSPath` (default `"/epubs"`).
 * Each EPUB occupies a single self-contained directory:
 *
 *   <unique-identifier-sanitized>.epubdir/
 *     book.epub         — the raw EPUB file
 *     book.json         — serialized IEpub metadata
 *     <unzipped content> — EPUB internal directory structure
 *
 * Collections nest freely: any subdirectory that does not end with
 * `.epubdir` is treated as a sub-collection. The `.epubdir` suffix
 * deterministically distinguishes EPUB content directories from
 * user-created collection directories.
 *
 * @module epub-view-model
 */

import { type IEpub, type EpubCollection, isEpub } from "./type"
import { type AppConfig } from "@/config"
import { notifyServiceWorker } from "@/lib/zenfs"
import { parseBookStructure } from "./book-parser"
import type { BookStructure } from "./book-parser"
import { sanitizeFilename } from "./utils"

/** Name of the cache file persisted alongside the EPUB tree. */
const VIEW_MODEL_FILE = "viewModel.json"

/**
 * ViewModel for the EPUB collection.
 *
 * Manages the in-memory collection tree, persists it to `viewModel.json`
 * in ZenFS, and notifies subscribers on mutation.
 *
 * The static `getCollectionFromStorage()` and `getCollectionFromviewModelFile()`
 * methods allow initialising from either a live directory scan or a
 * previously-saved cache file.
 *
 * @example
 * ```ts
 * const vm = new ViewModel(appConfig, zenfs.fs)
 * vm.subscribe(() => console.log("collection changed"))
 * ```
 */
class ViewModel {
  // ── Subscriber system ─────────────────────────────────────────────────
  //
  // No cleanup is required from the ViewModel side — subscribe() returns
  // an unsubscribe function that the caller (typically React via
  // useSyncExternalStore) invokes to remove the callback.
  private readonly updateSubscribers: Set<() => void> = new Set()

  // ── Internal state ────────────────────────────────────────────────────
  private collection: EpubCollection = {}
  private appConfig: AppConfig
  private promisesFs: typeof import("@/lib/zenfs")["promises"]

  /**
   * Serialized write queue for viewModel.json.
   *
   * Each mutation chains its viewModel.json write onto this promise
   * to prevent interleaved writes (which caused JSON corruption when
   * two rapid mutations both wrote to the same file concurrently).
   * The queue stays alive even if an individual write fails — errors
   * are logged but don't block subsequent writes.
   */
  private _writeQueue: Promise<void> = Promise.resolve()

  // ── Construction ──────────────────────────────────────────────────────

  /**
   * Create a ViewModel with the given configuration.
   *
   * The constructor is synchronous — it does NOT read from ZenFS.
   * Call {@link init} to load the collection from storage.
   *
   * @param appConfig  Application configuration (uses `epub.zenFSPath`).
   * @param promisesFs Promise-based ZenFS filesystem API.
   * @param collection Optional initial collection. If omitted, the
   *                   collection starts empty until {@link init} is called.
   */
  constructor(
    appConfig: AppConfig,
    promisesFs: typeof import("@/lib/zenfs")["promises"],
    collection?: EpubCollection,
  ) {
    this.appConfig = appConfig
    this.promisesFs = promisesFs

    if (collection) {
      this.collection = collection
    }
  }

  /**
   * Initialize the collection by reading from ZenFS storage.
   *
   * Tries to read `viewModel.json` first. If that doesn't exist, scans
   * the directory structure and persists the result.
   *
   * Safe to call multiple times — updates in-place and notifies
   * subscribers on change.
   */
  async init(): Promise<void> {
    const zenFSPath = this.appConfig.epub.zenFSPath
    let loaded = false

    try {
      this.collection = await ViewModel.getCollectionFromviewModelFile(
        zenFSPath,
        this.promisesFs,
      )
      loaded = true
    } catch {
      // viewModel.json doesn't exist yet — scan the directory
    }

    if (!loaded) {
      this.collection = await ViewModel.getCollectionFromStorage(
        zenFSPath,
        this.promisesFs,
      )
      // Persist the freshly-scanned collection
      try {
        await this._writeViewModelFile(this.collection)
      } catch (err) {
        console.warn("[ViewModel] Failed to persist initial viewModel.json:", err)
      }
    }

    this.notifyUpdate()
  }

  // ── Static helpers — storage I/O ──────────────────────────────────────

  /**
   * Build an {@link EpubCollection} by scanning the ZenFS directory
   * structure under `zenFSPath` using the promises API.
   *
   * Directories ending with `.epubdir` are EPUB content directories —
   * the scanner enters them, reads `book.json` for metadata, and does
   * NOT recurse further. All other directories are treated as
   * sub-collections and recursed into.
   *
   * @returns A fresh `EpubCollection` tree.
   */
  static async getCollectionFromStorage(
    zenFSPath: string,
    promisesFs: typeof import("@/lib/zenfs")["promises"],
  ): Promise<EpubCollection> {
    return ViewModel._scanDir(zenFSPath, promisesFs, zenFSPath)
  }

  /**
   * Recursively scan a directory in ZenFS and build part of the
   * {@link EpubCollection} tree.
   *
   * Directories ending with `.epubdir` are EPUB artifacts — enter them
   * to read `book.json`, use `metadata.uniqueIdentifier` as the
   * collection key, and do NOT recurse into them further.
   * Other directories are sub-collections — recurse.
   */
  private static async _scanDir(
    dirPath: string,
    promisesFs: typeof import("@/lib/zenfs")["promises"],
    rootPath: string,
  ): Promise<EpubCollection> {
    const collection: EpubCollection = {}
    let names: string[]

    try {
      names = (await promisesFs.readdir(dirPath)) as string[]
    } catch {
      return collection
    }

    for (const name of names) {
      if (name === "." || name === "..") continue
      const fullPath = `${dirPath}/${name}`
      let stat
      try {
        stat = await promisesFs.stat(fullPath)
      } catch {
        continue
      }

      const isDir = (stat.mode & 0o170000) === 0o040000 // S_IFDIR

      if (isDir) {
        if (name.endsWith(".epubdir")) {
          // EPUB content directory — enter it to read book.json
          try {
            const content = (await promisesFs.readFile(
              `${fullPath}/book.json`,
              "utf-8",
            )) as string
            const epub = JSON.parse(content) as IEpub
            // Use the unique identifier as the key
            collection[epub.uniqueIdentifier] = epub
          } catch (e) {
            console.warn(`Failed to read book.json from EPUB directory: ${fullPath}`, e)
          }
          // Do NOT recurse into .epubdir
        } else {
          // Otherwise it's a user-defined sub-collection — recurse
          collection[name] = await ViewModel._scanDir(fullPath, promisesFs, rootPath)
        }
      }
      // Ignore all files (book.epub, book.json are read when entering .epubdir)
    }

    return collection
  }

  /**
   * Read the `viewModel.json` file from ZenFS and parse it as an
   * {@link EpubCollection}.
   *
   * Throws if the file does not exist or is invalid JSON.
   */
  static async getCollectionFromviewModelFile(
    zenFSPath: string,
    promisesFs: typeof import("@/lib/zenfs")["promises"],
  ): Promise<EpubCollection> {
    const viewModelStr = (await promisesFs.readFile(
      `${zenFSPath}/${VIEW_MODEL_FILE}`,
      "utf-8",
    )) as string
    return JSON.parse(viewModelStr) as EpubCollection
  }

  /**
   * Serialise `collection` as JSON and write it to `viewModel.json`
   * under `zenFSPath`.
   */
  static updateViewModelFile(
    zenFSPath: string,
    fs: typeof import("@/lib/zenfs")["fs"],
    collection: EpubCollection,
  ): void {
    const json = JSON.stringify(collection, null, 2)
    fs.writeFileSync(`${zenFSPath}/${VIEW_MODEL_FILE}`, json, "utf-8")
  }

  // ── Instance helpers ──────────────────────────────────────────────────

  /**
   * Resolve a nested path within the collection.
   *
   * @param pathSegments  Array of collection-key segments.
   *                      Empty array = root collection.
   * @returns The sub-collection at that path, or `undefined` if not found.
   */
  private _resolvePath(
    pathSegments: string[],
  ): EpubCollection | undefined {
    let node: EpubCollection = this.collection
    for (const segment of pathSegments) {
      const child = node[segment]
      if (!child || isEpub(child)) return undefined
      node = child as EpubCollection
    }
    return node
  }

  // ── Mutation methods ──────────────────────────────────────────────────

  /**
   * Persist already-extracted EPUB data into ZenFS and update the
   * in-memory collection.
   *
   * Extraction (JSZip + OPF parsing) MUST be done by the caller.
   *
   * Uses the promises API so FSA errors propagate correctly (the
   * sync wrapper silently swallows FSA rejections). Filenames are
   * sanitized to remove characters forbidden by FSA (`:`, `\`, etc.).
   *
   * For each item, creates `<safeId>.epubdir/` and writes all artifacts
   * inside it: `book.epub`, `book.json`, `spine.json`, `toc.json`,
   * `sidebar.html`, and unzipped content. The spine, toc, and sidebar
   * are generated by {@link parseBookStructure} which extracts them from
   * the EPUB's OPF/NCX/NAV documents.
   *
   * If the write succeeds, the in-memory collection is updated.
   * On any failure (including book structure parsing), the `.epubdir/`
   * is cleaned up via `rmdir` and the item is reported as failed.
   *
   * After all items are processed, persists `viewModel.json` via the
   * serialized write queue and notifies subscribers.
   *
   * @param extracted      Array of extracted EPUB data (result of
   *                       `extractEpub()` plus the raw `file.arrayBuffer()`).
   * @param collectionPath Array of directory-key segments relative to the
   *                       root, e.g. `["sci-fi", "classics"]`. Empty array
   *                       adds to the root.
   */
  async AddEpubsExtracted(
    extracted: Array<{
      fileBuffer: ArrayBuffer
      metadata: IEpub
      entries: Map<string, ArrayBuffer>
    }>,
    collectionPath: string[],
  ): Promise<{ succeeded: number; failed: number; failedNames: string[] }> {
    let succeeded = 0
    let failed = 0
    const failedNames: string[] = []
    let collectionModified = false

    const targetDir = this._collectionTargetDir(collectionPath)
    const targetCollection =
      this._resolvePath(collectionPath) ?? this.collection

    for (const item of extracted) {
      const { fileBuffer, metadata, entries } = item
      const rawId = metadata.uniqueIdentifier
      const safeId = sanitizeFilename(rawId)
      const epubDirPath = `${targetDir}/${safeId}.epubdir`

      try {
        // Parse book structure (spine, TOC, sidebar) from EPUB content.
        // Done before writing files so a parse failure prevents partial
        // artifacts and is reported as a failed extraction.
        let bookStructure: BookStructure
        try {
          bookStructure = parseBookStructure(entries, metadata)
        } catch (parseErr: unknown) {
          throw new Error(
            `Book structure parsing failed: ${
              parseErr instanceof Error ? parseErr.message : String(parseErr)
            }`,
          )
        }

        // Write all artifacts inside the single .epubdir directory
        await this._persistEpubDir(epubDirPath, fileBuffer, metadata, entries, bookStructure)

        // ALL writes succeeded — update in-memory with the original
        // (unsanitized) uniqueIdentifier as the collection key.
        targetCollection[rawId] = metadata
        collectionModified = true
        succeeded++
      } catch (err: any) {
        // Clean up the .epubdir directory (best-effort, single rmdir)
        try { await ViewModel._rmdir(epubDirPath, this.promisesFs) } catch { /* best-effort */ }

        failed++
        failedNames.push(rawId)
        console.warn(`[ViewModel] Failed to persist EPUB "${rawId}":`, err?.message ?? err)
      }
    }

    if (collectionModified) {
      try {
        await this._writeViewModelFile(this.collection)
      } catch (err) {
        console.warn("[ViewModel] Failed to write viewModel.json after add:", err)
      }
      this.notifyUpdate()
    }

    return { succeeded, failed, failedNames }
  }

  /**
   * Compute the ZenFS directory path from a collection path array.
   */
  private _collectionTargetDir(collectionPath: string[]): string {
    const base = this.appConfig.epub.zenFSPath
    if (collectionPath.length === 0) return base
    return `${base}/${collectionPath.join("/")}`
  }

  /**
   * Serialize the current collection to viewModel.json via the promises API.
   *
   * Uses `unlink` + `writeFile` instead of plain `writeFile` because
   * ZenFS's WebAccess/FSA backend doesn't reliably truncate existing
   * files — old content can remain after writing shorter content,
   * producing malformed JSON.
   *
   * Writes are serialized through `_writeQueue` to prevent interleaved
   * writes when rapid mutations occur. The queue stays alive even if an
   * individual write fails — errors are surfaced to the caller via the
   * returned promise but don't block subsequent enqueued writes.
   */
  private _writeViewModelFile(collection: EpubCollection): Promise<void> {
    const json = JSON.stringify(collection, null, 2)
    const path = `${this.appConfig.epub.zenFSPath}/${VIEW_MODEL_FILE}`
    const writeOp = this._writeQueue
      .then(async () => {
        // Delete first to guarantee clean truncation (ZenFS/FSA doesn't
        // reliably truncate on writeFile with flag 'w').
        // Best-effort — file may not exist yet.
        try {
          await this.promisesFs.unlink(path)
        } catch {
          // File doesn't exist yet — that's fine
        }
        await this.promisesFs.writeFile(path, json, "utf-8")

        // Notify the service worker that files have changed under a
        // mounted backend. The SW has its own ZenFS instance with a
        // separate inode table — without this notification it would
        // serve stale file data on the next request.
        notifyServiceWorker()
      })
    // Keep queue alive — errors are surfaced to the caller via writeOp
    this._writeQueue = writeOp.catch(() => { /* consumed — queue continues */ })
    return writeOp
  }

  /**
   * Persist all EPUB artifacts into the `.epubdir/` directory.
   *
   * Writes `book.epub` (the raw file), `book.json` (serialized metadata),
   * `spine.json` (reading order), `toc.json` (table of contents tree),
   * `sidebar.html` (pre-rendered TOC HTML fragment), and all unzipped
   * content entries inside `epubDirPath` using the promises API
   * (proper FSA error propagation).
   *
   * @param epubDirPath   Full path to the `.epubdir/` directory.
   * @param fileBuffer    The raw EPUB file as an ArrayBuffer.
   * @param metadata      Parsed IEpub metadata to serialize as `book.json`.
   * @param entries       Map of relative paths to file data from EPUB extraction.
   * @param bookStructure Pre-parsed book structure (spine, TOC, sidebar HTML).
   *
   * @throws If any file fails to write. The caller's catch block
   *         handles cleanup of partial artifacts.
   */
  private async _persistEpubDir(
    epubDirPath: string,
    fileBuffer: ArrayBuffer,
    metadata: IEpub,
    entries: Map<string, ArrayBuffer>,
    bookStructure: BookStructure,
  ): Promise<void> {
    await this.promisesFs.mkdir(epubDirPath, { recursive: true })

    // Write the raw EPUB file as book.epub inside the epubdir
    await this.promisesFs.writeFile(
      `${epubDirPath}/book.epub`,
      new Uint8Array(fileBuffer),
    )

    // Write serialized metadata as book.json inside the epubdir
    await this.promisesFs.writeFile(
      `${epubDirPath}/book.json`,
      JSON.stringify(metadata, null, 2),
      "utf-8",
    )

    // Write pre-parsed book structure files
    await this.promisesFs.writeFile(
      `${epubDirPath}/spine.json`,
      JSON.stringify(bookStructure.spine, null, 2),
      "utf-8",
    )
    await this.promisesFs.writeFile(
      `${epubDirPath}/toc.json`,
      JSON.stringify(bookStructure.toc, null, 2),
      "utf-8",
    )
    await this.promisesFs.writeFile(
      `${epubDirPath}/sidebar.html`,
      bookStructure.sidebarHtml,
      "utf-8",
    )

    // Write all unzipped content entries
    for (const [relPath, data] of entries) {
      // Skip directory-only ZIP entries (paths ending with "/")
      if (relPath.endsWith("/")) continue

      const segments = relPath.split("/")
      const fileName = segments.pop()!
      // Guard against empty filenames from edge cases
      if (!fileName) continue
      let currentDir = epubDirPath

      // Create subdirectory structure if needed.
      // Uses promises API so FSA errors propagate correctly as
      // rejected promises (no silent failures).
      for (const seg of segments) {
        currentDir = `${currentDir}/${seg}`
        await this.promisesFs.mkdir(currentDir, { recursive: true })
      }

      try {
        await this.promisesFs.writeFile(`${currentDir}/${fileName}`, new Uint8Array(data))
      } catch (err) {
        throw new Error(
          `Failed to persist "${relPath}" in ${epubDirPath}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }
  }

  /**
   * Delete EPUBs from a specific collection path.
   *
   * @param epubIds        Unique identifiers of the EPUBs to remove.
   * @param collectionPath Array of directory-key segments leading to the
   *                       parent collection of the EPUBs to delete.
   *
   * Removes the entry from the in-memory collection first, then deletes
   * the single `.epubdir/` directory from ZenFS using `rmdir` (all
   * artifacts are inside it). Filenames are sanitized to match the names
   * used during `AddEpubsExtracted`.
   *
   * After cleanup, persists `viewModel.json` via the serialized write
   * queue and notifies subscribers.
   */
  async DelEpubsAt(epubIds: string[], collectionPath: string[]): Promise<void> {
    const targetDir = this._collectionTargetDir(collectionPath)
    const targetCollection =
      this._resolvePath(collectionPath) ?? this.collection

    for (const epubId of epubIds) {
      const safeId = sanitizeFilename(epubId)

      // 1. Remove from in-memory collection
      delete targetCollection[epubId]

      // 2. Remove the single .epubdir directory (all artifacts are inside)
      try { await ViewModel._rmdir(`${targetDir}/${safeId}.epubdir`, this.promisesFs) } catch { /* best-effort */ }
    }

    try {
      await this._writeViewModelFile(this.collection)
    } catch (err) {
      console.warn("[ViewModel] Failed to write viewModel.json after delete:", err)
    }
    this.notifyUpdate()
  }

  /**
   * Delete an entire collection directory and all its contents from ZenFS,
   * then remove it from the in-memory collection tree.
   *
   * @param collectionPath Array of directory-key segments leading to the
   *                       collection to delete (the LAST segment is the
   *                       collection name). E.g. `["sci-fi", "classics"]`
   *                       deletes `/epubs/sci-fi/classics/` and removes
   *                       `classics` from its parent.
   *
   * Logging:
   * - Warnings are logged if files cannot be deleted, but delete continues.
   * - If the FS directory was already manually removed, the in-memory
   *   reference is still cleaned up.
   */
  async DelCollection(collectionPath: string[]): Promise<void> {
    if (collectionPath.length === 0) return // Cannot delete root

    const targetDir = this._collectionTargetDir(collectionPath)
    const parentPath = collectionPath.slice(0, -1)
    const collectionName = collectionPath[collectionPath.length - 1]
    const parentCollection =
      this._resolvePath(parentPath) ?? this.collection

    // 1. Recursively remove the directory from FS (best-effort)
    try {
      await ViewModel._rmdir(targetDir, this.promisesFs)
    } catch (err) {
      console.warn(
        `[ViewModel] Failed to fully delete collection "${targetDir}":`,
        err,
      )
    }

    // 2. Remove from in-memory (even if FS removal partially failed)
    delete parentCollection[collectionName]

    try {
      await this._writeViewModelFile(this.collection)
    } catch (err) {
      console.warn("[ViewModel] Failed to write viewModel.json after collection delete:", err)
    }
    this.notifyUpdate()
  }

  /**
   * Create a new empty collection (sub-directory) at the given path.
   *
   * @param name         The collection name (directory name in ZenFS).
   * @param parentPath   Array of path segments leading to the parent
   *                     collection. Empty array = root level.
   *
   * Validates that:
   * - Name is non-empty
   * - Name does NOT end with `.epubdir` (reserved for EPUB content)
   * - No sibling with the same name already exists
   *
   * Consistency guarantee: the ZenFS directory is created FIRST. If that
   * fails, the in-memory collection is NOT mutated. If the mkdir succeeds
   * but the subsequent viewModel.json write fails, the in-memory
   * collection IS updated (UI reflects the change) and a warning is
   * logged — consistent with all other mutation methods.
   *
   * The FS directory name is sanitized via `sanitizeFilename()` to
   * prevent issues with FSA-forbidden characters (`:`, `?`, etc.).
   * The in-memory collection key uses the original unsanitized name,
   * matching the convention used elsewhere.
   *
   * @throws If validation fails (synchronous throw).
   * @throws If `promisesFs.mkdir` fails (rejected promise).
   */
  async CreateCollection(
    name: string,
    parentPath: string[],
  ): Promise<void> {
    // ── Validation ────────────────────────────────────────────────────
    if (!name || name.trim().length === 0) {
      throw new Error("Collection name must not be empty.")
    }

    const trimmedName = name.trim()

    if (trimmedName.endsWith(".epubdir")) {
      throw new Error(
        `Collection name "${trimmedName}" must not end with ".epubdir" (reserved suffix).`,
      )
    }

    const parentCollection =
      this._resolvePath(parentPath) ?? this.collection

    if (trimmedName in parentCollection) {
      throw new Error(
        `A collection or EPUB named "${trimmedName}" already exists at this location.`,
      )
    }

    // ── FS: create directory ──────────────────────────────────────────
    const targetDir = `${this._collectionTargetDir(parentPath)}/${sanitizeFilename(trimmedName)}`

    // mkdir first — if this fails, nothing is mutated
    await this.promisesFs.mkdir(targetDir, { recursive: true })

    // ── In-memory: insert empty sub-collection ────────────────────────
    // Only reached if mkdir succeeded.
    parentCollection[trimmedName] = {}

    // ── Persist viewModel.json (best-effort) ──────────────────────────
    try {
      await this._writeViewModelFile(this.collection)
    } catch (err) {
      console.warn(
        "[ViewModel] Failed to write viewModel.json after creating collection:",
        err,
      )
    }

    this.notifyUpdate()
  }

  /**
   * Recursively remove a directory and all its contents from ZenFS
   * using the promises API.
   */
  private static async _rmdir(
    dirPath: string,
    promisesFs: typeof import("@/lib/zenfs")["promises"],
  ): Promise<void> {
    let names: string[]
    try {
      names = await promisesFs.readdir(dirPath) as string[]
    } catch {
      return // Directory doesn't exist
    }

    for (const name of names) {
      if (name === "." || name === "..") continue
      const fullPath = `${dirPath}/${name}`
      let stat
      try {
        stat = await promisesFs.stat(fullPath)
      } catch {
        continue
      }

      const isDir = (stat.mode & 0o170000) === 0o040000
      if (isDir) {
        await ViewModel._rmdir(fullPath, promisesFs)
      } else {
        try { await promisesFs.unlink(fullPath) } catch { /* best-effort */ }
      }
    }

    try { await promisesFs.rmdir(dirPath) } catch { /* best-effort */ }
  }

  /**
   * Regenerate the entire collection by scanning the ZenFS directory,
   * write the result to `viewModel.json`, replace the in-memory
   * collection, and notify subscribers.
   *
   * This is the source-of-truth rebuild — useful after files have been
   * added/removed directly (outside the app).
   */
  async regenerateFromDirectory(): Promise<void> {
    this.collection = await ViewModel.getCollectionFromStorage(
      this.appConfig.epub.zenFSPath,
      this.promisesFs,
    )
    try {
      await this._writeViewModelFile(this.collection)
    } catch (err) {
      console.warn("[ViewModel] Failed to write viewModel.json after regeneration:", err)
    }
    this.notifyUpdate()
  }

  // ── Reactivity ────────────────────────────────────────────────────────

  /**
   * Subscribe to collection changes.
   *
   * @param callback  Invoked after every mutation (AddEpubsAt, DelEpubsAt,
   *                  regenerateFromDirectory).
   * @returns An unsubscribe function. No cleanup is required from the
   *          ViewModel side — the caller (useSyncExternalStore) calls this
   *          to remove the subscription.
   */
  subscribe(callback: () => void): () => void {
    this.updateSubscribers.add(callback)
    return () => {
      this.updateSubscribers.delete(callback)
    }
  }

  /**
   * Notify all subscribers of a collection change.
   *
   * Called automatically by mutation methods. Consumers should not call
   * this directly unless they are extending the ViewModel.
   */
  notifyUpdate(): void {
    // Invalidate snapshot cache so the next getCollectionSnapshot()
    // call returns a fresh clone reflecting the new collection state.
    this._snapshotCache = null
    this.updateSubscribers.forEach((callback) => callback())
  }

  /**
   * Return a deep-cloned snapshot of the current collection.
   *
   * Designed for use with `useSyncExternalStore`:
   *
   * ```ts
   * const collection = useSyncExternalStore(
   *   viewModel.subscribe,
   *   viewModel.getCollectionSnapshot,
   * )
   * ```
   *
   * The snapshot reference is stable — it only changes when the underlying
   * collection is mutated (via `AddEpubsAt`, `DelEpubsAt`, or
   * `regenerateFromDirectory`), so `useSyncExternalStore` won't enter an
   * infinite re-render loop.
   *
   * The returned object MUST NOT be mutated directly. Use `AddEpubsAt`,
   * `DelEpubsAt`, or `regenerateFromDirectory()` instead.
   */
  private _snapshotCache: EpubCollection | null = null

  getCollectionSnapshot(): EpubCollection {
    if (this._snapshotCache === null) {
      this._snapshotCache = structuredClone(this.collection)
    }
    return this._snapshotCache
  }
}

export { ViewModel }
