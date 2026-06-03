/**
 * Dialog for managing directory mounts — add, mount/unmount toggle, and remove.
 *
 * Supports multiple backend types (File System Access, IndexedDB) via a
 * backend type dropdown in the add form.
 *
 * @module mounts-dialog
 */

import { useState, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { MoreHorizontal, Plus, FolderOpen, Power, PowerOff, Trash2, RefreshCw, AlertTriangle } from "lucide-react"
import {
  normaliseMountPath,
  isValidMountPath,
  requestHandlePermission,
  requestStoragePersistence,
  type MountEntry,
  type BackendConfig,
} from "@/lib/mount-store"
import { storeNameFromPath } from "@/lib/backend-resolver"
import {
  addMountEntry,
  toggleMountEntry,
  removeMountEntry,
  reconnectMountEntry,
} from "@/lib/zenfs"
import type { ZenFSSnapshot } from "@/hooks/use-zenfs"

type BackendKindSelect = BackendConfig["kind"]

interface MountsDialogProps {
  entries: ZenFSSnapshot["entries"]
  deniedEntries: ZenFSSnapshot["deniedEntries"]
}

export function MountsDialog({ entries, deniedEntries }: MountsDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <FolderOpen className="mr-1 size-4" />
        Mounts
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Directory Mounts</DialogTitle>
        </DialogHeader>

        <AddMountForm onAdded={() => setOpen(false)} />

        <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
          {entries.length === 0 && (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No mounts yet. Add a directory or IndexedDB store to get started.
            </p>
          )}

          {entries.map((entry) => (
            <MountRow
              key={entry.id}
              entry={entry}
              deniedReason={deniedEntries.get(entry.id) ?? undefined}
              onReconnect={() => reconnectMountEntry(entry.id)}
              onToggle={() => toggleMountEntry(entry)}
              onRemove={() => removeMountEntry(entry.id)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Add Mount Form ────────────────────────────────────────────────────────

/** Human-readable labels for each backend kind. */
const BACKEND_LABELS: Record<BackendKindSelect, string> = {
  fsa: "File System Access",
  indexeddb: "IndexedDB",
}

function AddMountForm({ onAdded }: { onAdded: () => void }) {
  const [adding, setAdding] = useState(false)
  const [pathInput, setPathInput] = useState("/epubs")
  const [pathError, setPathError] = useState<string | null>(null)
  const [backendKind, setBackendKind] = useState<BackendKindSelect>("fsa")

  const handleAdd = useCallback(async () => {
    setAdding(true)
    setPathError(null)

    const mountPath = normaliseMountPath(pathInput)
    if (!isValidMountPath(mountPath)) {
      setPathError("Invalid mount path. Use a path like /notes.")
      setAdding(false)
      return
    }

    try {
      if (backendKind === "fsa") {
        // ── FSA: show directory picker ─────────────────────────────────
        const handle = await window.showDirectoryPicker({ mode: "readwrite" })
        const permitted = await requestHandlePermission(handle)
        if (!permitted) {
          setPathError("Permission denied for the selected directory.")
          setAdding(false)
          return
        }

        const entry: MountEntry = {
          id: crypto.randomUUID(),
          name: handle.name,
          mountPath,
          backend: { kind: "fsa", handle },
          //handle, // backward compat
          shouldBeMounted: true,
        }

        await addMountEntry(entry)
      } else {
        // ── IndexedDB: no picker, just name + path ─────────────────────
        const entry: MountEntry = {
          id: crypto.randomUUID(),
          name: mountPath, // default name is the mount path
          mountPath,
          backend: { kind: "indexeddb", storeName: storeNameFromPath(mountPath) },
          shouldBeMounted: true,
        }

        // request for persistent storage in best effort.
        await void requestStoragePersistence()
        
        await addMountEntry(entry)
      }

      onAdded()
    } catch (e) {
      if ((e as DOMException).name === "AbortError") {
        // User cancelled picker — no error
      } else {
        setPathError("Failed to add mount. Check console for details.")
        console.error(e)
      }
    } finally {
      setAdding(false)
    }
  }, [pathInput, backendKind, onAdded])

  return (
    <div className="flex flex-col gap-2">
      {/* Backend type selector */}
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs" htmlFor="backend-kind">
          Backend
        </label>
        <select
          id="backend-kind"
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-md border px-2 text-sm outline-none focus-visible:ring-3"
          value={backendKind}
          onChange={(e) => setBackendKind(e.target.value as BackendKindSelect)}
        >
          {(["fsa", "indexeddb"] as BackendKindSelect[]).map((k) => (
            <option key={k} value={k}>
              {BACKEND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="mount-path">
            Mount path
          </label>
          <input
            id="mount-path"
            type="text"
            className="border-input bg-background placeholder:text-muted-foreground/50 focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-md border px-2 text-sm outline-none focus-visible:ring-3"
            placeholder="/epubs"
            value={pathInput}
            onChange={(e) => {
              setPathInput(e.target.value)
              setPathError(null)
            }}
          />
        </div>
        <Button onClick={handleAdd} disabled={adding} size="sm">
          <Plus className="mr-1 size-4" />
          {adding ? "Adding…" : "Add"}
        </Button>
      </div>
      {pathError && <p className="text-destructive text-xs">{pathError}</p>}
    </div>
  )
}

// ── Mount Row ─────────────────────────────────────────────────────────────

/** Translate backend kind to a short display label. */
function backendTypeLabel(cfg: BackendConfig): string {
  switch (cfg.kind) {
    case "fsa":
      return "FSA"
    case "indexeddb":
      return "IndexedDB"
  }
}

interface MountRowProps {
  entry: MountEntry
  /** Reason string if the entry is in the denied map, else undefined. */
  deniedReason?: string
  onReconnect: () => Promise<void>
  onToggle: () => void
  onRemove: () => void
}

function MountRow({ entry, deniedReason, onReconnect, onToggle, onRemove }: MountRowProps) {
  const [reconnecting, setReconnecting] = useState(false)
  const [reconnectError, setReconnectError] = useState<string | null>(null)
  const isDenied = deniedReason !== undefined
  const isFsa = entry.backend.kind === "fsa"

  const handleReconnect = useCallback(async () => {
    setReconnecting(true)
    setReconnectError(null)
    try {
      await onReconnect()
    } catch (e) {
      setReconnectError(isFsa ? "Permission denied." : "Failed to reconnect.")
      console.error("Reconnect failed:", e)
    } finally {
      setReconnecting(false)
    }
  }, [onReconnect, isFsa])

  if (isDenied) {
    return (
      <div className="flex flex-col gap-1 rounded-md border border-amber-500/40 bg-amber-500/5 px-2 py-1.5">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-amber-500" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{entry.name}</span>
              <span className="text-muted-foreground truncate text-xs">
                {entry.mountPath} · {backendTypeLabel(entry.backend)}
              </span>
            </div>
          </div>
          {/* Only show reconnect for FSA entries (IndexedDB reconnects are no-op) */}
          {isFsa ? (
            <Button
              onClick={handleReconnect}
              disabled={reconnecting}
              size="sm"
              variant="outline"
              className="ml-2 shrink-0"
            >
              <RefreshCw className={`mr-1 size-3.5 ${reconnecting ? "animate-spin" : ""}`} />
              {reconnecting ? "Connecting…" : "Reconnect"}
            </Button>
          ) : (
            <Button
              onClick={handleReconnect}
              disabled={reconnecting}
              size="sm"
              variant="outline"
              className="ml-2 shrink-0"
            >
              <RefreshCw className={`mr-1 size-3.5 ${reconnecting ? "animate-spin" : ""}`} />
              {reconnecting ? "Retrying…" : "Retry"}
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          {isFsa
            ? "Permission revoked after browser restart. Click Reconnect to re-grant access."
            : deniedReason}
          {reconnectError && <span className="text-destructive ml-1">{reconnectError}</span>}
        </p>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${
        entry.shouldBeMounted ? "" : "opacity-50"
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium">{entry.name}</span>
        <span className="text-muted-foreground truncate text-xs">
          {entry.mountPath} · {backendTypeLabel(entry.backend)}
        </span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger>
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onToggle}>
            {entry.shouldBeMounted ? (
              <>
                <PowerOff className="mr-2 size-4" />
                Unmount
              </>
            ) : (
              <>
                <Power className="mr-2 size-4" />
                Mount
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onRemove}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 size-4" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}