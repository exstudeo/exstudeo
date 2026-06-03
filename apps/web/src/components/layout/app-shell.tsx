/**
 * Application shell — tab bar + route outlet.
 *
 * Uses shadcn `Tabs` synced to the current React Router location.
 * On initial mount, loads persisted mount entries and configures ZenFS.
 *
 * @module app-shell
 */

import { useEffect, useRef, useState } from "react"
import { Outlet, useNavigate, useLocation } from "react-router"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@workspace/ui/components/tabs"
import { mountBackend, markDenied } from "@/lib/zenfs"
import { loadMounts } from "@/lib/mount-store"
import { BackendValidationError } from "@/lib/backend-resolver"
import { getAllConfigs } from "@/lib/config-store"

import { SPA_ROUTES } from "../../route.path"

const TABS = [
  { value: SPA_ROUTES.files, label: "Files" },
  { value: SPA_ROUTES.epub, label: "Epub" },
  { value: SPA_ROUTES.settings, label: "Settings" },
] as const

export function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const [initialising, setInitialising] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Guard: only run the async init once, even if StrictMode double-mounts
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    ;(async () => {
      try {
        const entries = await loadMounts()

        // Check permissions for mounted entries — after a browser restart,
        // FSA handles stored in IndexedDB lose their permission grant.
        // `mountBackend()` calls `resolveBackendConfig()` which validates
        // each backend and throws `BackendValidationError` on failure.
        for (const entry of entries) {
          if (!entry.shouldBeMounted) continue
          try {
            await mountBackend(entry)
            console.log(`[AppShell] Mounted "${entry.mountPath}" (${entry.backend.kind})`)
          } catch (e) {
            if (e instanceof BackendValidationError) {
              markDenied(entry.id, e.message)
              console.warn(
                `[AppShell] Backend validation failed for "${entry.mountPath}" (${entry.backend.kind}):`,
                e.message,
              )
            } else {
              console.warn(`[AppShell] Failed to mount "${entry.mountPath}":`, e)
            }
          }
        }

        // Hydrate the config cache from IndexedDB so the reactive snapshot
        // reflects persisted values rather than bare defaults.
        await getAllConfigs()
      } catch (e) {
        console.error("Failed to initialise file system:", e)
        setError("Failed to initialise file system.")
      } finally {
        setInitialising(false)
      }
    })()
  }, [])

  // Derive the active tab value from the current path.
  // We use the first segment, e.g. /files/foo → /files
  const activeTab = "/" + (location.pathname.split("/")[1] || "files")

  function onTabChange(value: string) {
    navigate(value)
  }

  if (initialising) {
    return (
      <div className="flex h-svh items-center justify-center text-muted-foreground text-sm">
        Initialising…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-2 text-sm">
        <p className="text-destructive">{error}</p>
        <p className="text-muted-foreground">Reload the page to try again.</p>
      </div>
    )
  }

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="flex h-svh flex-col">
      <header className="border-border/40 bg-background shrink-0 border-b px-4">
        <TabsList className="h-11">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <TabsContent value={SPA_ROUTES.files} className="m-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <Outlet />
        </TabsContent>
        <TabsContent value={SPA_ROUTES.epub} className="m-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <Outlet />
        </TabsContent>
        <TabsContent value={SPA_ROUTES.settings} className="m-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <Outlet />
        </TabsContent>
      </div>
    </Tabs>
  )
}
