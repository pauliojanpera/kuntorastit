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
  areaId: 1,
  calendarType: 'all',
  competitionOpen: 'ALL'
};

// Simple UUID generator for events
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Convert date string (e.g., "01.05.2025 17:00") to epoch milliseconds
function parseDateToEpoch(dateStr) {
  const [day, month, year, time] = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s(\d{2}:\d{2})/).slice(1);
  return new Date(`${year}-${month}-${day}T${time}:00Z`).getTime();
}

async function getSessionAndToken() {
  try {
    const response = await fetch(REFERER_URL, { headers: HEADERS });
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

    let eventsData, markersData;

    // Check for cached events and markers
    const eventsCacheExists = await fs.access(EVENTS_CACHE_FILE).then(() => true).catch(() => false);
    const markersCacheExists = await fs.access(MARKERS_CACHE_FILE).then(() => true).catch(() => false);

    if (useCache && eventsCacheExists && markersCacheExists) {
      console.log('Using cached responses from', EVENTS_CACHE_FILE, 'and', MARKERS_CACHE_FILE);
      eventsData = JSON.parse(await fs.readFile(EVENTS_CACHE_FILE, 'utf8'));
      markersData = JSON.parse(await fs.readFile(MARKERS_CACHE_FILE, 'utf8'));
    } else {
      await fs.mkdir(CACHE_DIR, { recursive: true });

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
      const eventsResponse = await fetch(EVENTS_API_URL, fetchOptions);
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
      const markersResponse = await fetch(MARKERS_API_URL, fetchOptions);
      if (!markersResponse.ok) {
        throw new Error(`Failed to fetch markers: ${markersResponse.status}`);
      }
      markersData = await markersResponse.json();
      if (saveCache) {
        await fs.writeFile(MARKERS_CACHE_FILE, JSON.stringify(markersData, null, 2), 'utf8');
        console.log('Cached markers response to', MARKERS_CACHE_FILE);
      }
    }

    // Reconcile data
    const markerIds = new Set(markersData.map(marker => marker.id));
    const reconciledEvents = eventsData
      .filter(event => markerIds.has(event.id))
      .map(event => {
        const marker = markersData.find(m => m.id === event.id);
        return {
          disciplines: event.disciplines ? [...new Set(event.disciplines.split(','))] : [],
          event: {
            eventId: event.id,
            name: event.name,
            sports: [],
            organizerId: null,
            organizerName: marker.clubs ? marker.clubs.join(', ') : null,
            startDateTime: parseDateToEpoch(event.startTime),
            endDateTime: parseDateToEpoch(event.endTime),
            currentAttendeeCount: 0,
            maxAttendeeCount: 10000,
            locationAddress: marker.address,
            locationDescription: marker.description || null,
            locationCoordinates: {
              lat: marker.latitude,
              lon: marker.longitude
            },
            uuid: generateUUID(),
            priceInCents: 500,
            productDiscounts: [],
            purpose: 'SPORTS',
            parentSeriesEventId: event.seriesId || null,
            parentSeriesEventUuid: null,
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