## ADDED Requirements

### Requirement: App uses tabbed layout
The system SHALL render the application as a tabbed interface using React Router for URL-driven tab selection and shadcn `Tabs` for the visual tab bar.

#### Scenario: Render tab bar
- **WHEN** the app loads
- **THEN** a tab bar is displayed at the top with a "Files" tab selected by default

#### Scenario: URL drives active tab
- **WHEN** the user navigates to `/files`
- **THEN** the "Files" tab is active and its content panel is displayed

#### Scenario: Tab click updates URL
- **WHEN** the user clicks a tab
- **THEN** the browser URL updates to the corresponding route

#### Scenario: Tab content panels
- **WHEN** a tab is active
- **THEN** the corresponding content panel is rendered below the tab bar

### Requirement: File route shows file explorer
The system SHALL render the file explorer component when the `/files` route is active.

#### Scenario: Navigate to Files tab
- **WHEN** the URL is `/files`
- **THEN** the file explorer component is rendered in the tab panel

### Requirement: Placeholder reader route
The system SHALL include a placeholder route for the reader (future feature) that renders a simple placeholder component.

#### Scenario: Navigate to reader
- **WHEN** the URL would be `/reader` (not yet linked from UI)
- **THEN** a placeholder message "Reader — coming soon" is displayed

### Requirement: Navigation is client-side
The system SHALL use client-side routing (no full-page reloads) for all tab navigation.

#### Scenario: Tab switch is instant
- **WHEN** the user switches tabs
- **THEN** only the content panel updates; there is no full-page navigation or flash