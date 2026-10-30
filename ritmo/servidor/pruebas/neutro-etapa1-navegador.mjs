// App real con PostgreSQL local. Las cuentas del panel se simulan solo para probar las etiquetas.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {entorno} from './entorno.mjs';
import {elegirModo} from './ayudas-neutro.mjs';
const e=await entorno(),salon='aaaaaaaa-1111-4111-8111-111111111111',ale='11111111-1111-4111-8111-111111111111',sofia='22222222-2222-4222-8222-222222222222';
const day='2026-10-29',rows=[
 {id:'__settings',negocio:'AB Beauty Room',abre:'09:00',cierra:'20:00',modo:'white',skin:'clasico'},
 {id:'s1',kind:'servicio',nombre:'Diseño de cejas',categoria:'Cejas',precio:300,duracion:30},
 {id:'s2',kind:'servicio',nombre:'Pestañas clásicas',categoria:'Pestañas',precio:650,duracion:90},
 {id:'c1',kind:'clienta',nombre:'Mariana Torres',telefono:'5511111111',notas:'',whatsappOptIn:true},
 {id:'c2',kind:'clienta',nombre:'Daniela García',telefono:'5522222222',notas:'',whatsappOptIn:false},
 {id:'a1',kind:'cita',clienta:'c1',servicio:'s1',especialista:ale,date:day,start:'13:00',estado:'confirmada',notas:''},
 {id:'a2',kind:'cita',clienta:'c2',servicio:'s2',especialista:sofia,date:day,start:'13:00',estado:'pendiente',notas:''},
 {id:'p1',kind:'promo',titulo:'Tu mirada, tu momento',texto:'Promoción local para revisar el diseño.',color:'#E0457B',etiqueta:'Esta semana'},
 {id:'g1',kind:'grupo',nombre:'Belleza en Monclova',url:'https://www.facebook.com/groups/ejemplo'}
];
for(const row of rows){const {id,...settings}=row;await e.repo.cambiar({id,baseVersion:0,mutationId:crypto.randomUUID(),data:id==='__settings'?settings:row});}
const dest=fileURLToPath(new URL('../../imagenes/neutro-etapa1/app/',import.meta.url));await mkdir(dest,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'}),errors=[],external=[];
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},locale:'es-MX',timezoneId:'America/Mexico_City'});
 await ctx.route('**/*',r=>{const u=r.request().url();if(u.startsWith(e.base+'/api/negocios/'+salon+'/miembros'))return r.fulfill({json:{miembros:[{id:ale,nombre:'Alejandra'},{id:sofia,nombre:'Sofía'}]}});if(u.endsWith('/datos/prestadores'))return r.fulfill({json:{equipo:[{nombre:'Alejandra',servicios:['s1']},{nombre:'Sofía',servicios:['s2']}]}});if(!u.startsWith(e.base)&&!u.startsWith('data:')&&!u.startsWith('blob:')){external.push(u);return r.abort();}return r.continue();});
 const p=await ctx.newPage();p.on('pageerror',x=>errors.push(x.message));await p.clock.setFixedTime(new Date(day+'T13:40:00-06:00'));await p.goto(e.base);
 const tab=n=>p.locator('#tabbar').getByRole('tab',{name:n,exact:true});
 await tab('Negocio').click();await p.getByRole('button',{name:/Sincronización/}).click();await p.getByText('Configuración avanzada',{exact:true}).click();await p.getByLabel('Token de acceso',{exact:true}).fill(e.token);await p.getByRole('button',{name:'Conectar',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#sync-status')?.textContent.includes('Sincronizado'));await p.getByRole('button',{name:'Listo',exact:true}).click();
 await p.evaluate(({salon,ale})=>{window.AgendappxCuentas={...window.AgendappxCuentas,sesion:async()=>({negocioId:salon,usuarioId:ale,rol:'admin',aal:'aal2',accessToken:'solo-prueba-local'})};window.dispatchEvent(new Event('online'));},{salon,ale});
 await tab('Agenda').click();await p.locator('[data-especialista="'+ale+'"]').waitFor();
 assert.match(await p.locator('#week .wd').first().innerText(),/^L/);assert.match(await p.locator('#week .wd').last().innerText(),/^D/);
 const first=await p.locator('[data-cita=a1]').boundingBox(),second=await p.locator('[data-cita=a2]').boundingBox();assert.ok(first&&second);assert.ok(first.x+first.width<=second.x||second.x+second.width<=first.x,'Citas simultáneas lado a lado');
 await p.locator('[data-especialista="'+ale+'"]').click();assert.equal(await p.locator('.ev').count(),1);await p.locator('[data-especialista=""]').click();assert.equal(await p.locator('.ev').count(),2);
 for(const mode of ['White','Dark']){
  await elegirModo(p,mode);await tab('Agenda').click();assert.equal(await p.locator('input[type=time]').count(),0);await p.screenshot({path:dest+'agenda-'+mode+'.png',animations:'disabled'});
  for(const section of ['Clientas','Servicios','Negocio']){await tab(section).click();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,section+' '+mode);await p.evaluate(async()=>{await Promise.all([...document.images].filter(x=>x.src).map(x=>x.decode().catch(()=>{})));});await p.screenshot({path:dest+section.toLowerCase()+'-'+mode+'.png',animations:'disabled'});}
  await p.getByRole('button',{name:/^Apariencia/}).click();await p.getByRole('switch',{name:'Reducir transparencia',exact:true}).click();assert.equal(await p.locator('html').getAttribute('data-transparencia'),'solida');await p.getByRole('switch',{name:'Reducir transparencia',exact:true}).click();await p.screenshot({path:dest+'apariencia-'+mode+'.png',animations:'disabled'});await tab('Servicios').click();await p.locator('#screen').getByRole('tab',{name:'Promociones',exact:true}).click();await p.screenshot({path:dest+'promociones-'+mode+'.png',animations:'disabled'});
  await p.getByRole('button',{name:'Nueva cita',exact:true}).click();await p.locator('#c-cli').selectOption('c1');await p.locator('[data-svc=s2]').click();assert.equal(await p.locator('#c-svcs img').count(),2);assert.equal(await p.locator('#c-time').evaluate(x=>x.tagName),'SELECT');assert.equal(await p.locator('input[type=time]').count(),0);assert.equal(await p.getByRole('switch',{name:'Confirmar por WhatsApp',exact:true}).count(),1);await p.locator('#c-time').selectOption('17:00');await p.locator('#sheetCard').evaluate(x=>x.scrollTop=0);await p.screenshot({path:dest+'nueva-cita-'+mode+'.png',animations:'disabled'});await p.getByRole('button',{name:'Cancelar',exact:true}).click();
 }
 await tab('Negocio').click();assert.equal(await p.getByRole('tab',{name:'White',exact:true}).count(),0);assert.equal(await p.getByLabel('Hora de apertura').evaluate(x=>x.tagName),'SELECT');await p.getByLabel('Hora de apertura').selectOption('08:15');await p.getByLabel('Hora de cierre').selectOption('21:00');
 await p.getByRole('button',{name:/Sincronización/}).click();await p.getByRole('button',{name:'Sincronizar ahora',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#sync-status')?.textContent.includes('Sincronizado'));await p.getByRole('button',{name:'Listo',exact:true}).click();
 const settings=(await e.repo.snapshot()).records.find(x=>x.id==='__settings');assert.equal(settings.data.abre,'08:15');assert.equal(settings.data.cierra,'21:00');
 await p.getByRole('button',{name:'Nueva cita',exact:true}).click();await p.locator('#c-cli').selectOption('c1');await p.locator('#c-time').selectOption('17:15');await p.getByRole('switch',{name:'Confirmar por WhatsApp',exact:true}).click();await p.locator('#c-go').click();await p.locator('#sheet[hidden]').waitFor({state:'attached'});await tab('Negocio').click();await p.getByRole('button',{name:/Sincronización/}).click();await p.getByRole('button',{name:'Sincronizar ahora',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#sync-status')?.textContent.includes('Sincronizado'));await p.getByRole('button',{name:'Listo',exact:true}).click();assert.ok((await e.repo.snapshot()).records.some(r=>r.data?.kind==='cita'&&r.data.start==='17:15'));
 for(const width of [768,1440]){await p.setViewportSize({width,height:960});await tab('Agenda').click();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:dest+'agenda-'+width+'.png',animations:'disabled'});}
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log(JSON.stringify({app_real:true,modos:['White','Dark'],semana:'lunes-domingo',especialistas:true,simultaneas:'columnas',horas:'24 h con select',apertura_cierre_sincronizados:true,cita_guardada_local:true,carrusel_fotos:true,whatsapp:'sin envío',errores:errors,capturas:dest}));await ctx.close();
}finally{await browser.close();await e.cerrar();}
