# Kuntorastit

A web-based tool for browsing orienteering events, built with TypeScript and modern web technologies. Features include dynamic event data fetching from `rastilippu.fi`, real-time filtering, offline support via a service worker, and automated deployment using GitHub Actions.

## Purpose and Functionality
Kuntorastit fetches orienteering event data from `rastilippu.fi`, presents it in a filterable and expandable table, and provides offline access after the initial load through service worker caching. Users can filter events by date, name, and organizer, with additional details like location and event links available on demand.

## User Instructions
- **Online Access**: Visit [Live URL](https://pauliojanpera.github.io/kuntorastit/).
- **Usage**: 
  - Filter events by date (all, past, future), name (search term), or organizer (multi-select dropdown).
  - Click a row to view expanded details in a modal, including location, map links, and event page URLs.
- **Offline Mode**: After the initial load, the app remains functional offline due to cached assets and data.
>
## Local Execution
- **Prerequisites**: Node.js (v18+ recommended), pnpm (`npm install -g pnpm`).
- **Steps**:
  1. Clone the repository: `git clone <repository-url>` && `cd kuntorastit`.
  2. Install dependencies: `pnpm install`.
  3. Build the project: `pnpm run build`.
  4. Serve locally: `pnpm run preview` → open `http://localhost:8080` in your browser.
- **Optional**: 
  - Run in development mode: `pnpm run dev`.
  - Fetch fresh event data: `pnpm run fetch-events`.

## License
MIT License.