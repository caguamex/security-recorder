import {abrirConexiones,abrirServicios,nuevaCita,seccion} from './ayudas-neutro.mjs';
import {elegirModo,elegirTema} from './ayudas-neutro.mjs';
// Flujo completo con PostgreSQL local, navegador y cookies reales; sin datos de producción.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { entorno } from './entorno.mjs';
const env = await entorno();
const browser = await chromium.launch({ headless:true, channel:process.env.BROWSER_CHANNEL || 'msedge' });
const context = await browser.newContext({ viewport:{width:390,height:844}, locale:'es-MX', timezoneId:'America/Mexico_City', acceptDownloads:true });
const errors = [], page = await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
const tab = name => page.locator('#tabbar').getByRole('tab',{name,exact:true});
const capturas = fileURLToPath(new URL('../../imagenes/',import.meta.url)); await mkdir(capturas,{recursive:true});
try {
  await page.clock.setFixedTime(new Date('2026-11-10T09:00:00-06:00'));
  await page.addInitScript(() => {
    if (localStorage.getItem('calendario.prueba.preparado')) return;
    localStorage.setItem('calendario.prueba.preparado','si');
    localStorage.setItem('belleza.v1.items',JSON.stringify([
      {id:'s_apple_local',kind:'servicio',nombre:'Lifting local',categoria:'Pestañas',precio:300,duracion:90},
      {id:'k_apple_local',kind:'clienta',nombre:'Clienta local',telefono:'5511111111'},
      {id:'c_apple_local',kind:'cita',date:'2026-11-10',start:'14:00',clienta:'k_apple_local',servicio:'s_apple_local',estado:'pendiente',notas:'Nota privada que no debe exportarse'},
      {id:'c_apple_cancelada',kind:'cita',date:'2026-11-10',start:'17:00',clienta:'k_apple_local',servicio:'s_apple_local',estado:'cancelada'}
    ]));
  });
  await env.repo.cambiar({id:'clienta_servidor',baseVersion:0,mutationId:'prueba_servidor_apple',data:{id:'clienta_servidor',kind:'clienta',nombre:'Clienta del servidor'}});
  await page.goto(env.base);
  assert.equal((await page.request.get(env.base+'/api/estado')).status(),401);
  await tab('Negocio').click();await abrirConexiones(page); await abrirConexiones(page);await page.getByRole('button',{name:/Apple Calendar/}).click();
  assert.equal(await page.getByLabel('Token de acceso',{exact:true}).count(),0);
  const descarga = page.waitForEvent('download');
  await page.getByRole('button',{name:'Agregar mis citas (.ics)',exact:true}).click();
  const archivo = await descarga; assert.match(archivo.suggestedFilename(),/^Agendappx-.*\.ics$/);
  const ics = await readFile(await archivo.path(),'utf8');
  assert.match(ics,/BEGIN:VCALENDAR/); assert.match(ics,/X-WR-CALNAME:Agendappx/);
  assert.match(ics,/UID:c_apple_local@ritmo-belleza\r\n/);
  assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,1);
  for (const privado of ['5511111111','Nota privada','c_apple_cancelada']) assert.equal(ics.includes(privado),false);
  await page.getByRole('button',{name:'Activar sincronización',exact:true}).click();
  const ticketResponse = await fetch(env.base+'/api/dispositivos/enlaces',{method:'POST',headers:{Authorization:'Bearer '+env.token,'Content-Type':'application/json'},body:'{}'});
  assert.equal(ticketResponse.status,201); const ticket = await ticketResponse.json();
  await page.getByLabel('Enlace privado de activación',{exact:true}).fill(ticket.activacionUrl);
  await page.getByRole('button',{name:'Activar y abrir Apple Calendar',exact:true}).click();
  await page.getByLabel('Enlace privado del calendario',{exact:true}).waitFor({state:'attached'});
  const feedUrl = await page.getByLabel('Enlace privado del calendario',{exact:true}).inputValue();
  assert.equal(await page.getByRole('link',{name:'Abrir Apple Calendar',exact:true}).getAttribute('href'),feedUrl.replace(/^https?:/,'webcal:'));
  const cookies = await context.cookies(); assert.ok(cookies.some(c=>c.name==='agendappx_sesion_local'&&c.httpOnly));
  const local = await page.evaluate(()=>JSON.stringify({...localStorage})); assert.equal(local.includes(env.token),false); assert.equal(local.includes(ticket.activacionUrl),false);
  const feed = await (await fetch(feedUrl)).text(); assert.match(feed,/SUMMARY:Lifting local/); assert.equal(feed.includes('Nota privada'),false);
  assert.ok((await env.repo.estado()).some(r=>r.id==='clienta_servidor'));
  assert.ok((await env.repo.estado()).some(r=>r.id==='c_apple_local'));
  await page.screenshot({path:capturas+'apple-calendario-suscripcion.png',animations:'disabled'});
  await page.getByRole('button',{name:'Listo',exact:true}).click();
  await context.setOffline(true); await page.reload();
  await tab('Clientas').click(); assert.equal(await page.getByRole('button',{name:/Clienta local/}).count(),1);
  await page.getByRole('button',{name:/Clienta local/}).click(); await page.locator('#k-nombre').fill('Clienta actualizada sin internet');
  await page.getByRole('button',{name:'Guardar',exact:true}).click();
  await page.reload(); await tab('Clientas').click(); assert.equal(await page.getByRole('button',{name:/Clienta actualizada sin internet/}).count(),1);
  await context.setOffline(false);
  await tab('Negocio').click(); await abrirConexiones(page);await page.getByRole('button',{name:/Sincronización/}).click();
  await page.getByRole('button',{name:'Sincronizar ahora',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#sync-status')?.textContent.includes('Sincronizado'));
  await page.getByRole('button',{name:'Listo',exact:true}).click();
  assert.match(await (await fetch(feedUrl)).text(),/Clienta actualizada sin internet/);
  // La suscripción estable refleja cambios sin regenerar enlace ni credenciales.
  await tab('Agenda').click(); await page.locator('[data-cita="c_apple_local"]').first().click();
  await page.locator('[data-edit]').click();
  await page.locator('[data-slot="15:30"]').click();
  await page.getByRole('button',{name:/Guardar cita/}).click();
  await tab('Negocio').click();await abrirConexiones(page); await abrirConexiones(page);await page.getByRole('button',{name:/Apple Calendar/}).click();
  await page.getByLabel('Enlace privado del calendario',{exact:true}).waitFor({state:'attached'});
  assert.equal(await page.getByLabel('Enlace privado del calendario',{exact:true}).inputValue(),feedUrl);
  assert.match(await (await fetch(feedUrl)).text(),/DTSTART:20261110T213000Z/);
  await page.getByRole('button',{name:'Listo',exact:true}).click();
  for (const modo of ['White','Dark']) {
    await elegirModo(page,modo);
    await abrirConexiones(page);await page.getByRole('button',{name:/Apple Calendar/}).click(); await page.getByLabel('Enlace privado del calendario',{exact:true}).waitFor({state:'attached'});
    for (const width of [390,768,1440]) { await page.setViewportSize({width,height:844}); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true); }
    await page.getByRole('button',{name:'Listo',exact:true}).click();
  }
  await abrirConexiones(page);await page.getByRole('button',{name:/Sincronización/}).click(); await page.getByRole('button',{name:'Desconectar este dispositivo',exact:true}).click();
  assert.equal((await page.request.get(env.base+'/api/estado')).status(),401);
  await page.getByRole('button',{name:'Listo',exact:true}).click();
  await tab('Clientas').click(); assert.equal(await page.getByRole('button',{name:/Clienta actualizada sin internet/}).count(),1);
  // Abrir un enlace privado limpia inmediatamente la URL; no lo consume hasta confirmar.
  const ticket2 = await (await fetch(env.base+'/api/dispositivos/enlaces',{method:'POST',headers:{Authorization:'Bearer '+env.token,'Content-Type':'application/json'},body:'{}'})).json();
  await page.goto(ticket2.activacionUrl); await page.getByRole('dialog',{name:'Activar este dispositivo',exact:true}).waitFor();
  assert.equal(page.url().includes('#'),false);
  assert.equal((await page.request.get(env.base+'/api/estado')).status(),401);
  // Una activación lenta no cierra un formulario nuevo si la persona salió de esa hoja.
  let liberar, llego;
  const espera = new Promise(resolve => { liberar=resolve; }), solicitada = new Promise(resolve => { llego=resolve; });
  await page.route('**/api/dispositivos/activar',async route=>{ llego(); await espera; await route.continue(); });
  await page.getByRole('button',{name:'Activar y abrir Apple Calendar',exact:true}).click(); await solicitada;
  await page.getByRole('button',{name:'Cancelar',exact:true}).first().click();
  await tab('Clientas').click(); await page.locator('[data-act="nueva-clienta"]').click();
  await page.locator('#k-nombre').fill('Borrador protegido');
  liberar(); await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('#k-nombre').inputValue(),'Borrador protegido');
  await page.unroute('**/api/dispositivos/activar');
  assert.deepEqual(errors,[]);
  console.log('Apple Calendar: .ics directo y privado; activación sin APP_TOKEN; cookies, recarga, sin conexión, edición de citas, feed estable, revocación y White/Dark verificados.');
} finally { await context.close(); await browser.close(); await env.cerrar(); }
