import { promises as fs } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

// Derive __dirname equivalent in ES Modules
const __dirname = dirname(fileURLToPath(import.meta.url));

const outputDir = resolve(__dirname, '../dist');
const outputFile = resolve(outputDir, 'index.html');

// Read the generated single-file HTML
const html = await fs.readFile(outputFile, 'utf-8');

// Parse the HTML into a DOM
const { window } = new JSDOM(html);
const { document } = window;

// Create and append the new <script> element with knownOrganizers
const organizerScript = document.createElement('script');
organizerScript.textContent = `
  window.knownOrganizers = [
    "Rasti-Jussit r.y.",
    "Vaasan Suunnistajat",
    "Jalasjärven Jalas ry",
    "Järviseudun Rasti ry",
    "Vörå Idrottsförening rf"
  ];
`;
const body = document.querySelector('body');
body.appendChild(organizerScript);

// Find all <script> and <style> tags in <head>
const head = document.querySelector('head');
const scripts = Array.from(head.querySelectorAll('script'));
const styles = Array.from(head.querySelectorAll('style'));

// Remove them from <head>
scripts.forEach(script => script.remove());
styles.forEach(style => style.remove());

// Append them to the end of <body>
styles.forEach(style => body.appendChild(style));
scripts.forEach(script => body.appendChild(script));

// Serialize the modified DOM back to HTML
const modifiedHtml = '<!DOCTYPE html>\n' + window.document.documentElement.outerHTML;

// Write the modified HTML back to the file
await fs.writeFile(outputFile, modifiedHtml, 'utf-8');
console.log('Post-processing complete: Moved scripts and styles to end of <body>');