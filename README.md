# Kuntorastit

A web-based tool for browsing orienteering events, built with TypeScript and modern web standards. Features dynamic data fetching, filtering, offline support via a service worker, and automated deployment via GitHub Actions.

## Purpose and Functionality
Fetches event data from `rastilippu.fi`, displays it in a filterable table, and supports offline access after initial load.

## User Instructions
- **Online Access**: [Live URL](https://pauliojanpera.github.io/kuntorastit/).
- **Usage**: Filter events by date, name, or organizer; click rows to expand details.
- **Offline Mode**: Works after initial load due to service worker caching.

## Local Execution
- **Prerequisites**: Node.js (v16+), pnpm (`npm install -g pnpm`).
- **Steps**:
  1. Clone: `git clone <repository-url>` && `cd kuntorastit`.
  2. Install: `pnpm install`.
  3. Build: `pnpm run build`.
  4. Serve: `pnpm start` → visit `http://localhost:8080`.

## License
MIT License.