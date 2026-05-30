# PWA Foundation

## MODIFIED Requirements

### Requirement: Navigation fallback returns 404

*Replaced by sw-routing spec. See `specs/sw-routing/spec.md` for the new three-tier routing scheme.*

The service worker SHALL register route handlers after the existing `manifest.length > 0` guard: a SPA redirect handler for known routes (from `route.path.ts`), a diagnostic handler for `/validate_service_worker.html`, and a 404 catch-all for everything else. The old `NavigationRoute`-based flat 404 is removed.

#### Scenario: All route handlers guard behind non-empty manifest
- **WHEN** the service worker initializes
- **AND** the manifest is non-empty
- **THEN** the SPA redirect, validation, and 404 handlers are registered
- **AND** the previous `NavigationRoute` fallback is NOT registered

### Requirement: Custom route handlers register before fallback

*Replaced by sw-routing spec. Registration order is: SPA redirect → validation handler → 404 catch-all.*

Custom service worker route handlers SHALL be registered in explicit order. Workbox evaluates handlers in registration order, so the specific handlers (SPA redirect, validation page) MUST precede the catch-all 404.

#### Scenario: Three handlers in proper order
- **WHEN** custom route handlers are registered
- **THEN** the SPA redirect handler is first in registration order
- **AND** the validation page handler is second
- **AND** the 404 catch-all is last