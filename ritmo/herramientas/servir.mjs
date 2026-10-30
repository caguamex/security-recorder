import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { estatico } from './estatico.mjs';
const root = fileURLToPath(new URL('../dist/pwa/', import.meta.url));
const port = Number(process.env.PORT || 4173);
createServer((req, res) => estatico(req, res, root)).listen(port, '0.0.0.0', () => {
  console.log(`Ritmo Belleza: http://localhost:${port}`);
});
