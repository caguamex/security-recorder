// Comprobación anónima y de lectura: no pulsa enviar, guardar, registrar o vincular.
import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const base='https://ritmo-belleza.antonio-t-22.workers.dev';
const destino=new URL('../../imagenes/liquid-glass/publicado/',import.meta.url);await mkdir(destino,{recursive:true});
const assets=new URL('../../nube/build/comunidad-publicacion/assets/',import.meta.url);
const resultado={worker:'191c09ee-040a-4795-98a2-9d47032f7089',archivos:[],navegadores:[]};
for(const [nombre,motor]of [['Edge',chromium],['WebKit',webkit]]){
 const b=await motor.launch({headless:true,...(nombre==='Edge'?{channel:'msedge'}:{})});
 try{for(const modo of ['light','dark']){
  const ctx=await b.newContext({viewport:{width:390,height:844},locale:'es-MX',colorScheme:modo,serviceWorkers:'allow'});const errores=[],escrituras=[],validacionesCloudflare=[];
  ctx.on('request',r=>{const u=new URL(r.url());if(r.method()==='POST'&&(u.origin===base||u.hostname==='challenges.cloudflare.com')&&u.pathname.startsWith('/cdn-cgi/challenge-platform/')){validacionesCloudflare.push('validacion');return;}if(!['GET','HEAD','OPTIONS'].includes(r.method())&&!(r.method()==='POST'&&u.origin===base&&['/api/publico/social','/api/publico/explorar'].includes(u.pathname)))escrituras.push({ruta:u.pathname,metodo:r.method()});});
  await ctx.addInitScript(m=>{try{localStorage.setItem('agendappx.cliente.apariencia',m);}catch{}},modo);
  const p=await ctx.newPage();p.on('pageerror',e=>errores.push(e.message));
  for(const ruta of ['/comunidad/','/plataforma/','/planes/','/recuperar-acceso/','/#entrar','/#registro']){
   await p.goto('about:blank');const r=await p.goto(base+ruta,{waitUntil:'domcontentloaded'});assert.ok([200,304].includes(r.status()),ruta+' responde con documento o caché validada');
   if(ruta==='/comunidad/')await p.locator('#registro-salon').waitFor();
   if(ruta==='/plataforma/')await p.locator('#auth-destino').waitFor();
   if(ruta==='/#entrar')await p.locator('#auth-clave').waitFor();
   if(ruta==='/#registro'){await p.locator('#registro-formulario').waitFor();assert.equal(await p.locator('#registro-paso-cuenta>.group').evaluate(e=>getComputedStyle(e).borderTopWidth),'0px','El registro no conserva el marco anterior');}
   if(ruta.startsWith('/#'))await p.evaluate(m=>{document.documentElement.dataset.aparienciaNegocio=m;document.documentElement.dataset.modo=m==='dark'?'dark':'';},modo);
   const estado=await p.evaluate(()=>({fondo:getComputedStyle(document.documentElement).getPropertyValue('--lg-bg').trim(),desborda:document.documentElement.scrollWidth>innerWidth,tema:[...document.styleSheets].some(s=>s.href?.endsWith('/estilo-liquid-glass.css'))}));
   assert.equal(estado.tema,true,ruta);assert.equal(estado.fondo,modo==='dark'?'#08090b':'#f5f7f9',ruta);assert.equal(estado.desborda,false,ruta);
   assert.equal(await p.getByText('Error generating QR Code',{exact:true}).count(),0);
   await p.screenshot({path:fileURLToPath(new URL(nombre+'-'+modo+'-'+ruta.replace(/[\/#]/g,'')+'.png',destino)),animations:'disabled'});
  }
  if(nombre==='Edge'&&modo==='light'){
   const rutas={'/':'index.html','/comunidad/':'comunidad/index.html','/plataforma/':'plataforma/index.html','/planes/':'planes/index.html','/recuperar-acceso/':'recuperar-acceso/index.html'};
   for(const f of ['estilo-liquid-glass.css','colores-clientas.js','belleza.js','negocio.js','acceso-neutro.css','cuentas.js','sw.js','comunidad/real.mjs','comunidad/real.css','plataforma/plataforma.js','recuperar-acceso/recuperar.js'])rutas['/'+f]=f;
   for(const [ruta,f]of Object.entries(rutas)){
    const r=await ctx.request.get(base+ruta,{headers:{'Cache-Control':'no-cache'}});assert.equal(r.status(),200,ruta);const bytes=await r.body();assert.ok(bytes.equals(await readFile(new URL(f,assets))),'Archivo distinto: '+ruta);resultado.archivos.push({ruta,sha256:createHash('sha256').update(bytes).digest('hex')});
   }
   assert.equal((await ctx.request.get(base+'/salud')).status(),200);
   for(const ruta of ['/api/plataforma/yo','/api/plataforma/resumen'])assert.equal((await ctx.request.get(base+ruta)).status(),401);
   const config=await (await ctx.request.get(base+'/api/cuentas/config')).json();assert.equal(config.habilitado,true);assert.equal(config.acceso.whatsapp,true);
  }
  assert.deepEqual(errores,[]);assert.deepEqual(escrituras,[]);
  resultado.navegadores.push({motor:nombre,modo,pantallas:6,errores:0,escrituras:0,validacionesCloudflare:validacionesCloudflare.length});await ctx.close();console.log(nombre+' '+modo+': tema compartido en todas las páginas, acceso/registro y hojas; sin escrituras ni errores.');
 }}finally{await b.close();}
}
resultado.salud=200;resultado.panelAnonimo=401;
await writeFile(new URL('../../docs/LIQUID-GLASS-PUBLICACION.json',import.meta.url),JSON.stringify(resultado,null,2));
console.log(JSON.stringify({archivosIdenticos:resultado.archivos.length,recorridos:resultado.navegadores.length,salud:200,panelAnonimo:401,escrituras:0}));
