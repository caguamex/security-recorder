// Motor workerd real, red saliente sustituida por completo: sin CAPTCHA real, cuentas ni códigos.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const requireNube=createRequire(new URL('../../nube/package.json',import.meta.url));
const {Miniflare,convertV4MiniflareOptions}=requireNube('miniflare');
const paquete=await build({stdin:{resolveDir:fileURLToPath(new URL('../',import.meta.url)),sourcefile:'validacion-workers.ts',contents:`
 import {RegistroWhatsApp} from './src/cuentas/registro.ts';
 import {Contrasenas} from './src/cuentas/contrasenas.ts';
 const pool={async connect(){return {release(){},async query(sql){return {rows:sql.includes('FILTER')?[{ip:0,total:0}]:[]};}};}};
 const config={habilitado:true,key:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',operacionKey:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',turnstileKey:'llave-ficticia',turnstileSiteKey:'sitio-ficticio',origen:'https://agendappx.test',supabaseURL:'https://proyecto-ficticio.invalid',llavePublica:'publica-ficticia',ip:()=> '127.0.0.1'};
 export default {async fetch(req){const modo=new URL(req.url).pathname;
  try{
   const registro=new RegistroWhatsApp(pool,config),contrasenas=new Contrasenas(pool,{},config);
   if(modo==='/auth'){const r=await contrasenas.auth('user',undefined,'token-ficticio','GET');return Response.json({status:r.status,ok:r.ok});}
   if(modo==='/captcha-acceso'){await contrasenas.captcha('rechazado','127.0.0.1');}
   else{await registro.crear({nombre:'Prueba',telefono:'5511111111',salon:'Prueba',slug:'salon-prueba',consentimiento:true,captchaToken:modo==='/registro-valido'?'aceptado':'rechazado'},'127.0.0.1');}
   return Response.json({status:200});
  }catch(e){return Response.json({status:e.status||500,error:e.message});}
 }};
 `},bundle:true,platform:'node',format:'esm',target:'esnext',external:['node:*'],write:false});
const llamadas=[];
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-10-26',compatibilityFlags:['nodejs_compat'],script:paquete.outputFiles[0].text,
 outboundService:async req=>{
  const u=new URL(req.url);llamadas.push(u.hostname+u.pathname);
  if(u.hostname==='challenges.cloudflare.com'&&u.pathname==='/turnstile/v0/siteverify'){
   const datos=await req.json();assert.equal(datos.secret,'llave-ficticia');
   return Response.json({success:datos.response==='aceptado',hostname:'agendappx.test',action:'registro'});
  }
  if(u.hostname==='proyecto-ficticio.invalid'&&u.pathname==='/functions/v1/agendappx-registro'){
   assert.match(req.headers.get('x-registro-firma'),/^[a-f0-9]{64}$/);return Response.json({preparada:true});
  }
  if(u.hostname==='proyecto-ficticio.invalid'&&u.pathname==='/auth/v1/user')return Response.json({error:'Token ficticio inválido'},{status:401});
  throw new Error('Egreso inesperado: '+u.hostname+u.pathname);
 }}));
try{
 for(const [ruta,esperado] of [['/registro-rechazado',400],['/captcha-acceso',428],['/auth',401],['/registro-valido',200]]){
  const d=await(await mf.dispatchFetch('http://localhost'+ruta)).json();assert.equal(d.status,esperado,ruta+': '+JSON.stringify(d));
 }
 assert.equal(llamadas.filter(x=>x.endsWith('/siteverify')).length,3);
 assert.equal(llamadas.filter(x=>x.endsWith('/functions/v1/agendappx-registro')).length,1);
 console.log('workerd: registro válido, rechazo de CAPTCHA, CAPTCHA de acceso y Auth verificados; toda la red simulada.');
}finally{await mf.dispose();}
