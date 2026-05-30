/**
 * Dialog for managing directory mounts — add, mount/unmount toggle, and remove.
 *
 * @module mounts-dialog
 */

import { useState, useCallback, useEffect } from "react"
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
  saveMount as persistMount,
  requestHandlePermission,
  type MountEntry,
} from "@/lib/mount-store"
import { mountBackend } from "@/lib/zenfs"
import type { ZenFSState } from "@/hooks/use-zenfs"

interface MountsDialogProps {
  zenfs: Pick<ZenFSState, "entries" | "toggleMount" | "removeMount" | "skippedIds" | "reconnectMount">
}

export function MountsDialog({ zenfs }: MountsDialogProps) {
  const [open, setOpen] = useState(false)
  const _ = useEffect(() => {}, [zenfs.entries])

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
          {zenfs.entries.length === 0 && (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No mounts yet. Add a directory to get started.
            </p>
          )}

          {zenfs.entries.map((entry) => (
            <MountRow
              key={entry.id}
              entry={entry}
              skipped={zenfs.skippedIds.includes(entry.id)}
              onReconnect={() => zenfs.reconnectMount(entry.id)}
              onToggle={() => zenfs.toggleMount(entry)}
              onRemove={() => zenfs.removeMount(entry.id)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Add Mount Form ────────────────────────────────────────────────────────

function AddMountForm({ onAdded }: { onAdded: () => void }) {
  const [adding, setAdding] = useState(false)
  const [pathInput, setPathInput] = useState("/epubs")
  const [pathError, setPathError] = useState<string | null>(null)

  const handlePick = useCallback(async () => {
    setAdding(true)
    setPathError(null)

    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" })
      const permitted = await requestHandlePermission(handle)
      if (!permitted) {
        setPathError("Permission denied for the selected directory.")
        setAdding(false)
        return
      }

      const mountPath = normaliseMountPath(pathInput)
      if (!isValidMountPath(mountPath)) {
        setPathError("Invalid mount path. Use a path like /notes.")
        setAdding(false)
        return
      }

      const entry: MountEntry = {
        id: crypto.randomUUID(),
        name: handle.name,
        mountPath,
        handle,
        mounted: true,
      }

      // Persist to IndexedDB and mount and
      await persistMount(entry)
      await mountBackend(entry)
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
  }, [pathInput, onAdded])

  return (
    <div className="flex flex-col gap-2">
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
        <Button onClick={handlePick} disabled={adding} size="sm">
          <Plus className="mr-1 size-4" />
          {adding ? "Adding…" : "Add"}
        </Button>
      </div>
      {pathError && <p className="text-destructive text-xs">{pathError}</p>}
    </div>
  )
}

// ── Mount Row ─────────────────────────────────────────────────────────────

interface MountRowProps {
  entry: MountEntry
  skipped: boolean
  onReconnect: () => Promise<void>
  onToggle: () => void
  onRemove: () => void
}

function MountRow({ entry, skipped, onReconnect, onToggle, onRemove }: MountRowProps) {
  const [reconnecting, setReconnecting] = useState(false)
  const [reconnectError, setReconnectError] = useState<string | null>(null)

  const handleReconnect = useCallback(async () => {
    setReconnecting(true)
    setReconnectError(null)
    try {
      await onReconnect()
    } catch (e) {
      setReconnectError("Permission denied.")
      console.error("Reconnect failed:", e)
    } finally {
      setReconnecting(false)
    }
  }, [onReconnect])

  if (skipped) {
    return (
      <div className="flex flex-col gap-1 rounded-md border border-amber-500/40 bg-amber-500/5 px-2 py-1.5">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-amber-500" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{entry.name}</span>
              <span className="text-muted-foreground truncate text-xs">{entry.mountPath}</span>
            </div>
          </div>
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
        </div>
        <p className="text-muted-foreground text-xs">
          Permission revoked after browser restart. Click Reconnect to re-grant access.
        </p>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${
        entry.mounted ? "" : "opacity-50"
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium">{entry.name}</span>
        <span className="text-muted-foreground truncate text-xs">{entry.mountPath}</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger>
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onToggle}>
            {entry.mounted ? (
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