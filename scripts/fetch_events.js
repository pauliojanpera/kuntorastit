#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

const args = process.argv.slice(2);
const noOverwrite = args.includes('--no-overwrite');
const useCache = args.includes('--use-cache');
const saveCache = args.includes('--save-cache');

const TARGET_DIR = 'public/data';
const CACHE_DIR = 'cache';
const TARGET_FILE = path.join(TARGET_DIR, 'events.json');
const EVENTS_CACHE_FILE = path.join(CACHE_DIR, 'events.json');
const MARKERS_CACHE_FILE = path.join(CACHE_DIR, 'markers.json');

const CURRENT_YEAR = new Date().getFullYear();
const IRMA_BASE = 'https://irma.suunnistusliitto.fi';
const CALENDAR_PAGE = `${IRMA_BASE}/public/competitioncalendar/list?year=${CURRENT_YEAR}&area=all&tab=map&type=competition_event`;
const LIST_EVENTS_URL = `${IRMA_BASE}/connect/CompetitionCalendarEndpoint/listEvents`;
const LIST_MARKERS_URL = `${IRMA_BASE}/connect/CompetitionCalendarEndpoint/listMarkers`;

const FETCH_INTERVAL_MS = 2000;
let lastFetchTime = 0;

async function rateLimitedFetch(url, options) {
  const elapsed = Date.now() - lastFetchTime;
  if (elapsed < FETCH_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, FETCH_INTERVAL_MS - elapsed));
  }
  lastFetchTime = Date.now();
  return fetch(url, options);
}

// "DD.MM.YYYY HH:mm" → milliseconds
// Finnish clock time stored as-is (treated as UTC) so the frontend displays it correctly.
function parseIrmaDate(str) {
  if (!str) return null;
  const spaceIdx = str.indexOf(' ');
  if (spaceIdx === -1) return null;
  const [day, month, year] = str.slice(0, spaceIdx).split('.');
  const [hour, minute] = str.slice(spaceIdx + 1).split(':');
  return Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
}

// Merge listEvents base data with richer listMarkers data (when available).
function mergeEvent(ev, marker) {
  const disciplines = marker?.disciplines || ev.disciplines || '';
  return {
    id: ev.id,
    name: ev.name,
    seriesName: ev.seriesName,
    startTime: ev.startTime,
    endTime: ev.endTime,
    clubs: marker?.clubs || [],
    latitude: marker?.latitude ?? 0.0,
    longitude: marker?.longitude ?? 0.0,
    description: marker?.description || null,
    address: marker?.address || null,
    orienteering: marker?.orienteering || disciplines.split(',').map(d => d.trim()).filter(Boolean),
    additionalInfo: marker?.additionalInfo || null,
  };
}

function irmaToEvent(e) {
  const hasCoords = e.latitude !== 0.0 || e.longitude !== 0.0;
  const locationParts = [e.description, e.address].filter(s => s && s.trim());
  return {
    disciplines: e.orienteering,
    event: {
      eventId: String(e.id),
      name: (e.name || '').trim(),
      organizerName: e.clubs?.[0] || e.seriesName || '',
      organizerClubs: e.clubs,
      startDateTime: parseIrmaDate(e.startTime),
      endDateTime: parseIrmaDate(e.endTime),
      locationDescription: locationParts.join('\n') || null,
      locationCoordinates: hasCoords ? { lat: e.latitude, lon: e.longitude } : null,
    },
    serviceAvailable: false,
  };
}

async function getSessionAndCsrf() {
  const response = await rateLimitedFetch(CALENDAR_PAGE, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
    redirect: 'follow',
  });

  if (!response.ok) throw new Error(`Session GET failed: ${response.status}`);

  let jsessionId = null;
  const setCookies = response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie')].filter(Boolean);
  for (const cookie of setCookies) {
    const m = cookie.match(/JSESSIONID=([^;]+)/);
    if (m) jsessionId = m[1];
  }

  const html = await response.text();
  const dom = new JSDOM(html);
  const csrfToken = dom.window.document.querySelector('meta[name="_csrf"]')?.getAttribute('content');

  if (!jsessionId) throw new Error('Could not establish session (no JSESSIONID cookie)');
  if (!csrfToken) throw new Error('Could not extract CSRF token from IRMA page');

  return { jsessionId, csrfToken };
}

