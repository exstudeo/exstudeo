/**
 * @file epub-tree.tsx
 *
 * Transforms an {@link EpubCollection} into a flat array of {@link TreeDataItem}
 * suitable for the shadcn-tree-view component, and renders it via `<TreeView>`.
 *
 * ## Display rules
 *
 * - Collection nodes (keys that map to sub-collections) show the key name
 *   as their label.
 * - EPUB leaf nodes (keys that map to {@link IEpub}) show `title` with
 *   fallback to `uniqueIdentifier`.
 * - Each collection node receives an `actions` slot with a "➕ Add Epub"
 *   dropdown trigger.
 * - Each EPUB leaf node receives an `actions` slot with a "🗑 Delete Epub"
 *   dropdown trigger.
 *
 * @module epub-tree
 */

import { useMemo } from "react"
import {
  TreeView,
  type TreeDataItem,
} from "@workspace/ui/components/tree-view"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@workspace/ui/components/dropdown-menu"
import { Button } from "@workspace/ui/components/button"
import { MoreHorizontalIcon, BookIcon, FolderIcon } from "lucide-react"
import { isEpub, type EpubCollection, type IEpub } from "@/lib/epub-lib/type"
import { useEpubContext } from "./epub-context"

/**
 * Props for the EPUB tree component.
 */
export interface EpubTreeProps {
  /**
   * Optional callback invoked when the user wants to add EPUB files to a
   * collection. Receives the path segments leading to that collection.
   */
  onAddEpub?: (collectionPath: string[]) => void
  /**
   * Optional callback invoked when the user wants to delete an EPUB.
   * Receives the unique identifier and the parent collection path.
   */
  onDeleteEpub?: (epubId: string, collectionPath: string[]) => void
  /**
   * Optional callback invoked when the user wants to delete an entire
   * collection (directory) from the tree.
   * Receives the full path segments of the collection to delete.
   */
  onDeleteCollection?: (collectionPath: string[]) => void

  /**
   * 
   * @param collectionPath 
   *
   */
  onAddCollection?: (collectionPath: string[]) => void


  /**   * Optional callback invoked when the user clicks on an EPUB leaf node to
   * open it. Receives the EPUB unique identifier and its parent collection
   * path.
   */
  onBookOpen?: (epubId: string, collectionPath: string[]) => void
}

/**
 * Convert an {@link EpubCollection} node and a breadcrumb path into a
 * {@link TreeDataItem} array for the tree view.
 *
 * Each key in `collection` becomes a tree node — either a collection
 * (expandable) or an EPUB leaf.
 */
function collectionToTreeData(
  collection: EpubCollection,
  parentPath: string[],
  onAddEpub?: (path: string[]) => void,
  onDeleteEpub?: (id: string, path: string[]) => void,
  onAddCollection?: (path: string[]) => void,
  onDeleteCollection?: (path: string[]) => void,
  onBookOpen?: (epubId: string, collectionPath: string[]) => void,

): TreeDataItem[] {
  const items: TreeDataItem[] = []

  for (const [key, value] of Object.entries(collection)) {
    if (isEpub(value)) {
      // EPUB leaf node
      items.push({
        id: value.uniqueIdentifier,
        name: value.title ?? value.uniqueIdentifier,
        icon: BookIcon,
        actions: (
          <EpubLeafActions
            epubId={value.uniqueIdentifier}
            collectionPath={parentPath}
            onDeleteEpub={onDeleteEpub}
            onBookOpen={onBookOpen}
          />
        ),
      })
    } else {
      // Collection node — recurse
      const childPath = [...parentPath, key]
      items.push({
        id: key,
        name: key,
        icon: FolderIcon,
        openIcon: FolderIcon,
        children: collectionToTreeData(
          value as EpubCollection,
          childPath,
          onAddEpub,
          onDeleteEpub,
          onDeleteCollection,
        ),
        actions: (
          <CollectionActions
            collectionPath={childPath}
            onAddEpub={onAddEpub}
            onDeleteCollection={onDeleteCollection}
            onAddCollection={onAddCollection}
          />
        ),
      })
    }
  }

  return items
}

/**
 * Actions dropdown for a collection node — shows "Add Epub".
 */
export function CollectionActions({
  collectionPath,
  onAddEpub,
  onDeleteCollection,
  onAddCollection
}: {
  collectionPath: string[]
  onAddEpub?: (path: string[]) => void
  onDeleteCollection?: (path: string[]) => void
  onAddCollection?: (path: string[]) => void
}) {
  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-6" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} />}>
          <MoreHorizontalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4}>
          <DropdownMenuItem
            onClick={() => onAddEpub?.(collectionPath)}
          >
            Add Epub
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onAddCollection?.(collectionPath)}
          >
            Add Collection
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onDeleteCollection?.(collectionPath)}
          >
            Remove Collection
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/**
 * Actions dropdown for an EPUB leaf node — shows "Delete Epub".
 */
export function EpubLeafActions({
  epubId,
  collectionPath,
  onDeleteEpub,
  onBookOpen
}: {
  epubId: string
  collectionPath: string[]
  onDeleteEpub?: (id: string, path: string[]) => void
  onBookOpen?: (epubId: string, collectionPath: string[]) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-6" />}>
        <MoreHorizontalIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4}>
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onDeleteEpub?.(epubId, collectionPath)}
        >
          Delete Epub
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onBookOpen?.(epubId, collectionPath)}
        >
          Open Epub
        </DropdownMenuItem>
      </DropdownMenuContent>

    </DropdownMenu>
  )
}

/**
 * EPUB collection tree — renders the entire collection hierarchy using the
 * shadcn-tree-view component.
 *
 * Each collection node shows a dropdown with "Add Epub".
 * Each EPUB leaf node shows a dropdown with "Delete Epub".
 */
export function EpubTree({ onAddEpub, onDeleteEpub, onDeleteCollection, onAddCollection, onBookOpen }: EpubTreeProps) {
  const { collection } = useEpubContext()

  const treeData = useMemo(
    () =>
      collectionToTreeData(collection, [], onAddEpub, onDeleteEpub, onAddCollection, onDeleteCollection, onBookOpen),
    [collection, onAddEpub, onDeleteEpub, onAddCollection, onDeleteCollection, onBookOpen],
  )

  if (treeData.length === 0) {
    return (
      <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
        No EPUBs found. Add files or scan from directory.
      </div>
    )
  }

  return (
    <TreeView
      data={treeData}
      expandAll={false}
      defaultNodeIcon={FolderIcon}
      defaultLeafIcon={BookIcon}
    />
  )
}