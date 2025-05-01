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
const EVENTS_FILE = path.join(TARGET_DIR, 'events.json');
const EVENTS_CACHE_FILE = path.join(CACHE_DIR, 'events.json');
const MARKERS_CACHE_FILE = path.join(CACHE_DIR, 'markers.json');

const REFERER_URL = 'https://irma.suunnistusliitto.fi/public/competitioncalendar/list?year=upcoming&tab=event&upcoming=ONE_YEAR';
const EVENTS_API_URL = 'https://irma.suunnistusliitto.fi/connect/CompetitionCalendarEndpoint/listEvents';
const MARKERS_API_URL = 'https://irma.suunnistusliitto.fi/connect/CompetitionCalendarEndpoint/listMarkers';
const VIEW_EVENT_API_URL = 'https://irma.suunnistusliitto.fi/connect/EventEndpoint/viewEvent';

const HEADERS = {
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.6',
  'Connection': 'keep-alive',
  'Content-Type': 'application/json',
  'Origin': 'https://irma.suunnistusliitto.fi',
  'Referer': REFERER_URL,
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-GPC': '1',
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Brave";v="134"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Linux"'
};

// Global rate limiting
let lastFetchTime = 0;
const FETCH_INTERVAL_MS = 2000; // 2 seconds

async function rateLimitedFetch(url, options) {
  // Log URL and payload
  console.log('Fetching URL:', url);
  if (options.body) {
    console.log('Payload:', JSON.stringify(JSON.parse(options.body), null, 2));
  } else {
    console.log('Payload: None');
  }

  const now = Date.now();
  const timeSinceLastFetch = now - lastFetchTime;
  if (timeSinceLastFetch < FETCH_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, FETCH_INTERVAL_MS - timeSinceLastFetch));
  }
  lastFetchTime = Date.now();
  return fetch(url, options);
}

// Convert date string (e.g., "01.05.2025 17:00") to epoch milliseconds
function parseDateToEpoch(dateStr) {
  const [day, month, year, time] = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s(\d{2}:\d{2})/).slice(1);
  return new Date(`${year}-${month}-${day}T${time}:00Z`).getTime();
}

// Convert priceRange (e.g., "7.00 €") to priceInCents (e.g., 700)
function parsePriceToCents(priceRange) {
  if (!priceRange) return 500; // Default from previous logic
  const match = priceRange.match(/(\d+\.\d{2})/);
  return match ? parseFloat(match[1]) * 100 : 500;
}

const EVENTS_PAYLOAD = {
  year: null,
  month: '1',
  upcoming: 'ONE_YEAR',
  disciplines: [],
  userId: null,
  calendarType: 'all',
  competitionOpen: 'ALL'
};

const MARKERS_PAYLOAD = {
  type: 'all',
  year: null,
  month: '1',
  upcoming: 'ONE_YEAR',
  disciplines: [],
  areaId: null,
  calendarType: 'all',
  competitionOpen: 'ALL'
};

async function getSessionAndToken() {
  try {
    const response = await rateLimitedFetch(REFERER_URL, { headers: HEADERS });
    if (!response.ok) {
      throw new Error(`Failed to fetch referer page: ${response.status}`);
    }

    const cookies = response.headers.get('set-cookie') || '';
    const jsessionidMatch = cookies.match(/JSESSIONID=([^;]+)/);
    const jsessionid = jsessionidMatch ? jsessionidMatch[1] : null;

    if (!jsessionid) {
      throw new Error('JSESSIONID not found in cookies');
    }

    const html = await response.text();
    const dom = new JSDOM(html);
    const csrfToken = dom.window.document.querySelector('meta[name="_csrf"]')?.getAttribute('content');

    if (!csrfToken) {
      throw new Error('X-CSRF-TOKEN not found in meta tags');
    }

    return { jsessionid, csrfToken };
  } catch (error) {
    console.error('Error fetching JSESSIONID or X-CSRF-TOKEN:', error);
    throw error;
  }
}

