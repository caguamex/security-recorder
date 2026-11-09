import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {preparar,ids,sesiones} from './whatsapp-solo-envios-entorno.mjs';
import {VerificadorJWT} from '../build/cuentas/jwt.js';
import {rutasCuentas} from '../build/cuentas/http.js';
import {proxyWhatsApp,usaMeta} from '../build/whatsapp-vinculado/proxy.js';
import {crearServidor} from '../build/http.js';
import {crearAplicacion,verificarRol} from '../../whatsapp/servicio.mjs';
async function entorno(t){const e=await preparar();t.after(()=>e.cerrar());await e.iniciar();await e.cita();
 const par=await generateKeyPair('ES256',{extractable:true}),key={...await exportJWK(par.publicKey),kid:'local',alg:'ES256'};
 const jwt=new VerificadorJWT('https://local.supabase.co',{fetch:async()=>Response.json({keys:[key]})});
 const token=async(u='admin',aal=u==='admin'?'aal2':'aal1')=>new SignJWT({session_id:sesiones[u],aal,role:'authenticated'}).setProtectedHeader({alg:'ES256',kid:'local'}).setSubject(ids[u]).setIssuer('https://local.supabase.co/auth/v1').setAudience('authenticated').setIssuedAt().setExpirationTime('1h').sign(par.privateKey);
 const config={politica:e.politica,salones:new Set([ids.salon]),origen:'https://agendappx.local'};
 const app=crearAplicacion({pool:e.poolMensajero,remitente:e.remoto,jwt,config,ahora:e.ahora,dormir:async()=>{},azar:()=>.5});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>app.cerrar());
 const base='http://127.0.0.1:'+app.server.address().port;
 const repo={salud:async()=>{},estado:async()=>[],snapshot:async()=>({records:[],cursor:0,full:true})};
 const cf=crearServidor(repo,'a'.repeat(40),'/no-estaticos',{publicURL:config.origen,metaHabilitado:false,
 cuentas:rutasCuentas(e.poolAPI,jwt,{habilitado:true,supabaseURL:'https://local.supabase.co',llavePublica:'sb_publishable_prueba_local',salones:config.salones,origen:config.origen}),
 vinculacion:proxyWhatsApp('https://mensajero.local',config.origen,jwt,(u,op)=>fetch(base+new URL(u).pathname,op))});cf.listen(0,'127.0.0.1');await once(cf,'listening');t.after(()=>new Promise(r=>cf.close(r)));
 const url='http://127.0.0.1:'+cf.address().port,path='/api/negocios/'+ids.salon+'/whatsapp';
 async function pedir(p=path,{u='admin',aal,method='GET',body,origin=config.origen,headers={}}={}){return fetch(url+p,{method,headers:{Authorization:'Bearer '+await token(u,aal),Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});}
 return {...e,app,cf,base,url,path,pedir,token,jwt};
}
test('navegador → Cloudflare → servicio → JWT real → sesión vigente y permisos de base',async t=>{
 const e=await entorno(t);assert.equal((await e.pedir()).status,200);
 for(const o of [{u:'especialista'},{u:'recepcion'},{u:'admin',aal:'aal1'},{origin:'https://otra.local'},{headers:{Authorization:'Bearer inventado'}}])assert.ok([401,403].includes((await e.pedir(e.path,o)).status));
 assert.equal((await e.pedir(e.path.replace(ids.salon,ids.otro))).status,403);assert.equal((await e.pedir(e.path+'?instancia=otra')).status,400);
 const r=await e.pedir(e.path+'/codigo',{method:'POST',body:{telefono:'5511111111'}});assert.equal(r.status,200);assert.match((await r.json()).codigo,/^[A-Z0-9]{8}$/);assert.equal(e.llamadas.filter(x=>x[0]==='codigo').length,1);
 const c=await e.pool.connect();try{await c.query('DELETE FROM auth.sessions WHERE id=$1',[sesiones.admin]);}finally{c.release();}assert.equal((await e.pedir()).status,401);
});
test('el proxy protege métodos, origen, tamaño y cabeceras sin aceptar APP_TOKEN',async t=>{
 const e=await entorno(t);assert.equal((await e.pedir(e.path,{method:'DELETE'})).status,405);assert.equal((await e.pedir(e.path+'/codigo',{method:'POST',body:{telefono:'5511111111',instancia:'fineci'}})).status,400);assert.equal((await e.pedir(e.path+'/codigo',{method:'POST',body:{telefono:'x'.repeat(70000)}})).status,413);
 const r=await e.pedir();assert.match(r.headers.get('cache-control'),/no-store/);assert.equal((await e.pedir(e.path,{headers:{Authorization:'Bearer '+'a'.repeat(40)}})).status,401);
});
test('caché por cuenta recibe únicamente el salón autorizado y Especialista con teléfonos ocultos',async t=>{
 const e=await entorno(t),p='/api/negocios/'+ids.salon+'/datos/estado';const r=await e.pedir(p,{u:'especialista'});assert.equal(r.status,200);const data=JSON.stringify(await r.json());assert.equal(data.includes('5511111111'),false);assert.equal(data.includes('••••'),true);
 const config=await fetch(e.url+'/api/cuentas/config');assert.equal((await config.json()).habilitado,true);assert.equal((await e.pedir('/api/estado')).status,401);
 const c=await e.pedir('/api/cuentas/contexto');assert.deepEqual((await c.json()).miembros,[{negocioId:ids.salon,rol:'admin'}]);
});
test('calendario por persona conserva enlace, no filtra teléfonos/notas y revoca al quitar acceso',async t=>{
 const e=await entorno(t),p='/api/negocios/'+ids.salon+'/datos/conexiones';const j=await (await e.pedir(p,{u:'especialista'})).json();assert.ok(j.calendarioUrl);
 assert.equal((await (await e.pedir(p,{u:'especialista'})).json()).calendarioUrl,j.calendarioUrl);
 const path=new URL(j.calendarioUrl).pathname,r=await fetch(e.url+path),text=await r.text();assert.equal(r.status,200);assert.match(text,/BEGIN:VEVENT/);assert.equal(text.includes('5511111111'),false);assert.equal(text.includes('CLABE'),false);
 await e.como('admin',ids.salon,c=>c.query('UPDATE ritmo.miembros SET activo=false WHERE negocio_id=$1 AND usuario_id=$2',[ids.salon,ids.especialista]));assert.equal((await fetch(e.url+path)).status,404);
});
test('Cloudflare con remitente vinculado no ejecuta envío ni webhook de Meta',async t=>{
 const e=await entorno(t);assert.equal(usaMeta('vinculado'),false);assert.equal(usaMeta('railway'),false);const r=await fetch(e.url+'/webhooks/whatsapp',{method:'POST',body:'{}',headers:{'Content-Type':'application/json'}});assert.equal(r.status,503);
 const {readFile}=await import('node:fs/promises');const worker=await readFile(new URL('../../nube/worker.mjs',import.meta.url),'utf8');assert.match(worker,/if \(usaMeta\(env.WHATSAPP_REMITENTE\)/);
});
test('el arranque rechaza un rol excesivo y valida el rol real del proceso',async t=>{
 const e=await entorno(t);await verificarRol(e.poolMensajero);await assert.rejects(()=>verificarRol(e.poolAPI),/Permisos excesivos/);
});

test('la configuración pública rechaza una llave secreta en lugar de exponerla',async t=>{
 const e=await entorno(t),r=rutasCuentas(e.poolAPI,e.jwt,{habilitado:true,supabaseURL:'https://local.supabase.co',llavePublica:'sb_secret_nunca_publicar',salones:new Set([ids.salon]),origen:'https://agendappx.local'});
 await assert.rejects(()=>r({method:'GET'},{writeHead(){throw new Error('No debe escribir una llave secreta');}},new URL('https://agendappx.local/api/cuentas/config')),err=>err.status===503);
});