async function fetchAllMonths(url, bodyFn, headers, label) {
  const seenIds = new Set();
  const result = [];
  for (let month = 1; month <= 12; month++) {
    const response = await rateLimitedFetch(url, {
      method: 'POST',
      headers: { ...headers, Referer: `${CALENDAR_PAGE}&month=${month}` },
      body: JSON.stringify(bodyFn(month)),
    });
    if (!response.ok) throw new Error(`${label} month ${month} failed: ${response.status}`);
    const data = await response.json();
    let added = 0;
    for (const e of data) {
      if (!seenIds.has(e.id)) {
        seenIds.add(e.id);
        result.push(e);
        added++;
      }
    }
    console.log(`  ${label} month ${month}: ${added} new`);
  }
  return result;
}

async function fetchAndUpdateEvents() {
  try {
    const fileExists = await fs.access(TARGET_FILE).then(() => true).catch(() => false);
    if (noOverwrite && fileExists) {
      console.log('events.json already exists and --no-overwrite is set, skipping fetch');
      return;
    }

    await fs.mkdir(TARGET_DIR, { recursive: true });
    await fs.mkdir(CACHE_DIR, { recursive: true });

    let eventsData, markersData;

    const eventsCacheExists = await fs.access(EVENTS_CACHE_FILE).then(() => true).catch(() => false);
    const markersCacheExists = await fs.access(MARKERS_CACHE_FILE).then(() => true).catch(() => false);

    if (useCache && eventsCacheExists && markersCacheExists) {
      console.log('Using cached data from', CACHE_DIR);
      eventsData = JSON.parse(await fs.readFile(EVENTS_CACHE_FILE, 'utf8'));
      markersData = JSON.parse(await fs.readFile(MARKERS_CACHE_FILE, 'utf8'));
    } else {
      console.log('Establishing IRMA session...');
      const { jsessionId, csrfToken } = await getSessionAndCsrf();

      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Cookie: `JSESSIONID=${jsessionId}`,
        'X-CSRF-TOKEN': csrfToken,
        Origin: IRMA_BASE,
      };

      console.log(`Fetching listEvents for ${CURRENT_YEAR}...`);
      eventsData = await fetchAllMonths(
        LIST_EVENTS_URL,
        month => ({
          year: CURRENT_YEAR,
          month: String(month),
          upcoming: 'ONE_YEAR',
          disciplines: [],
          userId: null,
          calendarType: 'all',
          competitionOpen: 'ALL',
          areaId: null,
          previousDays: null,
          selfService: false,
        }),
        headers,
        'events',
      );

      console.log(`Fetching listMarkers for ${CURRENT_YEAR}...`);
      markersData = await fetchAllMonths(
        LIST_MARKERS_URL,
        month => ({
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
        headers,
        'markers',
      );

      if (saveCache) {
        await fs.writeFile(EVENTS_CACHE_FILE, JSON.stringify(eventsData, null, 2), 'utf8');
        await fs.writeFile(MARKERS_CACHE_FILE, JSON.stringify(markersData, null, 2), 'utf8');
        console.log('Cached to', CACHE_DIR);
      }
    }

    // Build marker lookup by id
    const markerById = new Map(markersData.map(m => [m.id, m]));

    // Only series events (not standalone competitions)
    const events = eventsData
      .filter(e => e.seriesId != null)
      .map(e => irmaToEvent(mergeEvent(e, markerById.get(e.id))))
      .sort((a, b) => a.event.startDateTime - b.event.startDateTime);

    const onlyInEvents = eventsData.filter(e => e.seriesId != null && !markerById.has(e.id)).length;
    if (onlyInEvents > 0) console.log(`${onlyInEvents} events enriched from listEvents only (no marker)`);

    await fs.writeFile(TARGET_FILE, JSON.stringify({ lastUpdated: new Date().toISOString(), events }, null, 2), 'utf8');
    console.log(`Successfully updated events.json with ${events.length} events`);
  } catch (error) {
    console.error('Error fetching or writing events data:', error);
    process.exit(1);
  }
}

fetchAndUpdateEvents();
