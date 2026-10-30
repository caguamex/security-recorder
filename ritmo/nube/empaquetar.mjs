// Los encabezados de Cloudflare no forman parte de la caché de la aplicación.
import { copyFileSync } from 'node:fs';
copyFileSync(new URL('./_headers', import.meta.url), new URL('../dist/pwa/_headers', import.meta.url));
