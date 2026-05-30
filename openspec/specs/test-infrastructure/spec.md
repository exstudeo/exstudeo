# Test Infrastructure

## Purpose

Unit and component test infrastructure using Vitest with React Testing Library. Tests are co-located with their source files and run in a jsdom environment. The setup provides jest-dom DOM matchers and a `matchMedia` polyfill for theme-related tests.

## Requirements

### Requirement: Vitest is configured as test runner

The system SHALL provide a `vitest.config.ts` file separate from `vite.config.ts`. The Vitest config SHALL use `jsdom` as the test environment, include `@testing-library/jest-dom` matchers via a setup file, and discover tests matching `src/**/*.{test,spec}.{ts,tsx}`. The `VitePWA` plugin MUST NOT be included in the Vitest config.

#### Scenario: Test runner discovers co-located tests
- **WHEN** `vitest` is run
- **THEN** it discovers `*.test.ts` and `*.spec.tsx` files inside `src/` recursively

#### Scenario: Tests run in jsdom environment
- **WHEN** a test file executes
- **THEN** the environment provides `window`, `document`, and browser APIs via jsdom

#### Scenario: jest-dom matchers are available
- **WHEN** a test uses `toBeInTheDocument()`, `toHaveTextContent()`, or similar jest-dom matchers
- **THEN** the matchers are available without additional imports (from setup file)

### Requirement: Component testing libraries are available

The system SHALL provide `@testing-library/react`, `@testing-library/jest-dom`, and `@testing-library/user-event` as devDependencies. These SHALL be importable in test files for rendering React components, querying the DOM, and simulating user interactions.

#### Scenario: React component renders in test
- **WHEN** a test imports `render` from `@testing-library/react`
- **AND** renders a React component
- **THEN** the component is rendered in the jsdom environment

#### Scenario: User interactions are simulated
- **WHEN** a test imports `userEvent` from `@testing-library/user-event`
- **AND** simulates a click or keyboard event
- **THEN** the event fires on the target element

### Requirement: Test scripts are defined

The root-level `apps/web/package.json` SHALL define two test scripts: `"test"` runs `vitest` (watch mode by default), and `"test:run"` runs `vitest run` (single run, CI-friendly).

#### Scenario: Dev runs tests in watch mode
- **WHEN** `npm run test` is executed in `apps/web`
- **THEN** vitest starts in watch mode, re-running on file changes

#### Scenario: CI runs tests once
- **WHEN** `npm run test:run` is executed in `apps/web`
- **THEN** vitest runs all tests once and exits with appropriate exit code

### Requirement: Test setup file exists

A setup file at `src/test/setup.ts` SHALL import `@testing-library/jest-dom` to register DOM matchers globally. The file path SHALL be referenced in `vitest.config.ts` under `test.setupFiles`.

#### Scenario: Setup file imports jest-dom
- **WHEN** a test file is loaded
- **THEN** the setup file executes before any test
- **AND** jest-dom matchers are registered

### Requirement: Co-located tests follow convention

Test files SHALL be placed adjacent to their source files with the `.test.ts` or `.test.tsx` suffix. For example, `src/components/foo.tsx` has its test at `src/components/foo.test.tsx`. No centralized `__tests__/` directory SHALL be used.

#### Scenario: Test file exists next to source
- **WHEN** `src/components/theme-provider.tsx` exists
- **THEN** its test file is at `src/components/theme-provider.test.tsx` (if created)

### Requirement: matchMedia polyfill is available in tests

The test setup file SHALL provide a `window.matchMedia` polyfill since jsdom does not implement it. This enables components that query `prefers-color-scheme` (like `ThemeProvider`) to render without errors.

#### Scenario: ThemeProvider renders without matchMedia error
- **WHEN** a test renders `ThemeProvider` with default theme `"system"`
- **THEN** no `TypeError: window.matchMedia is not a function` error is thrown