import {elegirModo,elegirTema} from './ayudas-neutro.mjs';
// Navegador real, SDK de Supabase real, JWT firmado localmente y PostgreSQL con RLS.
// El transporte de WhatsApp es simulado y no se conecta a teléfonos.
import {chromium} from 'playwright';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {preparar,ids,sesiones} from './whatsapp-solo-envios-entorno.mjs';
import {VerificadorJWT} from '../build/cuentas/jwt.js';
import {rutasCuentas} from '../build/cuentas/http.js';
import {rutasSoloEnvios} from '../build/whatsapp-vinculado/api.js';
import {crearServidor} from '../build/http.js';
const e=await preparar();let vinculado=false;e.remoto.estado=async()=>({estado:vinculado?'conectado':'sin_vincular',verificado:vinculado,numero:vinculado?'525511111111':undefined});await e.iniciar();await e.cita({date:new Date().toISOString().slice(0,10)});
const par=await generateKeyPair('ES256',{extractable:true}),key={...await exportJWK(par.publicKey),kid:'local',alg:'ES256'};
const supabase='https://zkqwephmuflbuagevvxj.supabase.co';
async function token(u='admin',aal=u==='admin'?'aal2':'aal1'){return new SignJWT({session_id:sesiones[u],aal,role:'authenticated',amr:[{method:'otp',timestamp:Math.floor(Date.now()/1000)}]})
 .setProtectedHeader({alg:'ES256',kid:'local'}).setSubject(ids[u]).setIssuer(supabase+'/auth/v1').setAudience('authenticated').setIssuedAt().setExpirationTime('1h').sign(par.privateKey);}
