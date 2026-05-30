## 1. Type and data layer

- [x] 1.1 Add optional `href?: string` field to `FileEntry` interface in `directory-table.tsx` with TSDoc

## 2. Href computation in FileExplorerPage

- [x] 2.1 Import `useConfig()` hook in `page.tsx`
- [x] 2.2 In the entries `useMemo`, compute `href` for non-directory entries whose path matches a prefix from `config.explorer.fsUrlBidirectional`, transforming `<basepath>/<rest>` to `/<routerpath>/<rest>` (e.g., `/epubs/x.html` → `/@epubs/x.html`)

## 3. UI rendering in DirectoryTable

- [x] 3.1 Render the file name `<span>` inside an `<a href={entry.href}>` when `entry.href` is defined, with `hover:underline text-primary` styling and `onClick` stopPropagation
- [x] 3.2 Update row-level `onClick` — when `entry.href` exists, open in new tab via `window.open()`; otherwise call `onOpenFile(entry)` as before

## 4. Spec sync and documentation

- [x] 4.1 Add the new requirement "Files under fsUrlBidirectional paths render as hyperlinks" to `openspec/specs/file-explorer/spec.md`
- [x] 4.2 Append entry to `Development.log.md`

## 5. Verification

- [x] 5.1 Run `npm run build` from `apps/web` and confirm zero errors