/**
 * Table-form directory listing for the file explorer.
 *
 * Displays file entries with columns: Name, Size, Type, Modified.
 * Supports click-to-navigate for directories and click-to-log for files.
 * Column headers are clickable for sorting.
 *
 * @module directory-table
 */

import { useMemo, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Folder, File } from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number | null
  mtimeMs: number | null
  /** If set, the entry SHOULD be rendered as a hyperlink (opens in a new tab) to the SW-served URL. */
  href?: string
}

type SortKey = "name" | "size" | "type" | "modified"
type SortDir = "asc" | "desc"

// ── Helpers ───────────────────────────────────────────────────────────────

function formatSize(bytes: number | null): string {
  if (bytes === null) return "—"
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const v = bytes / Math.pow(1024, i)
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

function formatTime(ms: number | null): string {
  if (ms === null) return "—"
  const d = new Date(ms)
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    hour: "2-digit",
    minute: "2-digit",
  })
}

function fileType(name: string, isDirectory: boolean): string {
  if (isDirectory) return "folder"
  const i = name.lastIndexOf(".")
  return i > 0 ? name.slice(i + 1).toUpperCase() : "—"
}

function SortIcon({ column, activeKey, direction }: { column: SortKey; activeKey: SortKey; direction: SortDir }) {
  if (activeKey !== column) return null
  return <span className="ml-1">{direction === "asc" ? "↑" : "↓"}</span>
}

// ── Component ─────────────────────────────────────────────────────────────

interface DirectoryTableProps {
  entries: FileEntry[]
  onNavigate: (path: string) => void
  onOpenFile: (entry: FileEntry) => void
}

export function DirectoryTable({ entries, onNavigate, onOpenFile }: DirectoryTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const sorted = useMemo(() => {
    const copy = [...entries]

    // Directories always come first, then sort within each group
    copy.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1
      }

      let cmp = 0
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name)
          break
        case "size":
          cmp = (a.size ?? 0) - (b.size ?? 0)
          break
        case "type":
          cmp = fileType(a.name, a.isDirectory).localeCompare(fileType(b.name, b.isDirectory))
          break
        case "modified":
          cmp = (a.mtimeMs ?? 0) - (b.mtimeMs ?? 0)
          break
      }
      return sortDir === "asc" ? cmp : -cmp
    })

    return copy
  }, [entries, sortKey, sortDir])

  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => toggleSort("name")}
            >
              Name<SortIcon column="name" activeKey={sortKey} direction={sortDir} />
            </TableHead>
            <TableHead
              className="w-20 cursor-pointer select-none text-right"
              onClick={() => toggleSort("size")}
            >
              Size<SortIcon column="size" activeKey={sortKey} direction={sortDir} />
            </TableHead>
            <TableHead
              className="w-16 cursor-pointer select-none"
              onClick={() => toggleSort("type")}
            >
              Type<SortIcon column="type" activeKey={sortKey} direction={sortDir} />
            </TableHead>
            <TableHead
              className="w-36 cursor-pointer select-none"
              onClick={() => toggleSort("modified")}
            >
              Modified<SortIcon column="modified" activeKey={sortKey} direction={sortDir} />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((entry) => (
            <TableRow
              key={entry.path}
              className="cursor-pointer"
              onClick={() => {
                if (entry.isDirectory) {
                  onNavigate(entry.path)
                } else if (entry.href) {
                  window.open(entry.href, "_blank", "noopener,noreferrer")
                } else {
                  onOpenFile(entry)
                }
              }}
            >
              <TableCell className="flex items-center gap-2">
                {entry.isDirectory ? (
                  <Folder className="size-4 shrink-0 text-blue-500" />
                ) : (
                  <File className="size-4 shrink-0 text-muted-foreground" />
                )}
                {entry.href ? (
                  <a
                    href={entry.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate hover:underline text-primary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {entry.name}
                  </a>
                ) : (
                  <span className="truncate">{entry.name}</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {entry.isDirectory ? "—" : formatSize(entry.size)}
              </TableCell>
              <TableCell>{fileType(entry.name, entry.isDirectory)}</TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {formatTime(entry.mtimeMs)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}