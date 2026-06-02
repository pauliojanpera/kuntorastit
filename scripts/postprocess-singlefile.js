import { promises as fs } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import he from 'he';

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
    "Alahärmän Kisa",
    "IF Femman",
    "Jalasjärven Jalas",
    "Järviseudun Rasti",
    "Kauhajoen Karhu",
    "Kauhavan Wisa",
    "Kortesjärven Järvi-Veikot",
    "Laihian Luja",
    "Lapuan Virkiä",
    "Malax IF",
    "Närpes OK",
    "Pohjankyrön Rasti",
    "Ylistaron Kilpa-Veljet",
    "Rasti-Jussit",
    "Rasti-Kurikka",
    "Rastiketut",
    "Suunta-Jurva",
    "Teuvan Rivakka",
    "Vaasan Suunnistajat",
    "Kuortaneen Kunto",
    "Ähtärin Urheilijat",
    "OK Kristina",
    "Solf IK",
    "Karijoen Tappara",
    "Vähänkyrön Viesti",
    "Gamlakarleby IF",
    "IF Minken",
    "IK Falken",
    "OK Botnia",
    "OK Terjärv",
    "Lehtimäen Jyske"
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

// Store script contents and replace with unique placeholders
const scriptContents = [];
for (const script of Array.from(document.querySelectorAll('script'))) {
  scriptContents.push(script.textContent);
  script.textContent = 'SCRIPT_PLACEHOLDER';
}

// Serialize the modified DOM to HTML
const modifiedHtml = he.encode('<!DOCTYPE html>\n' + window.document.documentElement.outerHTML, {
  useNamedReferences: true,
  encodeEverything: false,
  allowUnsafeSymbols: true,
  decimal: true
}).split('SCRIPT_PLACEHOLDER');

const finalHtml = [modifiedHtml.shift()];

while (scriptContents.length) {
  finalHtml.push(scriptContents.shift());
  finalHtml.push(modifiedHtml.shift());
}

// Write the modified HTML back to the file
await fs.writeFile(outputFile, finalHtml.join(''), 'utf-8');
console.log('Post-processing complete: Moved scripts and styles to end of <body>, preserved script contents');