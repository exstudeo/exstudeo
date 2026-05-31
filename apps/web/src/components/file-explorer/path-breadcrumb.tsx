/**
 * Breadcrumb navigation for the file explorer current directory path.
 *
 * Each segment is clickable and navigates directly to that path.
 *
 * @module path-breadcrumb
 */

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"

interface PathBreadcrumbProps {
  /** Current path within the active mount, e.g. "/notes/subdir" */
  path: string
  /** Called when user clicks a breadcrumb segment */
  onNavigate: (path: string) => void
}

export function PathBreadcrumb({ path, onNavigate }: PathBreadcrumbProps) {
  // Split path into segments: "/notes/subdir/deep" → ["notes", "subdir", "deep"]
  const segments = path.split("/").filter(Boolean)

  // if (segments.length === 0) {
  //   return null
  // }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, i) => {
          const segmentPath = "/" + segments.slice(0, i + 1).join("/")
          const isLast = i === segments.length - 1

          return (
            <BreadcrumbItem key={segmentPath}>
              {!isLast ? (
                <>
                  <BreadcrumbLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      onNavigate(segmentPath)
                    }}
                    className="text-sm"
                  >
                    {segment}
                  </BreadcrumbLink>
                  <BreadcrumbSeparator />
                </>
              ) : (
                <span className="text-foreground text-sm font-medium">{segment}</span>
              )}
            </BreadcrumbItem>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}