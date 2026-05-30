## 1. ViewModel write path refactor

- [x] 1.1 Refactor `_persistEpubDir` to accept the epubdir path and write `book.epub` and `book.json` inside it (instead of sibling `.epub` and `.epub.json` at the parent collection path)
- [x] 1.2 Refactor `AddEpubsExtracted` to first create `<safeId>.epubdir/`, then call updated `_persistEpubDir` to write artifacts inside, then extract zip entries into the same directory
- [x] 1.3 Update `AddEpubsExtracted` failure cleanup to use single `promisesFs.rmdir(<safeId>.epubdir/)` instead of unlinking individual sibling files

## 2. ViewModel read path refactor

- [x] 2.1 Refactor `_scanDir` to enter directories ending in `.epubdir`, read `book.json`, parse `IEpub`, and use `metadata.uniqueIdentifier` as the collection key
- [x] 2.2 Update `_scanDir` to skip `.epubdir` entries as sub-collections (don't recurse into them beyond reading `book.json`)
- [x] 2.3 Update `getCollectionFromStorage` static method if the scanning flow changed (verify call signature still works)

## 3. ViewModel delete path refactor

- [x] 3.1 Refactor `DelEpubsAt` to replace three sibling deletes (`.epub`, `.epub.json`, `.epubdir/`) with single `promisesFs.rmdir(<safeId>.epubdir/)`
- [x] 3.2 Verify that in-memory collection update happens before `rmdir` (existing behavior, confirm intact)
- [x] 3.3 Verify `viewModel.json` persist and subscriber notification still work after deletion

## 4. Type verification

- [x] 4.1 Audit `IEpub` type — verify `OpfPath` remains correct (relative to epubdir root, same as archive root)
- [x] 4.2 Audit `EpubCollection` type — verify no changes needed (keys remain `uniqueIdentifier`, structure unchanged)

## 5. EPUB explorer UI cleanup

- [x] 5.1 Update `epub-item-menu.tsx` delete confirmation messaging if it references sibling file names
- [x] 5.2 Verify `add-from-dir.tsx` regeneration still works with updated `_scanDir` logic
- [x] 5.3 Verify `epub-tree.tsx` rendering unchanged (uses `uniqueIdentifier` keys from `EpubCollection`, no storage convention dependency)

## 6. Validation

- [x] 6.1 Run existing unit tests (`cd apps/web && npm run test:run`) and fix any failures
- [x] 6.2 Test add → delete flow manually: add an EPUB, verify `.epubdir/` contains `book.epub` and `book.json` at root, delete, verify directory removed
- [x] 6.3 Test "From Directory" regeneration: verify scan picks up the new `.epubdir` layout correctly
- [x] 6.4 Run typecheck (`npm run typecheck`) from monorepo root
- [x] 6.5 Update `Development.log.md` with summary of the refactor