const jwt=new VerificadorJWT(supabase,{fetch:async()=>Response.json({keys:[key]})});
let base='';const config={habilitado:true,supabaseURL:supabase,llavePublica:'sb_publishable_prueba_local',salones:new Set([ids.salon]),migracionUsuarioId:ids.admin,get origen(){return base;}};
const server=crearServidor({salud:async()=>{},estado:async()=>[],snapshot:async()=>({records:[],cursor:0,full:true})},'a'.repeat(40),fileURLToPath(new URL('../../dist/pwa/',import.meta.url)),{cuentas:rutasCuentas(e.poolAPI,jwt,config),vinculacion:(req,res,url)=>rutasSoloEnvios(e.control,jwt,base)(req,res,url)});
server.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'}),errores=[];
const imagenes=fileURLToPath(new URL('../../imagenes/whatsapp-solo-envios/',import.meta.url));await mkdir(imagenes,{recursive:true});
async function contexto(u='admin'){
 const c=await browser.newContext({viewport:{width:390,height:844},locale:'es-MX'}),access=await token(u);
 await c.addInitScript(({access,u,id})=>{localStorage.setItem('agendappx.auth',JSON.stringify({access_token:access,refresh_token:'refresh-solo-pruebas',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id,aud:'authenticated',role:'authenticated',email:u+'@example.test',factors:[]}}));}, {access,u,id:ids[u]});
 // La prueba nunca entrega tráfico al servicio externo de Auth.
 await c.route(supabase+'/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"Prueba local sin red externa"}'}));
 return c;
}
async function abrir(page){await page.getByRole('tab',{name:'Negocio',exact:true}).click();await page.getByRole('button',{name:/Mensajes de WhatsApp/}).click();await page.locator('#wa-habilitado').waitFor();}
try{
 // Primer acceso desde enlace: el SDK intercambia OTP, configura TOTP y sube a aal2.
 const nuevo=await browser.newContext({viewport:{width:390,height:844}}),hash='a'.repeat(64),factor='ffffffff-1111-4111-8111-111111111111';let factorVerificado=false,verificaciones=0;
 const user=()=>({id:ids.admin,aud:'authenticated',role:'authenticated',email:'antonio.t.22@hotmail.com',factors:factorVerificado?[{id:factor,factor_type:'totp',status:'verified'}]:[]});
 const authSession=async aal=>({access_token:await token('admin',aal),refresh_token:'refresh-local',token_type:'bearer',expires_in:3600,user:user()});
 await nuevo.route(supabase+'/**',async route=>{const req=route.request(),u=new URL(req.url());let data,status=200;
 if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,GET,DELETE,OPTIONS'}});return;}
 if(u.pathname==='/auth/v1/verify'){assert.equal(req.postDataJSON().token_hash,hash);data=await authSession('aal1');}
 else if(u.pathname==='/auth/v1/user')data=user();
 else if(u.pathname==='/auth/v1/factors'&&req.method()==='POST'){assert.equal(req.postDataJSON().factor_type,'totp');data={id:factor,type:'totp',totp:{qr_code:'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"></svg>',secret:'SOLOPRUEBA',uri:'otpauth://totp/prueba'}};}
 else if(u.pathname.endsWith('/challenge'))data={id:'reto-local',type:'totp',expires_at:Math.floor(Date.now()/1000)+60};
 else if(u.pathname.endsWith('/verify')){assert.equal(req.postDataJSON().code,'123456');factorVerificado=true;verificaciones++;data=await authSession('aal2');}
 else{status=503;data={error:'Ruta Auth inesperada de prueba'};}
 await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'*'},body:JSON.stringify(data)});
 });
 const login=await nuevo.newPage();login.on('pageerror',x=>errores.push(x.message));await login.goto(base+'/#acceso-admin='+hash);await login.locator('#auth-entrar').waitFor();assert.equal(new URL(login.url()).hash,'');
 await login.locator('#auth-entrar').click();await login.locator('#auth-code').waitFor({state:'visible'});assert.equal(await login.evaluate(async()=>await window.AgendappxCuentas.sesion()),null);
 await login.locator('#auth-code').fill('123456');await login.locator('#auth-verificar').click();await login.waitForFunction(async()=>(await window.AgendappxCuentas.sesion())?.aal==='aal2');assert.equal(verificaciones,1);assert.equal(await login.locator('#auth-secret').textContent(),'');await nuevo.close();
 const context=await contexto(),page=await context.newPage();page.on('pageerror',x=>errores.push(x.message));await page.goto(base);await page.waitForFunction(()=>window.AgendappxCuentas?.sesion);await page.waitForFunction(async()=>!!(await window.AgendappxCuentas.sesion()));
 await page.evaluate(()=>localStorage.setItem('belleza.v1.sync',JSON.stringify({records:[],pending:[{id:'cejas',baseVersion:0,mutationId:'original_del_celular_12345',data:{id:'cejas',kind:'servicio',nombre:'Cejas anteriores',precio:999,duracion:60}}],conflicts:[]})));
 await page.getByRole('tab',{name:'Negocio',exact:true}).click();await page.getByRole('button',{name:/Sincronización/}).click();await page.locator('#sync-legado').waitFor();page.once('dialog',d=>d.accept());await page.locator('#sync-legado').click();await page.getByText('Conservar el servidor',{exact:true}).waitFor();assert.equal((await e.db.fuente(ids.salon,'cejas')).data.precio,500);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('belleza.v1.sync')).pending.length),1);await page.getByText('Conservar el servidor',{exact:true}).click();await page.getByRole('button',{name:'Listo',exact:true}).click();
 await abrir(page);await page.locator('#wa-direccion').fill('Dirección de prueba 123');await page.locator('#wa-anticipoActivo').check();await page.locator('#wa-banco').fill('Banco de prueba');
 const prefijo='01218000000000000',digito=(10-[...prefijo].reduce((a,d,i)=>a+(Number(d)*[3,7,1][i%3])%10,0)%10)%10;
 await page.locator('#wa-clabe').fill(prefijo+digito);await page.locator('#wa-titular').fill('Titular de prueba');await page.locator('#wa-guardar-ajustes').click();await page.waitForFunction(()=>!document.querySelector('#wa-generar').disabled);
 assert.equal((await e.control.estado(e.ident(),ids.salon)).ajustes.anticipoActivo,true);
 await page.locator('#wa-numero').fill('5511111111');await page.locator('#wa-generar').click();await page.locator('#wa-codigo-panel').waitFor({state:'visible'});assert.match(await page.locator('#wa-codigo').textContent(),/ABCD.*1234/);assert.equal(await page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('ABCD1234'))),false);vinculado=true;
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:imagenes+'configuracion-'+width+'.png',animations:'disabled'});}
 await page.getByRole('button',{name:'Listo',exact:true}).click();await page.getByRole('tab',{name:'Agenda',exact:true}).click();
 // El anticipo de una cita nueva usa la configuración guardada; la anterior conserva sus condiciones.
 const date=new Date().toISOString().slice(0,10);await e.cita({id:'cita-nueva',date,start:'16:00'});await e.cola.reconciliar(ids.salon);await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await page.locator('[data-cita="cita-nueva"]').first().waitFor({timeout:15000});await page.locator('[data-cita="cita-nueva"]').first().click();await page.locator('#wa-recibido').waitFor();
 await page.locator('#wa-recibido').click();await page.locator('#wa-pago-si').click();await page.getByText('Confirmada: anticipo recibido',{exact:false}).waitFor();assert.equal((await e.control.cita(e.ident(),ids.salon,'cita-nueva')).anticipo.estado,'recibido');
 await page.locator('#wa-recibo').setInputFiles(fileURLToPath(new URL('../../belleza/trabajos/lifting-cejas.jpg',import.meta.url)));await page.locator('#wa-recibo-guardar').waitFor({state:'visible'});await page.locator('#wa-recibo-guardar').click();await page.getByText('Guardado.',{exact:true}).waitFor();assert.ok((await e.control.cita(e.ident(),ids.salon,'cita-nueva')).anticipo.comprobante.startsWith('data:image/jpeg;'));
 await page.screenshot({path:imagenes+'anticipo.png',animations:'disabled'});
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();await page.getByRole('tab',{name:'Negocio',exact:true}).click();await elegirModo(page,/Dark/);await abrir(page);await page.screenshot({path:imagenes+'configuracion-dark.png',animations:'disabled'});
 await context.close();
 const staff=await contexto('especialista'),p=await staff.newPage();await p.goto(base);await p.waitForFunction(async()=>!!(await window.AgendappxCuentas?.sesion()));assert.equal(await p.evaluate(()=>Object.values(localStorage).some(v=>v.includes('5511111111'))),false);await staff.close();
 assert.deepEqual(errores,[]);console.log('WhatsApp: SDK real, acceso Admin MFA, RLS, configuración, código, pago único, foto y White/Dark 390/768/1440 verificados sin teléfono.');
}finally{await browser.close();await new Promise(r=>server.close(r));await e.cerrar();}
