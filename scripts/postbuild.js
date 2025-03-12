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

const swContent = fs.readFileSync(swInputPath, 'utf8')
  .replace('CACHE_UUID', buildUuid)
  .replace(/export {};/, '');
fs.writeFileSync(swOutputPath, swContent);

const mainContent = fs.readFileSync(mainInputPath, 'utf8')
  .replace('CACHE_UUID', buildUuid);
fs.writeFileSync(mainInputPath, mainContent);

// Create redirect index.html at /kuntorastit
const redirectHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=/kuntorastit/${buildUuid}/">
  <title>Redirecting...</title>
</head>
<body>
  <p>Redirecting to <a href="/kuntorastit/${buildUuid}/">latest build</a>...</p>
</body>
</html>
`;
fs.writeFileSync(path.join(kuntorastitDir, 'index.html'), redirectHtml);

// Save the buildUuid to a file for fetch_events.sh
fs.writeFileSync(path.join(kuntorastitDir, 'build-uuid.txt'), buildUuid);

console.log(`Post-build complete with buildUuid: ${buildUuid}`);