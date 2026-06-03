import { BrowserRouter, Routes, Route, Navigate } from "react-router"
import { useNavigate } from "react-router"
import { useEffect } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { FileExplorerPage } from "@/components/file-explorer/page"
import { EpubExplorerPage } from "@/components/epub-explorer/page"
import { SettingsPage } from "@/components/settings/page"
import { SPA_ROUTES } from "./route.path"
import { parseRedirectParams } from "./lib/redirect-handler"

/**
 * Handles redirect parameters (?redirect= and ?fragment=) on initial load.
 * These are set by 404.html (cold visit — no SW installed yet).
 * The SW no longer uses redirect parameters; it serves the precached app
 * shell directly while preserving the original URL.
 */
function RedirectHandler() {
  const navigate = useNavigate()

  useEffect(() => {
    const result = parseRedirectParams()
    if (!result) return

    if (result.isSpaRoute) {
      // Known SPA route — navigate client-side
      navigate(result.targetPath, { replace: true })
    } else {
      // Unknown path — let the browser navigate (SW will serve a 404)
      location.replace(result.targetPath)
    }
  }, [navigate])

  return null
}

export function App() {
  return (
    <BrowserRouter>
      <RedirectHandler />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to={SPA_ROUTES.epub} replace />} />
          <Route path={SPA_ROUTES.files.slice(1)} element={<FileExplorerPage />} />  
          <Route path={SPA_ROUTES.epub.slice(1)} element={<EpubExplorerPage />} />
          <Route path={SPA_ROUTES.settings.slice(1)} element={<SettingsPage />} />
          {/*
           * Catch-all for unmatched routes (e.g., `/filesxx`).
           * Redirect to root — the SW will handle 404 if needed.
           */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
