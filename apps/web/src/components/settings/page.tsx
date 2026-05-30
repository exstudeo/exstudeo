/**
 * Settings page — raw JSON editor for the application config.
 *
 * Provides a textarea with the full {@link AppConfig} formatted as JSON,
 * plus Save, Discard, and Reset buttons. Discard reverts to the last
 * persisted state (no auto-save).
 *
 * @module settings-page
 */

import { useEffect, useState, useCallback } from "react"
import { Button } from "@workspace/ui/components/button"
import { useConfig } from "@/hooks/use-config"
import { getAllConfigs, resetConfig } from "@/lib/config-store"
import type { AppConfig, ConfigDomain } from "@/config"

export function SettingsPage() {
  const { config, setDomain } = useConfig()
  const [jsonText, setJsonText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Format config as pretty JSON on mount / when config changes
  useEffect(() => {
    setJsonText(JSON.stringify(config, null, 2))
    setError(null)
  }, [config])

  const handleSave = useCallback(async () => {
    setError(null)

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(jsonText) as Record<string, unknown>
    } catch (e) {
      setError(`Invalid JSON: ${(e as Error).message}`)
      return
    }

    setSaving(true)
    try {
      // Split parsed JSON by domain and persist each
      const domains = ["epub", "ghgist", "general"] as const
      for (const domain of domains) {
        const domainValue = parsed[domain]
        if (domainValue !== undefined && typeof domainValue === "object") {
          await setDomain(domain as ConfigDomain, domainValue as Record<string, unknown>)
        }
      }
    } finally {
      setSaving(false)
    }
  }, [jsonText, setDomain])

  const handleDiscard = useCallback(async () => {
    setError(null)
    const fresh = await getAllConfigs()
    setJsonText(JSON.stringify(fresh, null, 2))
  }, [])

  const handleReset = useCallback(async () => {
    setError(null)
    await resetConfig()
    // getAllConfigs is called inside resetConfig, cache is refreshed
    const defaults = await getAllConfigs()
    setJsonText(JSON.stringify(defaults, null, 2))
  }, [])

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Application Config</h2>
      </div>

      {/* JSON textarea */}
      <div className="relative min-h-0 flex-1">
        <textarea
          className="font-mono text-sm h-full w-full resize-none rounded-md border border-input bg-background p-3 text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring"
          spellCheck={false}
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value)
            setError(null)
          }}
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="outline" onClick={handleDiscard} disabled={saving}>
          Discard
        </Button>
        <Button variant="outline" onClick={handleReset} disabled={saving}>
          Reset
        </Button>
      </div>
    </div>
  )
}