# Technical Reference: Kuntorastit
*Date: March 17, 2025*

## Overview
Kuntorastit is a TypeScript-based web application designed to display orienteering events sourced from `rastilippu.fi`. It offers real-time filtering by date, name, and organizer, offline functionality via a service worker, and a responsive UI with modal-based event details.

## Core Components
- **`src/main.ts`**: Core application logic, including data fetching, filtering, UI rendering, and event handling for modals and filters.
- **`src/style.css`**: Styles for the UI, including responsive design, table layout, and modal presentation.
- **`public/index.html`**: Entry point for the app, linking styles and scripts.
- **`public/data/events.json`**: Cached event data fetched from `rastilippu.fi`.

## Implementation Details
- **Data Fetching**: 
  - Events are retrieved from `rastilippu.fi` via `scripts/fetch_events.js`, targeting the current year’s data.
  - Stored in `public/data/events.json` with a timestamp, updated monthly via GitHub Actions.
- **Filtering**: 
  - Real-time filtering by date (`all`, `past`, `future`), name (case-insensitive search), and organizer (multi-select).
  - Filter settings persist in `localStorage`.
- **UI Rendering**: 
  - Events display in a table with expandable rows (via modal on click).
  - Location coordinates are converted from WGS84 to TM35FIN for map links.
  - Day-of-week styling enhances visual distinction.
- **Service Worker**: 
  - Managed by the `vite-plugin-pwa` plugin, which generates a service worker using Workbox based on the configuration in `vite.config.ts`.
  - Caches static assets (e.g., JS, CSS, HTML, PNG, JPG, JPEG, SVG files) and event data for offline support.
  - **Caching Strategies**:
    - For `events.json` (URL pattern: `/kuntorastit/data/events.json`):
      - Uses `StaleWhileRevalidate` strategy.
      - Cached in `events-data-cache` with a maximum of 1 entry.
      - Accepts responses with statuses `0` (opaque) and `200`.
    - For static assets (URL pattern: `\.(?:js|css|html|png|jpg|jpeg|svg)$`):
      - Uses `CacheFirst` strategy.
      - Cached in `static-assets-cache` with a maximum of 50 entries and a 30-day expiration (`maxAgeSeconds: 30 * 24 * 60 * 60`).
  - Additional assets like `icon-192.png` are precached as specified in the `includeAssets` option of the PWA configuration.
- **Cache Busting**: 
  - Vite’s build process generates hashed filenames (e.g., `assets/[name]-[hash].js`) for cache versioning.

## Build Process
- **`pnpm run build`**: 
  - Fetches event data (if not skipped with `--no-overwrite`), compiles TypeScript, bundles with Vite, and applies cache versioning.
- **Deployment**: 
  - Automated via GitHub Actions (`deploy.yml`) to GitHub Pages on `main` branch push or monthly data update.

## Dependencies
- **Runtime**: None (client-side app).
- **Development**: 
  - `node-fetch` (event fetching), `typescript`, `vite`, `vite-plugin-pwa` (offline support), `vitest` (testing).
  - See `package.json` for versions.

## Configuration
- **`tsconfig.json`**: Targets ES2020, uses ESNext modules, and enforces strict linting.
- **`vite.config.ts`**: Configures Vite with PWA plugin, custom base URL (`/kuntorastit/`), and caching strategies.

## Notes for Grok 3 (Self-Instructions for kuntorastit)
- **Recording Process**: 
  - Document the *current implementation state* and *key technical decisions* in `REFERENCE.md`.
  - Focus on: architecture (e.g., client-side TypeScript app with service worker caching), critical configurations (e.g., Vite and PWA setup, event data fetching), and actionable usage notes (e.g., build and deployment instructions).
  - Avoid exhaustive change history; only include updates that reflect the latest implementation or significant design choices (e.g., adoption of `StaleWhileRevalidate` for event data caching).
  - Update existing sections rather than appending redundant details; keep it concise to fit context limits and respect `kuntorastit`’s emphasis on simplicity and usability.
- **Format**: Use clear headings, bullet points, and minimal code snippets (only when essential for clarity, e.g., a key configuration or CLI example).
- **Scope**: Align with `kuntorastit`’s lean, user-focused ethos—prioritize practicality (e.g., how to build and run) over verbosity (e.g., no speculative features).
- **User Updates**: If the user modifies files (e.g., "I updated `main.ts`"), acknowledge and integrate their changes into the current state description in `REFERENCE.md` without duplicating their work verbatim.
- **MarkDown Formatting**: Present any MarkDown content within triple backticks (```) to ensure it is displayed in a copyable Markdown format.
  - Maintain standard Markdown syntax (e.g., `#` for headings, `-` for bullets) within the backticks for direct usability.
  - Avoid adding unnecessary commentary outside the backticks unless explicitly requested by the user.
  - Escape block quotes in the actual content (e.g., using \`\`\` or similar) as needed.