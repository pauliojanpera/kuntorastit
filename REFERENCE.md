# Technical Reference: Kuntorastit
*Date: March 11, 2025*

## Overview
A TypeScript app for displaying orienteering events with real-time filtering and offline capability via a service worker.

## Core Components
- `src/kuntorastit.mts`: Main logic for data loading, filtering, and UI rendering.
- `src/service-worker.mts`: Caches assets for offline use.
- `public/index.html`: Entry point with styles.
- `public/data/events.json`: Event data fetched from `rastilippu.fi`.

## Implementation Details
- **Service Worker**: Registers at `/kuntorastit/service-worker.js`, caches key assets with UUID-based naming.
- **Cache Busting**: UUID injected via `postbuild.js` ensures fresh content per deployment.
- **Data Handling**: Fetches JSON, filters events by date/name/organizer, renders expandable rows.

## Build Process
- `pnpm run build`: Compiles TypeScript, applies aliases, runs `postbuild.js` for cache versioning.