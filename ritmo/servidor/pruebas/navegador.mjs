// Prueba completa con Edge/Chromium y PostgreSQL local. No usa Railway.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { entorno } from './entorno.mjs';
const env = await entorno();
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const screenshots = fileURLToPath(new URL('../../imagenes/', import.meta.url));
await mkdir(screenshots, { recursive: true });
const errors = [], contexts = [];
async function dispositivo() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  contexts.push(context);
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-27T10:40:00-06:00'));
  await page.goto(env.base);
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.evaluate(() => document.fonts.ready);
  return page;
}
async function conexiones(page) {
  await page.getByRole('tab', { name: 'Ajustes', exact: true }).click();
  await page.getByRole('button', { name: /Sincronización/ }).click();
  await page.getByRole('dialog', { name: 'Sincronización', exact: true }).waitFor();
}
async function conectar(page) {
  await conexiones(page); await page.getByLabel('Token de acceso', { exact: true }).fill(env.token);
  await page.getByRole('button', { name: 'Conectar', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#sync-status')?.textContent.includes('Sincronizado'));
  await page.getByRole('button', { name: 'Listo', exact: true }).click();
}
async function sincronizar(page) {
  await conexiones(page);
  await page.getByRole('button', { name: 'Sincronizar ahora', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#sync-status')?.textContent.includes('Sincronizado'));
  await page.getByRole('button', { name: 'Listo', exact: true }).click();
}
try {
  const a = await dispositivo();
  await a.screenshot({ path: screenshots + 'pwa-agenda.png' });
  await a.getByRole('tab', { name: 'Servicios', exact: true }).click();
  await a.screenshot({ path: screenshots + 'pwa-servicios.png' });
  const manifest = await a.evaluate(async () => (await fetch('./manifest.webmanifest')).json());
  assert.equal(manifest.display, 'standalone'); assert.equal(manifest.icons.length, 2);
  await a.getByRole('tab', { name: 'Ajustes', exact: true }).click();
  for (const theme of ['Rosa champaña', 'Negro y dorado', 'Ritmo', 'Cristal pastel', 'Clásico iOS']) {
    await a.getByRole('radio', { name: theme, exact: true }).click();
    assert.equal(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  await conectar(a);
  await a.context().setOffline(true);
  await a.getByRole('tab', { name: 'Clientas', exact: true }).click();
  await a.locator('[data-act="nueva-clienta"]').click();
  await a.locator('#k-nombre').fill('Clienta de prueba sin conexión');
  await a.getByRole('button', { name: 'Guardar', exact: true }).click();
  await a.reload();
  await a.getByRole('tab', { name: 'Clientas', exact: true }).click();
  assert.equal(await a.getByRole('button', { name: /Clienta de prueba sin conexión/ }).count(), 1);
  await a.context().setOffline(false); await sincronizar(a);
  await a.getByRole('tab', { name: 'Ajustes', exact: true }).click();
  await a.getByRole('button', { name: /Suscribir Apple o Google Calendar/ }).click();
  await a.getByLabel('Enlace privado del calendario').waitFor();
  assert.match(await a.getByLabel('Enlace privado del calendario').inputValue(), /\/calendario\/[a-f0-9]{64}\.ics$/);
  await a.getByRole('button', { name: 'Listo', exact: true }).click();
  await a.getByRole('button', { name: /Automatización de WhatsApp/ }).click();
  await a.getByText('Inicia sesión como Admin y completa la verificación en dos pasos para vincular el WhatsApp del salón.', { exact: true }).waitFor();
  assert.equal(await a.getByRole('button', { name: 'Generar código', exact: true }).isDisabled(), true);
  await a.getByRole('button', { name: 'Listo', exact: true }).click();
  await conexiones(a); await a.screenshot({ path: screenshots + 'pwa-sincronizacion.png', animations: 'disabled' });
  await a.getByRole('button', { name: 'Cancelar', exact: true }).click();
  assert.equal(await a.locator('#sheet').isHidden(), true);

  const b = await dispositivo(); await conectar(b);
  await b.getByRole('tab', { name: 'Clientas', exact: true }).click();
  await b.getByRole('button', { name: /Clienta de prueba sin conexión/ }).click();
  await b.locator('#k-nombre').fill('Actualizada desde otro dispositivo');
  await b.getByRole('button', { name: 'Guardar', exact: true }).click();
  await sincronizar(b); await sincronizar(a);
  await a.getByRole('tab', { name: 'Clientas', exact: true }).click();
  assert.equal(await a.getByRole('button', { name: /Actualizada desde otro dispositivo/ }).count(), 1);
  // Las respuestas con datos privados no se guardan en el service worker.
  const cached = await a.evaluate(async () => {
    const urls = [];
    for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) urls.push(req.url);
    return urls;
  });
  assert.equal(cached.some(url => url.includes('/api/')), false);
  for (const width of [390, 768, 1440]) {
    await a.setViewportSize({ width, height: 900 });
    assert.equal(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  // Un fallo de almacenamiento debe mantener el formulario y evitar un aviso falso de éxito.
  await a.locator('[data-act="nueva-clienta"]').click();
  await a.locator('#k-nombre').fill('No debe guardarse');
  await a.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Sin espacio', 'QuotaExceededError'); }; });
  await a.getByRole('button', { name: 'Guardar', exact: true }).click();
  assert.equal(await a.getByRole('dialog', { name: 'Clienta', exact: true }).isVisible(), true);
  assert.match(await a.locator('#toast').innerText(), /No se pudo guardar/);
  assert.deepEqual(errors, []);
  console.log('Navegador: PWA sin conexión, cinco temas, recarga, sincronización entre dispositivos y caché privada verificados. Capturas a 390 px guardadas.');
} finally {
  for (const ctx of contexts) await ctx.close();
  await browser.close(); await env.cerrar();
}
