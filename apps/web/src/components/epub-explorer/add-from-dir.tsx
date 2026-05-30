/**
 * @file add-from-dir.tsx
 *
 * "From Directory" button that triggers a full regeneration of the EPUB
 * collection by scanning the ZenFS directory structure.
 *
 * The regeneration flow:
 * 1. Scan ZenFS under `epub.zenFSPath`
 * 2. Build a fresh `EpubCollection` by entering `.epubdir` directories and reading `book.json`
 * 3. Write the result to `viewModel.json` via the serialized write queue
 * 4. Replace the in-memory collection
 * 5. Notify all subscribers (UI re-renders)
 *
 * @module add-from-dir
 */

import { Button } from "@workspace/ui/components/button"
import { RefreshCwIcon } from "lucide-react"
import { useEpubContext } from "./epub-context"

/**
 * "From Directory" button.
 *
 * Calls `viewModel.regenerateFromDirectory()` which performs a full scan
 * of the ZenFS storage and replaces both the persisted `viewModel.json`
 * and the in-memory collection.
 */
export function AddFromDirectory() {
  const { viewModel } = useEpubContext()

  async function handleClick() {
    try {
      await viewModel.regenerateFromDirectory()
    } catch (err) {
      console.error("[AddFromDirectory] Failed to regenerate collection:", err)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      <RefreshCwIcon data-icon="inline-start" />
      From Directory
    </Button>
  )
}