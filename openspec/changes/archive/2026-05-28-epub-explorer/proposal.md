## Why

The EPUB storage conventions and ViewModel scaffolding exist, but there is no user-facing UI to browse, add, or delete EPUBs within the app. Users need a dedicated EPUB explorer to manage their collection — view nested directory structures, add EPUB files from their device, remove unwanted ones, and regenerate the collection index from the virtual filesystem on demand.

## What Changes

- New `/epub` SPA route and persistent tab (lowercase "epub") in the tab bar, between Reader and Settings
- EPUB Explorer page at `/epub` with:
  - A tree-view of the EPUB collection, rendered from `EpubCollection` data stored in ZenFS
  - Collection directories shown with their ZenFS directory key; EPUB files shown with their `title` (fallback to `uniqueIdentifier`)
  - "Add Epub" action on collection nodes and "Delete Epub" action on EPUB leaf nodes, via dropdown menu
  - A "From Directory" button at the top that scans ZenFS directories, rebuilds the `viewModel.json`, and replaces the in-memory collection
- ViewModel class refactored: accepts raw `fs` object instead of `ZenFSState`, simplified `EpubCollection` type, `getCollectionFromStorage()` implemented
- `EpubCollection` type simplified from mapped-type form to `{ [key: string]: EpubCollection | IEpub }`
- shadcn tree-view component added to `packages/ui` shared component library

## Capabilities

### New Capabilities
- `epub-explorer`: EPUB collection browser with tree navigation, add/delete actions, and from-directory regeneration

### Modified Capabilities

*(None — existing capabilities are unchanged)*

## Impact

- **apps/web**: New route page, context provider, tree component, dropdown menu integration; modified app shell (tab), route paths, and ViewModel
- **packages/ui**: New shared `tree-view` component installed from shadcn registry
- **openspec/specs/**: New `epub-explorer/spec.md`
- **Dependencies**: `jszip` (already planned for `epubzip.ts`), `shadcn-tree-view` registry component