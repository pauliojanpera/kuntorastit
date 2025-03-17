#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const args = process.argv.slice(2);
const noOverwrite = args.includes('--no-overwrite');

const TARGET_DIR = 'public/data';
const TARGET_FILE = path.join(TARGET_DIR, 'events.json');

const CURRENT_YEAR = new Date().getFullYear();
const START_DATE = `${CURRENT_YEAR}-01-01T00:00:00Z`;
const END_DATE = `${CURRENT_YEAR}-12-31T23:59:59Z`;
const API_URL = `https://www.rastilippu.fi/api/events/search/?topLeftLat=70.190068&topLeftLon=19.640624&bottomRightLat=59.741636&bottomRightLon=31.769532&dateTimeRangeStart=${START_DATE}&dateTimeRangeEnd=${END_DATE}&size=9999`;

async function fetchAndUpdateEvents() {
  try {
    const fileExists = await fs.access(TARGET_FILE).then(() => true).catch(() => false);
    if (noOverwrite && fileExists) {
      console.log('events.json already exists and --no-overwrite is set, skipping fetch');
      return;
    }

    await fs.mkdir(TARGET_DIR, { recursive: true });

    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const eventsData = await response.json();

    const updatedData = {
      lastUpdated: new Date().toISOString(),
      events: eventsData
    };

    await fs.writeFile(TARGET_FILE, JSON.stringify(updatedData, null, 2), 'utf8');
    console.log('Successfully updated events.json with timestamp');
  } catch (error) {
    console.error('Error fetching or writing events data:', error);
    process.exit(1);
  }
}

fetchAndUpdateEvents();