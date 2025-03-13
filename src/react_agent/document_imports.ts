/**
 * File for importing and exporting document data
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory path in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import cotisations sociales BTP 2025 data
const cotisationsPath = path.join(__dirname, './data/docs/cotisation_sociales_btp_2025.json');
// Parse the JSON data and also export a formatted string version
const cotisationsData = JSON.parse(readFileSync(cotisationsPath, 'utf-8'));

export const cotisationsSocialesBtp2025 = JSON.stringify(cotisationsData, null, 2);

// Import gestion paie documentation
const gestionPaiePath = path.join(__dirname, './data/docs/gestion_paie.md');

export const gestionPaieDocumentation = readFileSync(gestionPaiePath, 'utf-8'); 