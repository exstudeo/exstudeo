## 1. Create MIME utility module

- [x] 1.1 Create `sw-routes/mime.ts` — implement `inferMimeType()` with comprehensive extension-to-Content-Type mapping table (HTML, XHTML, XML, CSS, JS, JSON, SVG, images, fonts, audio, video, OPF → `application/xhtml+xml`, fallback `text/plain`)
- [x] 1.2 Add TSDoc documentation for the exported `inferMimeType()` function

## 2. Generalize EPUB route strategy

- [x] 2.1 Update match callback in `sw-routes/epub.ts` — remove `request.mode`/`destination` filters and `.html` extension check; keep origin, method (`GET`), and `/@epubs/` prefix checks
- [x] 2.2 Add percent-decoding to handler — apply `decodeURIComponent()` to `restPath` extracted from `url.pathname` before path joining
- [x] 2.3 Switch file read from UTF-8 text to binary — use `zenfsPromises.readFile(fullPath)` (no encoding) returning `Uint8Array`; import and use `inferMimeType()` for Content-Type header
- [x] 2.4 Rename strategy from `"epub-html"` to `"epub-resources"` — update strategy name and module-level TSDoc

## 3. Update SW registration

- [x] 3.1 Update `sw.ts` — the `createEpubRouteStrategy()` import is unchanged (strategy name is internal), but verify registration comment references `epub-resources`

## 4. Verify and test

- [x] 4.1 Run full build and check for TypeScript errors: `npm run build` from `apps/web/`
- [x] 4.2 Run lint and typecheck: `npm run lint && npm run typecheck` from root
- [x] 4.3 Manual verification — serve the app, verify that EPUB subresources (images, XHTML, CSS, fonts) are served with correct Content-Type headers via SW intercept