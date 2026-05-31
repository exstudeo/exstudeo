/**
 * File explorer route page — shows the ZenFS virtual filesystem root.
 *
 * Renders the mounts management dialog, a breadcrumb for current path,
 * and a directory table with entries from the currently navigated path.
 *
 * @module file-explorer-page
 */

import { useEffect, useState, useCallback } from "react"
import { useZenFSSnapshot } from "@/hooks/use-zenfs"
import { promises } from "@/lib/zenfs"
import { useConfig } from "@/hooks/use-config"
import { MountsDialog } from "@/components/layout/mounts-dialog"
import { PathBreadcrumb } from "./path-breadcrumb"
import { DirectoryTable, type FileEntry } from "./directory-table"

export function FileExplorerPage() {
  const snap = useZenFSSnapshot()
  const { config } = useConfig()
  const [currentPath, setCurrentPath] = useState("/")
  const [entries, setEntries] = useState<FileEntry[] | null>(null)
  const [loading, setLoading] = useState(true)

  // Load directory entries asynchronously
  useEffect(() => {
    if (!snap.hasEntries) {
      setEntries([])
      setLoading(false)
      return
    }

    setLoading(true)

    async function loadEntries() {
      const result: FileEntry[] = []

      let names: string[]
      try {
        names = (await promises.readdir(currentPath)) as string[]
        if (import.meta.env.DEV){
          console.log(`[FileExplorer] Loaded entries for "${currentPath}":`, names)
          console.log(`[FileExplorer] Current mounts:`, snap.entries)
        }
      } catch {
        setLoading(false)
        return
      }

      // Add parent directory entry if not at root
      if (currentPath !== "/") {
        result.push({
          name: "..",
          path: currentPath.substring(0, currentPath.lastIndexOf("/")) || "/",
          isDirectory: true,
          size: null,
          mtimeMs: null,
        })
      }

      for (const name of names) {
        if (name === "." || name === "..") continue
        const fullPath = currentPath === "/" ? `/${name}` : `${currentPath}/${name}`

        try {
          const stat = await promises.stat(fullPath)
          const entry: FileEntry = {
            name,
            path: fullPath,
            isDirectory: (stat.mode & 0o170000) === 0o040000, // S_IFDIR
            size: stat.size ?? null,
            mtimeMs: stat.mtimeMs ?? null,
          }

          // Compute href for files under configured fsUrlBidirectional prefixes
          if (!entry.isDirectory) {
            for (const prefix of config.explorer.fsUrlBidirectional) {
              if (fullPath === prefix || fullPath.startsWith(prefix + "/")) {
                const rest = fullPath.slice(prefix.length) // e.g., "/subdir/file.html"
                const routerpath = prefix.slice(1) // e.g., "epubs"
                entry.href = `/@${routerpath}${rest}`
                break
              }
            }
          }

          result.push(entry)
        } catch {
          // Skip entries that can't be stat'd
          console.log(`[FileExplorer] Failed to stat "${fullPath}", skipping`)
        }
      }

      setEntries(result)
      setLoading(false)
    }

    loadEntries()
  }, [snap.hasEntries, currentPath, config, snap.entries])

  const handleNavigate = useCallback((path: string) => {
    setCurrentPath(path)
  }, [])

  const handleOpenFile = useCallback((entry: FileEntry) => {
    console.log("[FileExplorer] Open file (stub):", entry.path)
  }, [])


    if (!snap.hasEntries) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground text-sm">
          No file system configured. Add a directory mount to get started.
        </p>
        <MountsDialog entries={snap.entries} deniedEntries={snap.deniedEntries} />
      </div>
    )
  }

  if (loading && entries === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground text-sm">Loading directory…</p>
      </div>
    )
  }

  if (!loading && entries === null) {
    console.error(`[FileExplorer] Failed to read entries for "${currentPath}"`)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p className="text-destructive text-sm">Failed to read directory entries.</p>
        <p className="text-muted-foreground text-sm">Try navigating to a different directory or check your mounts.</p>
      </div>
    )
  }



  // By this point all null/loading states have early-returned above
  const dirEntries = entries!

  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <PathBreadcrumb path={currentPath} onNavigate={handleNavigate} />
        <MountsDialog entries={snap.entries} deniedEntries={snap.deniedEntries} />
      </div>

      {/* Directory listing */}
      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        {dirEntries.length === 0 ? (
          <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
            This directory is empty.
          </div>
        ) : (
          <DirectoryTable
            entries={dirEntries}
            onNavigate={handleNavigate}
            onOpenFile={handleOpenFile}
          />
        )}
      </div>
    </div>
  )
}