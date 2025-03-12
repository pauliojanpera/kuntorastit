#!/usr/bin/env node
const { randomUUID } = require('crypto');
const fs = require('fs');

// Ensure public/kuntorastit exists
const outputDir = 'public/kuntorastit';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate a UUID
const uuid = randomUUID();

// Paths to input and output files
const swInputPath = 'public/kuntorastit/dist/service-worker.mjs';
const swOutputPath = 'public/kuntorastit/service-worker.js';
const mainInputPath = 'public/kuntorastit/dist/kuntorastit.mjs';

// Read and process service-worker.mjs
const swContent = fs.readFileSync(swInputPath, 'utf8').replace('CACHE_UUID', uuid);
fs.writeFileSync(swOutputPath, swContent);

// Read and process kuntorastit.mjs
const mainContent = fs.readFileSync(mainInputPath, 'utf8').replace('CACHE_UUID', uuid);
fs.writeFileSync(mainInputPath, mainContent);

// Clean up the export statement in service-worker.js
const finalSwContent = fs.readFileSync(swOutputPath, 'utf8').replace(/export {};/, '');
fs.writeFileSync(swOutputPath, finalSwContent);

console.log(`Post-build complete with UUID: ${uuid}`);