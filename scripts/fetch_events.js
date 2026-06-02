#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const args = process.argv.slice(2);
const noOverwrite = args.includes('--no-overwrite');

const TARGET_DIR = 'public/data';
const TARGET_FILE = path.join(TARGET_DIR, 'events.json');
const CURRENT_YEAR = new Date().getFullYear();

const IRMA_BASE = 'https://irma.suunnistusliitto.fi';
const CALENDAR_PAGE = `${IRMA_BASE}/public/competitioncalendar/list?year=${CURRENT_YEAR}&area=all&tab=map&type=competition_event`;
const LIST_MARKERS_URL = `${IRMA_BASE}/connect/CompetitionCalendarEndpoint/listMarkers`;

// "DD.MM.YYYY HH:mm" → milliseconds
// Finnish clock time is stored as-is (treated as UTC) so the frontend displays it correctly.
function parseIrmaDate(str) {
  if (!str) return null;
  const spaceIdx = str.indexOf(' ');
  if (spaceIdx === -1) return null;
  const [day, month, year] = str.slice(0, spaceIdx).split('.');
  const [hour, minute] = str.slice(spaceIdx + 1).split(':');
  return Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
}

function irmaToEvent(e) {
  const hasCoords = e.latitude !== 0.0 || e.longitude !== 0.0;
  const locationParts = [e.description, e.address].filter(s => s && s.trim());
  return {
    disciplines: e.orienteering || [],
    event: {
      eventId: String(e.id),
      name: (e.name || '').trim(),
      organizerName: e.clubs?.[0] || e.seriesName || '',
      organizerClubs: e.clubs || [],
      startDateTime: parseIrmaDate(e.startTime),
      endDateTime: parseIrmaDate(e.endTime),
      locationDescription: locationParts.join('\n') || null,
      locationCoordinates: hasCoords ? { lat: e.latitude, lon: e.longitude } : null,
    },
    serviceAvailable: false,
  };
}

async function getSessionAndCsrf() {
  const response = await fetch(CALENDAR_PAGE, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
    redirect: 'follow',
  });

  if (!response.ok) throw new Error(`Session GET failed: ${response.status}`);

  let jsessionId = null;
  let csrfToken = null;

  // node-fetch v3: getSetCookie() returns all Set-Cookie header values
  const setCookies = response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie')].filter(Boolean);
  for (const cookie of setCookies) {
    const m = cookie.match(/JSESSIONID=([^;]+)/);
    if (m) jsessionId = m[1];
    const x = cookie.match(/XSRF-TOKEN=([^;]+)/);
    if (x) csrfToken = decodeURIComponent(x[1]);
  }

  if (!csrfToken) {
    const html = await response.text();
    const m = html.match(/["']_csrf["'][^>]*content=["']([^"']+)["']|content=["']([^"']+)["'][^>]*["']_csrf["']/);
    if (m) csrfToken = m[1] || m[2];
    if (!csrfToken) {
      const m2 = html.match(/X-CSRF-TOKEN["']\s*:\s*["']([^"']+)["']/);
      if (m2) csrfToken = m2[1];
    }
  }

  if (!jsessionId) throw new Error('Could not establish session (no JSESSIONID cookie)');
  if (!csrfToken) throw new Error('Could not extract CSRF token from IRMA page');

  return { jsessionId, csrfToken };
}

async function fetchAndUpdateEvents() {
  try {
    const fileExists = await fs.access(TARGET_FILE).then(() => true).catch(() => false);
    if (noOverwrite && fileExists) {
      console.log('events.json already exists and --no-overwrite is set, skipping fetch');
      return;
    }

    await fs.mkdir(TARGET_DIR, { recursive: true });

    console.log('Establishing IRMA session...');
    const { jsessionId, csrfToken } = await getSessionAndCsrf();

    console.log(`Fetching all months for ${CURRENT_YEAR}...`);
    const seenIds = new Set();
    const allIrmaEvents = [];

    for (let month = 1; month <= 12; month++) {
      const response = await fetch(LIST_MARKERS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Cookie: `JSESSIONID=${jsessionId}`,
          'X-CSRF-TOKEN': csrfToken,
          Origin: IRMA_BASE,
          Referer: `${CALENDAR_PAGE}&month=${month}`,
        },
        body: JSON.stringify({
          type: 'competition_event',
          year: CURRENT_YEAR,
          month: String(month),
          upcoming: 'ONE_YEAR',
          disciplines: [],
          areaId: null,
          calendarType: 'all',
          competitionOpen: 'ALL',
          currentDay: null,
        }),
      });

      if (!response.ok) throw new Error(`Month ${month} request failed: ${response.status}`);

      const monthEvents = await response.json();
      let added = 0;
      for (const e of monthEvents) {
        if (e.type === 'event' && !seenIds.has(e.id)) {
          seenIds.add(e.id);
          allIrmaEvents.push(e);
          added++;
        }
      }
      console.log(`  Month ${month}: ${added} new events`);
    }

    const events = allIrmaEvents
      .map(irmaToEvent)
      .sort((a, b) => a.event.startDateTime - b.event.startDateTime);

    const updatedData = {
      lastUpdated: new Date().toISOString(),
      events,
    };

    await fs.writeFile(TARGET_FILE, JSON.stringify(updatedData, null, 2), 'utf8');
    console.log(`Successfully updated events.json with ${events.length} events`);
  } catch (error) {
    console.error('Error fetching or writing events data:', error);
    process.exit(1);
  }
}

fetchAndUpdateEvents();
