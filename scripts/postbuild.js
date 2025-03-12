#!/usr/bin/env node
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

// Base directories
const publicDir = 'public';
const kuntorastitDir = path.join(publicDir, 'kuntorastit');

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate a UUID for this build
const buildUuid = randomUUID();
const tempBuildDir = path.join(publicDir, buildUuid);
const finalBuildDir = path.join(kuntorastitDir, buildUuid);

// Rename kuntorastit to the UUID directory
if (fs.existsSync(kuntorastitDir)) {
  fs.renameSync(kuntorastitDir, tempBuildDir);
}

// Recreate kuntorastit directory
fs.mkdirSync(kuntorastitDir, { recursive: true });

// Move the UUID directory back into kuntorastit
fs.renameSync(tempBuildDir, finalBuildDir);

// Update service-worker.js and kuntorastit.mjs with UUIDs
const swInputPath = path.join(finalBuildDir, 'dist', 'service-worker.mjs');
const swOutputPath = path.join(finalBuildDir, 'service-worker.js');
const mainInputPath = path.join(finalBuildDir, 'dist', 'kuntorastit.mjs');
const indexHtmlInputPath = path.join(finalBuildDir, 'index.html');
const indexHtmlOutputPath = path.join(kuntorastitDir, 'index.html');
const updateDataYmlInputPath = './update-data.yml';
const updateDataYmlOutputPath = '.github/workflows/update-data.yml';

fs.writeFileSync(swOutputPath,
  fs.readFileSync(swInputPath, 'utf8')
    .replaceAll('$$BUILD_UUID$$', buildUuid)
    .replace(/export {};/, ''));

fs.writeFileSync(mainInputPath,
  fs.readFileSync(mainInputPath, 'utf8')
    .replaceAll('$$BUILD_UUID$$', buildUuid));

fs.writeFileSync(indexHtmlOutputPath,
  fs.readFileSync(indexHtmlInputPath, 'utf8')
    .replaceAll('$$BUILD_UUID$$', buildUuid));

fs.writeFileSync(updateDataYmlOutputPath,
  fs.readFileSync(updateDataYmlInputPath, 'utf8')
    .replaceAll('$$BUILD_UUID$$', buildUuid));
    

// Save the buildUuid to a file for fetch_events.sh
fs.writeFileSync(path.join(kuntorastitDir, 'build-uuid.txt'), buildUuid);

console.log(`Post-build complete with buildUuid: ${buildUuid}`);