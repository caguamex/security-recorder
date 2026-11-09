import {abrirConexiones,abrirServicios,nuevaCita,seccion} from './ayudas-neutro.mjs';
import {elegirModo,elegirTema} from './ayudas-neutro.mjs';
import {chromium} from 'playwright';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {preparar,ids,sesiones} from './whatsapp-solo-envios-entorno.mjs';
import {VerificadorJWT} from '../build/cuentas/jwt.js';
import {rutasCuentas} from '../build/cuentas/http.js';
import {crearServidor} from '../build/http.js';
const e=await preparar();
for(const s of [
 {id:'unas',kind:'servicio',nombre:'Uñas acrílicas',categoria:'Uñas',duracion:90,precio:650},
 {id:'cejas',kind:'servicio',nombre:'Diseño de ceja',categoria:'Cejas',duracion:45,precio:250},
 {id:'lash',kind:'servicio',nombre:'Lifting de pestañas',categoria:'Pestañas',duracion:60,precio:550},
 {id:'color',kind:'servicio',nombre:'Coloración',categoria:'Cabello',duracion:120,precio:900},
])await e.fuente(s);
await e.como('admin',ids.salon,c=>c.query("UPDATE ritmo.miembros SET nombre='Karina', servicios=ARRAY['cejas','lash'] WHERE usuario_id=$1",[ids.especialista]));
const par=await generateKeyPair('ES256',{extractable:true}),key={...await exportJWK(par.publicKey),kid:'local',alg:'ES256'};
const sb='https://zkqwephmuflbuagevvxj.supabase.co',jwt=new VerificadorJWT(sb,{fetch:async()=>Response.json({keys:[key]})});
const token=await new SignJWT({session_id:sesiones.admin,aal:'aal2',role:'authenticated'}).setProtectedHeader({alg:'ES256',kid:'local'}).setSubject(ids.admin).setIssuer(sb+'/auth/v1').setAudience('authenticated').setIssuedAt().setExpirationTime('1h').sign(par.privateKey);
let base='';const config={habilitado:true,supabaseURL:sb,llavePublica:'sb_publishable_prueba',salones:new Set([ids.salon]),get origen(){return base;}};
const server=crearServidor({salud:async()=>{},estado:async()=>[],snapshot:async()=>({records:[],cursor:0,full:true})},'a'.repeat(40),fileURLToPath(new URL('../../dist/pwa/',import.meta.url)),{cuentas:rutasCuentas(e.poolAPI,jwt,config)});
server.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},locale:'es-MX'});
 await context.addInitScript(({token,id})=>localStorage.setItem('agendappx.auth',JSON.stringify({access_token:token,refresh_token:'local',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id,aud:'authenticated',role:'authenticated',email:'demo@example.test',factors:[]}})),{token,id:ids.admin});
 await context.route(sb+'/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"solo local"}'}));
 const p=await context.newPage(),errores=[];p.on('pageerror',err=>errores.push(err.message));await p.goto(base);await p.waitForFunction(async()=>!!(await window.AgendappxCuentas?.sesion()));await abrirServicios(p);
 const input=p.locator('#buscar-servicios');await input.waitFor();await p.locator('[data-servicio="cejas"]').getByText(/Karina/).waitFor();
 assert.match(await p.locator('[data-servicio="cejas"]').innerText(),/45 min.*Karina/);assert.match(await p.locator('[data-servicio="cejas"]').innerText(),/\$250/);
 assert.match(await p.locator('[data-servicio="unas"]').innerText(),/Sin asignar/);
 await input.fill('UÑAS');assert.equal(await p.locator('[data-servicio]').count(),1);assert.equal(await p.locator('[data-servicio="unas"] mark').first().innerText(),'Uñas');
 await input.fill('cejas');assert.equal(await p.locator('[data-servicio]').count(),1);assert.equal(await p.locator('[data-servicio="cejas"] mark').innerText(),'ceja');
 await input.fill('PESTANA');assert.equal(await p.locator('[data-servicio]').count(),1);assert.equal(await p.locator('[data-servicio="lash"] mark').innerText(),'pestaña');
 await input.fill('pestanas lifting');assert.equal(await p.locator('[data-servicio]').count(),1);assert.equal(await p.evaluate(()=>document.activeElement.id),'buscar-servicios');
 await input.fill('<script>');assert.equal(await p.locator('[data-servicio]').count(),0);assert.equal(await p.locator('#resultados-servicios script').count(),0);
 await p.getByRole('button',{name:'Cejas',exact:true}).click();assert.equal(await p.locator('[data-servicio]').count(),1);assert.equal(await input.inputValue(),'Cejas');
 await p.getByRole('button',{name:'Borrar búsqueda'}).click();assert.equal(await p.locator('[data-servicio]').count(),5);
 assert.equal(await p.locator('[data-agendar="cejas"]').count(),1);
 for(const width of [390,768,1440]){await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await p.setViewportSize({width:390,height:844});await input.fill('cejas');
 if(process.env.BUSCADOR_SCREENSHOT_DIR)await p.screenshot({path:process.env.BUSCADOR_SCREENSHOT_DIR+'/buscador-white.png',animations:'disabled'});
 await p.getByRole('tab',{name:'Negocio',exact:true}).click();await elegirModo(p,/Dark/);await abrirServicios(p);assert.equal(await p.locator('[data-servicio]').count(),1);
 if(process.env.BUSCADOR_SCREENSHOT_DIR)await p.screenshot({path:process.env.BUSCADOR_SCREENSHOT_DIR+'/buscador-dark.png',animations:'disabled'});
 await context.setOffline(true);await p.reload();await abrirServicios(p);await p.locator('[data-servicio="cejas"]').getByText(/Karina/).waitFor();await p.locator('#buscar-servicios').fill('ceja');assert.equal(await p.locator('[data-servicio]').count(),1);
 assert.deepEqual(errores,[]);console.log('Buscador: acentos, mayúsculas, plural, resaltado, agrupación, personal, categorías, agendar y modo sin conexión verificados.');
 await context.close();
}finally{await browser.close();await new Promise(r=>server.close(r));await e.cerrar();}
