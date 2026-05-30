<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/exstudeo-111827?style=for-the-badge&logo=bookstack&logoColor=white">
    <img alt="Exstudeo" src="https://img.shields.io/badge/exstudeo-fafafa?style=for-the-badge&logo=bookstack&logoColor=black">
  </picture>
</p>

<h3 align="center">Read. Offline. Anywhere.</h3>

<p align="center">
  A beautiful, offline-first EPUB reader that runs in your browser.<br/>
  Drag in your books, browse your library, and start reading — no accounts, no servers, no compromises.
</p>

<p align="center">
  <a href="#quick-start"><strong>Quick Start</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#architecture"><strong>Architecture</strong></a> ·
  <a href="#roadmap"><strong>Roadmap</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/typescript-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/react-19-61DAFB?style=flat&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/vite-7-646CFF?style=flat&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/tailwind_css-4-06B6D4?style=flat&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/pwa-ready-5A0FC8?style=flat&logo=pwa&logoColor=white" alt="PWA" />
</p>

---

## Why Exstudeo?

Most EPUB readers are either bloated desktop apps or cloud services that hold your library hostage. **Exstudeo** is different — it's a fully self-contained web app. Your books stay on your device, served from your local filesystem through a lightweight virtual file layer. The entire app works offline after the first visit, thanks to a carefully crafted service worker.

> **ex·stu·de·o** *(Latin)* — "I study thoroughly, I am eager, I strive."

<br/>

## Features

<table>
  <tr>
    <td width="50%">
      <h4>📚 EPUB Reading, Done Right</h4>
      <p>Full EPUB 2 &amp; 3 support with a responsive two-column layout: collapsible table-of-contents sidebar on the left, beautifully typeset content on the right. The sidebar automatically tracks your reading position as you navigate.</p>
    </td>
    <td width="50%">
      <h4>📂 Locally Stored Library</h4>
      <p> The Library is stored on your own machine with File System Access API. Your Data is safe and can easily work with any backup/sync service.</p>
    </td>
  </tr>
  <tr>
    <td>
      <h4>🌐 Works Offline</h4>
      <p>A Progressive Web App with a service worker that pre-caches the entire application shell. Once loaded, you can read anywhere — on the subway, in a plane, or deep in the woods.</p>
    </td>
    <td>
      <h4>🎨 Dark Mode &amp; Reading Typography</h4>
      <p>Respects your system theme with a polished dark mode. Reading content is set in a comfortable serif face at a generous line-height, optimized for long-form reading sessions.</p>
    </td>
  </tr>
  <tr>
    <td>
      <h4>🔒 Privacy First</h4>
      <p>Zero telemetry. Zero accounts. Your books never leave your device. All file access goes through the browser's File System Access API — you control exactly what folders are mounted.</p>
    </td>
    <td>
      <h4>🧩 Sanitized &amp; Safe Content</h4>
      <p>Every EPUB page passes through an HTML rewrite pipeline in the service worker that strips scripts, inline styles, and event handlers before the page reaches your eyes. Publisher cruft is gone; only clean, readable content remains.</p>
    </td>
  </tr>
</table>

<br/>

## Quick Start

Visit [<kbd>https://exstudeo.github.io/</kbd>](https://exstudeo.github.io/)

## Architecture

Exstudeo is a monorepo powered by **Turborepo** with two workspaces:

```
┌─────────────────────────────────────────────┐
│                  Browser                     │
│  ┌──────────────┐    ┌───────────────────┐   │
│  │  React 19    │    │  Service Worker   │   │
│  │  (app shell) │◄──►│  (offline + EPUB) │   │
│  └──────┬───────┘    └────────┬──────────┘   │
│         │                     │              │
│  ┌──────▼──────────────────────▼──────────┐  │
│  │           ZenFS Virtual FS             │  │
│  │    (POSIX API over FSA handles)        │  │
│  └──────┬─────────────────────────────────┘  │
│         │                                    │
│  ┌──────▼──────┐                             │
│  │  IndexedDB  │  (mount persistence)        │
│  └─────────────┘                             │
└─────────────────────────────────────────────┘
```

| Layer | Technology | Role |
|-------|-----------|------|
| **App Shell** | React 19 + React Router v7 + shadcn/ui | Tabbed UI with file explorer & reader |
| **Styling** | Tailwind CSS 4 + base-nova theme | Dark/light system, semantic tokens, RTL |
| **Service Worker** | Workbox + injectManifest | Offline precaching, three-tier routing, EPUB HTML rewrite |
| **Virtual FS** | ZenFS (`@zenfs/core` + `@zenfs/dom`) | POSIX filesystem over File System Access API |
| **Build** | Vite 7 + TypeScript 5.9 strict | Multi-entry builds, PWA manifest auto-generation |
| **Testing** | Vitest + React Testing Library + jsdom | Co-located tests, CI-ready |
| **Monorepo** | Turborepo + npm workspaces | Orchestrated build, lint, typecheck |

### The EPUB Pipeline

When you open an EPUB book:

1. **Upload-time parsing** — the book's spine, table of contents, and sidebar HTML are extracted & persisted
2. **SW interception** — requests to `/@epubs/` are routed through the service worker
3. **HTML Rewrite** — a streaming WASM-based pipeline sanitizes each page (strips scripts, injects viewer CSS & JS)
4. **Client-side viewer** — the injected script builds the sidebar, rewrites navigation links, and tracks reading position

<br/>



## Roadmap

- [ ] Markdown note reading & editing
- [ ] Full-text search across your library
- [ ] Knowledge graph linking notes & books
- [ ] Plugin system for custom format support
- [ ] Sync backend (optional, self-hosted)

<br/>

---

<p align="center">
  <sub>Built with ❤️ using TypeScript, React, and the open web.</sub>
</p>