async function fetchAndUpdateData() {
  try {
    const fileExists = await fs.access(EVENTS_FILE).then(() => true).catch(() => false);
    if (noOverwrite && fileExists) {
      console.log('events.json already exists and --no-overwrite is set, skipping fetch');
      return;
    }

    await fs.mkdir(TARGET_DIR, { recursive: true });
    await fs.mkdir(CACHE_DIR, { recursive: true });

    let eventsData, markersData;
    const viewEventCache = new Map(); // In-memory cache for viewEvent results by seriesId

    // Check for cached events and markers
    const eventsCacheExists = await fs.access(EVENTS_CACHE_FILE).then(() => true).catch(() => false);
    const markersCacheExists = await fs.access(MARKERS_CACHE_FILE).then(() => true).catch(() => false);

    if (useCache && eventsCacheExists && markersCacheExists) {
      console.log('Using cached responses from', EVENTS_CACHE_FILE, 'and', MARKERS_CACHE_FILE);
      eventsData = JSON.parse(await fs.readFile(EVENTS_CACHE_FILE, 'utf8'));
      markersData = JSON.parse(await fs.readFile(MARKERS_CACHE_FILE, 'utf8'));

      // Load cached viewEvent results
      const viewEventCacheFiles = await fs.readdir(CACHE_DIR);
      for (const file of viewEventCacheFiles) {
        if (file.startsWith('view_event_') && file.endsWith('.json')) {
          const seriesId = file.match(/view_event_(\d+)\.json/)?.[1];
          if (seriesId) {
            const data = JSON.parse(await fs.readFile(path.join(CACHE_DIR, file), 'utf8'));
            viewEventCache.set(parseInt(seriesId), data);
          }
        }
      }
    } else {
      // Fetch session and token
      const { jsessionid, csrfToken } = await getSessionAndToken();

      const cookieHeader = `JSESSIONID=${jsessionid}`;
      const fetchOptions = {
        method: 'POST',
        headers: {
          ...HEADERS,
          'X-CSRF-TOKEN': csrfToken,
          'Cookie': cookieHeader
        },
        body: JSON.stringify(EVENTS_PAYLOAD)
      };

      // Fetch events
      const eventsResponse = await rateLimitedFetch(EVENTS_API_URL, fetchOptions);
      if (!eventsResponse.ok) {
        throw new Error(`Failed to fetch events: ${eventsResponse.status}`);
      }
      eventsData = await eventsResponse.json();
      if (saveCache) {
        await fs.writeFile(EVENTS_CACHE_FILE, JSON.stringify(eventsData, null, 2), 'utf8');
        console.log('Cached events response to', EVENTS_CACHE_FILE);
      }

      // Fetch markers
      fetchOptions.body = JSON.stringify(MARKERS_PAYLOAD);
      const markersResponse = await rateLimitedFetch(MARKERS_API_URL, fetchOptions);
      if (!markersResponse.ok) {
        throw new Error(`Failed to fetch markers: ${markersResponse.status}`);
      }
      markersData = await markersResponse.json();
      if (saveCache) {
        await fs.writeFile(MARKERS_CACHE_FILE, JSON.stringify(markersData, null, 2), 'utf8');
        console.log('Cached markers response to', MARKERS_CACHE_FILE);
      }

      // Fetch viewEvent for events without markers
      const markerIds = new Set(markersData.map(marker => marker.id));
      const eventsNeedingViewEvent = eventsData.filter(event => !markerIds.has(event.id));

      // Group events by seriesId to minimize viewEvent requests
      const seriesToEvents = new Map();
      for (const event of eventsNeedingViewEvent) {
        const seriesId = event.seriesId || event.id; // Fallback to event.id if no series
        if (!seriesToEvents.has(seriesId)) {
          seriesToEvents.set(seriesId, []);
        }
        seriesToEvents.get(seriesId).push(event);
      }

      // Fetch viewEvent for each series
      for (const [seriesId, events] of seriesToEvents) {
        const eventId = events[0].id; // Use the first event's ID
        if (!viewEventCache.has(seriesId)) {
          fetchOptions.body = JSON.stringify({ eventId, lang: 'fi' });
          const viewEventResponse = await rateLimitedFetch(VIEW_EVENT_API_URL, fetchOptions);
          if (!viewEventResponse.ok) {
            console.warn(`Failed to fetch viewEvent for eventId ${eventId}: ${viewEventResponse.status}`);
            continue;
          }
          const viewEventData = await viewEventResponse.json();
          viewEventCache.set(seriesId, viewEventData);
          if (saveCache) {
            await fs.writeFile(path.join(CACHE_DIR, `view_event_${seriesId}.json`), JSON.stringify(viewEventData, null, 2), 'utf8');
            console.log(`Cached viewEvent response for seriesId ${seriesId} to`, `view_event_${seriesId}.json`);
          }
        }
      }
    }

    // Reconcile data
    const markerIds = new Set(markersData.map(marker => marker.id));
    const reconciledEvents = eventsData.map(event => {
      const marker = markersData.find(m => m.id === event.id);
      let sourceData = marker;

      // If no marker, use viewEvent data
      if (!marker) {
        const seriesId = event.seriesId || event.id;
        const viewEventData = viewEventCache.get(seriesId);
        if (viewEventData) {
          // Check main event or otherEvents
          sourceData = viewEventData.id === event.id ? viewEventData : viewEventData.otherEvents?.find(e => e.id === event.id);
        }
      }

      return {
        disciplines: event.disciplines ? [...new Set(event.disciplines.split(','))] : [],
        event: {
          eventId: event.id,
          name: event.name,
          sports: [],
          organizerName: sourceData?.clubs ? sourceData.clubs.join(', ') : null,
          startDateTime: parseDateToEpoch(event.startTime),
          endDateTime: parseDateToEpoch(event.endTime),
          currentAttendeeCount: 0,
          maxAttendeeCount: 10000,
          locationAddress: sourceData?.address || null,
          locationDescription: sourceData?.description || null,
          locationCoordinates: {
            lat: sourceData?.latitude || 0.0,
            lon: sourceData?.longitude || 0.0
          },
          priceInCents: sourceData?.priceRange ? parsePriceToCents(sourceData.priceRange) : 0,
          productDiscounts: [],
          purpose: 'SPORTS',
          parentSeriesEventId: event.seriesId || null,
          parentSeriesEventName: event.seriesName || null
        },
        serviceAvailable: false
      };
    });

    // Save reconciled data with lastUpdated timestamp
    const updatedData = {
      lastUpdated: new Date().toISOString(),
      events: reconciledEvents
    };

    await fs.writeFile(EVENTS_FILE, JSON.stringify(updatedData, null, 2), 'utf8');
    console.log('Successfully updated events.json with reconciled data');
  } catch (error) {
    console.error('Error fetching or writing data:', error);
    process.exit(1);
  }
}

fetchAndUpdateData();