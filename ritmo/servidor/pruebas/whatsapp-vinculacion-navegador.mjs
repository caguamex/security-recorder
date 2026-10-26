// Navegador → API real → JWT/RLS → PostgreSQL local. Evolution simulado; no envía mensajes.
import {chromium} from 'playwright';
import {once} from 'node:events';
import {readFile,readdir,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {cuentasEntorno,ids,sesiones} from './cuentas-entorno.mjs';
import {ProveedorEvolution,instanciaDelSalon} from '../build/whatsapp-evolution/proveedor.js';
import {VinculacionWhatsApp} from '../build/whatsapp-evolution/vinculacion.js';
import {rutasVinculacion} from '../build/whatsapp-evolution/http.js';
import {VerificadorJWT} from '../build/cuentas/jwt.js';
import {crearServidor} from '../build/http.js';
const e=await cuentasEntorno();
const dir=new URL('../../supabase/migrations/',import.meta.url);
const archivo=(await readdir(dir)).find(v=>v.endsWith('_whatsapp_vinculacion.sql'));
await e.db.exec(await readFile(new URL(archivo,dir),'utf8'));
let creado=false,estado='close',codigos=0,salidas=0,fallar=false;
const numero='525511111111';
const proveedor=new ProveedorEvolution({url:'https://evolution.local',apiKey:'k'.repeat(40),webhookKey:'w'.repeat(40),publicURL:'https://agendappx.local'},async(url,op)=>{
  if(fallar)throw new Error('Fallo simulado del proveedor');
  const u=new URL(url);
  if(u.pathname.startsWith('/instance/connectionState/'))return Response.json(creado?{instance:{state:estado}}:{status:404,error:'Not Found',response:{message:['No existe la instancia']}},{status:creado?200:404});
  if(u.pathname==='/instance/fetchInstances')return Response.json([{name:instanciaDelSalon(ids.salon),ownerJid:numero+'@s.whatsapp.net'}]);
  if(u.pathname==='/instance/create'){creado=true;return Response.json({},{status:201});}
  if(u.pathname.startsWith('/webhook/set/'))return Response.json({});
  if(u.pathname.startsWith('/instance/connect/')){codigos++;return Response.json({pairingCode:'ABCD1234'});}
  if(u.pathname.startsWith('/instance/logout/')){salidas++;estado='close';return Response.json({});}
  throw new Error('Ruta inesperada');
});
const par=await generateKeyPair('ES256',{extractable:true});
const key={...await exportJWK(par.publicKey),kid:'local',alg:'ES256'};
const token=await new SignJWT({session_id:sesiones.admin,aal:'aal2',role:'authenticated'})
 .setProtectedHeader({alg:'ES256',kid:'local'}).setSubject(ids.admin).setIssuer('https://local.supabase.co/auth/v1')
 .setAudience('authenticated').setIssuedAt().setExpirationTime('1h').sign(par.privateKey);
const jwt=new VerificadorJWT('https://local.supabase.co',{fetch:async()=>Response.json({keys:[key]})});
const servicio=new VinculacionWhatsApp(e.poolAPI,proveedor,new Set([ids.salon]));
const repo={salud:async()=>{},snapshot:async()=>({records:[],cursor:0,full:true}),estado:async()=>[]};
const server=crearServidor(repo,'token_heredado_de_prueba_012345678901234',fileURLToPath(new URL('../../dist/pwa/',import.meta.url)),{vinculacion:rutasVinculacion(servicio,jwt)});
server.listen(0,'127.0.0.1');await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
const context=await browser.newContext({viewport:{width:390,height:844},locale:'es-MX'});
const page=await context.newPage(),errores=[];page.on('pageerror',e=>errores.push(e.message));
const imagenes=fileURLToPath(new URL('../../imagenes/',import.meta.url));await mkdir(imagenes,{recursive:true});
const sesion={usuarioId:ids.admin,negocioId:ids.salon,accessToken:token,rol:'admin',aal:'aal2'};
async function abrir(){await page.getByRole('tab',{name:'Ajustes',exact:true}).click();await page.getByRole('button',{name:/Automatización de WhatsApp/}).click();}
async function cerrar(){await page.getByRole('button',{name:'Listo',exact:true}).click();}
try{
 await page.addInitScript(()=>{Object.defineProperty(navigator.clipboard,'writeText',{value:async texto=>{window.__copiadoLocal=texto;}});});
 await page.goto(base);await page.evaluate(()=>document.fonts.ready);
 await abrir();await page.getByText('Inicia sesión como Admin y completa la verificación en dos pasos para vincular el WhatsApp del salón.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Generar código',exact:true}).isDisabled(),true);await cerrar();
 await page.evaluate(s=>{window.__sesionLocal=s;window.AgendappxCuentas={sesion:async()=>window.__sesionLocal};},sesion);
 await abrir();await page.waitForFunction(()=>!document.querySelector('#wa-numero').disabled);
 await page.getByLabel('Tu número',{exact:true}).fill('55 1111 1111');await page.getByRole('button',{name:'Generar código',exact:true}).click();
 await page.getByText('ABCD – 1234',{exact:true}).waitFor();assert.equal(codigos,1);
 await page.getByRole('button',{name:'Copiar código',exact:true}).click();assert.equal(await page.evaluate(()=>window.__copiadoLocal),'ABCD1234');
 assert.equal(await page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('ABCD1234'))),false);
 await page.screenshot({path:imagenes+'whatsapp-vincular-codigo.png',animations:'disabled'});
 estado='open';await page.waitForFunction(()=>document.querySelector('#wa-estado')?.textContent==='Vinculado',{},{timeout:15000});
 assert.equal(await page.locator('#wa-codigo-panel').isHidden(),true);assert.equal(codigos,1);
 await page.screenshot({path:imagenes+'whatsapp-vinculado.png',animations:'disabled'});
 fallar=true;await page.locator('#wa-error').filter({hasText:/Conservamos tu conexión/}).waitFor({timeout:15000});
 assert.equal(await page.locator('#wa-estado').textContent(),'Vinculado');assert.equal(salidas,0);assert.equal(codigos,1);fallar=false;
 await page.evaluate(()=>{window.__sesionLocal=null;document.dispatchEvent(new Event('agendappx:sesion'));});
 await page.waitForFunction(()=>document.querySelector('#wa-numero')?.value==='');
 assert.equal(await page.locator('#wa-codigo').textContent(),'');
 await page.evaluate(s=>{window.__sesionLocal=s;document.dispatchEvent(new Event('agendappx:sesion'));},sesion);
 await page.waitForFunction(()=>document.querySelector('#wa-estado')?.textContent==='Vinculado');
 await page.getByRole('button',{name:'Desvincular WhatsApp',exact:true}).click();await page.getByRole('button',{name:'Conservar vínculo',exact:true}).click();assert.equal(salidas,0);
 await page.getByRole('button',{name:'Desvincular WhatsApp',exact:true}).click();await page.getByRole('button',{name:'Sí, desvincular',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#wa-estado')?.textContent==='Sin vincular');assert.equal(salidas,1);await cerrar();
 for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:844});
  for(const modo of ['white','dark']){
   await page.getByRole('tab',{name:modo==='white'?'☀️ White':'🌙 Dark',exact:true}).click();
   await abrir();await page.waitForFunction(()=>document.querySelector('#wa-numero')&&!document.querySelector('#wa-numero').disabled);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(await page.evaluate(()=>{const r=document.querySelector('#sheetCard').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}),true);
   await cerrar();
  }
 }
 assert.deepEqual(errores,[]);
 console.log('WhatsApp: navegador/API/JWT/RLS correctos; código efímero, cuenta obligatoria, red interrumpida, sesión cerrada, confirmación de salida y White/Dark en 390/768/1440. Sin mensajes reales.');
}finally{await context.close();await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});await e.cerrar();}
