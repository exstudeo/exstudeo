/**
 * @file page.tsx
 *
 * EPUB explorer route page — renders at `/epub`.
 *
 * Provides:
 * - A tree view of the EPUB collection
 * - "Add Epub" button at root level (toolbar) and per collection node
 * - "Delete Epub" action per EPUB leaf node
 * - "From Directory" button to regenerate from ZenFS storage
 * - Graceful handling of the "not configured" state
 *
 * @module epub-explorer-page
 */

import { useCallback, useRef } from "react"
import { useZenFSSnapshot } from "@/hooks/use-zenfs"
import { promises } from "@/lib/zenfs"
import { useConfig } from "@/hooks/use-config"
import { Button } from "@workspace/ui/components/button"
import { FolderPlusIcon, UploadIcon } from "lucide-react"
import { extractEpub } from "@/lib/epub-lib/epubzip"
import { type IEpub } from "@/lib/epub-lib/type"
import { sanitizeFilename } from "@/lib/epub-lib/utils"
import EpubContextProvider, { useEpubContext } from "./epub-context"
import { EpubTree } from "./epub-tree"
import { AddFromDirectory } from "./add-from-dir"

/**
 * Inner content — rendered inside the {@link EpubContextProvider}.
 */
function EpubExplorerContent() {
  const { viewModel } = useEpubContext()

  // Shared hidden file input — triggered by both the toolbar button and
  // per-collection menu items. The pending collection path is stored in
  // a ref and read when files are selected.
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingPathRef = useRef<string[]>([])

  const handleFilesSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return

      const path = pendingPathRef.current
      pendingPathRef.current = []

      // Phase 1: extract all files (async — no ViewModel access)
      const extracted: Array<{
        fileBuffer: ArrayBuffer
        metadata: IEpub
        entries: Map<string, ArrayBuffer>
      }> = []
      const failedNames: string[] = []
      for (const file of Array.from(files)) {
        try {
          const fileBuffer = await file.arrayBuffer()
          const result = await extractEpub(file)
          extracted.push({
            fileBuffer,
            metadata: result.metadata,
            entries: result.entries,
          })
        } catch (err) {
          failedNames.push(file.name)
          console.warn(`[EpubExplorer] Failed to extract "${file.name}":`, err)
        }
      }

      // Phase 2: persist all extracted data (async with promises API)
      if (extracted.length > 0) {
        const result = await viewModel.AddEpubsExtracted(extracted, path)
        if (result.failed > 0) {
          console.warn(
            `[EpubExplorer] ${result.failed} file(s) failed during persist:`,
            result.failedNames,
          )
        }
        // Combine extraction failures + persist failures for the alert
        const totalFailed = failedNames.length + result.failed
        const allFailedNames = [...failedNames, ...result.failedNames]
        if (totalFailed > 0) {
          alert(
            `${result.succeeded} EPUB(s) added, ${totalFailed} skipped.\n\nSkipped:\n${allFailedNames.join("\n")}`,
          )
        }
      } else if (failedNames.length > 0) {
        alert(
          `0 EPUB(s) added, ${failedNames.length} failed.\n\nFailed:\n${failedNames.join("\n")}`,
        )
      }

      // Reset the input so the same file can be re-selected
      e.target.value = ""
    },
    [viewModel],
  )

  const triggerFilePicker = useCallback(
    (collectionPath: string[]) => {
      pendingPathRef.current = collectionPath
      fileInputRef.current?.click()
    },
    [],
  )

  const onAddEpub = useCallback(
    (collectionPath: string[]) => {
      triggerFilePicker(collectionPath)
    },
    [triggerFilePicker],
  )

  const onDeleteEpub = useCallback(
    async (epubId: string, collectionPath: string[]) => {
      try {
        await viewModel.DelEpubsAt([epubId], collectionPath)
      } catch (err) {
        console.error("[EpubExplorer] Failed to delete EPUB:", err)
      }
    },
    [viewModel],
  )

  const onDeleteCollection = useCallback(
    async (collectionPath: string[]) => {
      if (window.confirm(`Delete collection "${collectionPath.join("/")}" and all its contents?`)) {
        try {
          await viewModel.DelCollection(collectionPath)
        } catch (err) {
          console.error("[EpubExplorer] Failed to delete collection:", err)
        }
      }
    },
    [viewModel],
  )

  const onAddCollection = useCallback(
    async (parentPath: string[]) => {
      const name = window.prompt("Enter collection name:")
      if (!name) return // cancelled or empty
      try {
        await viewModel.CreateCollection(name, parentPath)
      } catch (err) {
        console.error("[EpubExplorer] Failed to create collection:", err)
        alert(String(err))
      }
    },
    [viewModel],
  )

  const onBookOpen = useCallback(
    (epubId: string, collectionPath: string[]) => {
      const safeId = sanitizeFilename(epubId)
      const prefix = collectionPath.length > 0 ? `${collectionPath.join("/")}/` : ""
      const url = `/@epubs/${prefix}${safeId}.epubdir/sidebar.html`
      window.open(url, "_blank", "noopener,noreferrer")
    },
    [],
  )

  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">EPUB Collection</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onAddCollection([])}>
            <FolderPlusIcon data-icon="inline-start" />
            Create Collection
          </Button>
          <Button variant="outline" size="sm" onClick={() => triggerFilePicker([])}>
            <UploadIcon data-icon="inline-start" />
            Add Epub
          </Button>
          <AddFromDirectory />
        </div>
      </div>

      {/* Hidden file input shared by root button and collection menus */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".epub"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />

      {/* Tree view */}
      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        <EpubTree onAddEpub={onAddEpub} onDeleteEpub={onDeleteEpub} onDeleteCollection={onDeleteCollection} onAddCollection={onAddCollection} onBookOpen={onBookOpen} />
      </div>
    </div>
  )
}

/**
 * EPUB explorer page — entry point for the `/epub` route.
 *
 * If ZenFS is not configured, shows a placeholder message.
 * Otherwise wraps the content in {@link EpubContextProvider}.
 */
export function EpubExplorerPage() {
  const snap = useZenFSSnapshot()
  const { config } = useConfig()

  if (!snap.hasEntries) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground text-sm">
          No file system configured. Add a directory mount to get started.
        </p>
      </div>
    )
  }

  return (
    <EpubContextProvider appConfig={config} promises={promises}>
      <EpubExplorerContent />
    </EpubContextProvider>
  )
}