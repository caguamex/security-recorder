import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const leer=r=>readFile(new URL('../../'+r,import.meta.url),'utf8');
const pwa=r=>readFile(new URL('../../dist/pwa/'+r,import.meta.url),'utf8');

test('aviso de privacidad y términos: contenido mínimo de la ley y publicados en el paquete',async()=>{
 const aviso=await pwa('privacidad/index.html'),terminos=await pwa('terminos/index.html');
 for(const t of ['responsable','Finalidades necesarias','Finalidades adicionales','ARCO','revocar tu consentimiento','Cambios a este aviso','encargado'])assert.ok(aviso.includes(t),'falta en el aviso: '+t);
 for(const t of ['30 días de prueba gratis','solo se cobrará si lo aceptas','tus datos se conservan','Ley Federal de Protección al Consumidor','leyes de México'])assert.ok(terminos.includes(t),'falta en términos: '+t);
 assert.ok((await pwa('legal/legal.css')).length>100);
 // Sin recursos externos: la política de seguridad de la app solo permite 'self'.
 for(const h of [aviso,terminos])assert.equal(/(?:src|href)="https?:/.test(h),false);
});
test('las rutas legales no se confunden con el enlace de un salón',async()=>{
 const w=await leer('nube/worker.mjs');for(const r of ['/privacidad','/terminos','/legal'])assert.ok(w.includes(`'${r}'`),r);
});
test('registro, reservas y Mi negocio enlazan el aviso y los términos',async()=>{
 const registro=await leer('servidor/cliente/registro.js');assert.match(registro,/href="\/privacidad\/"[^]*href="\/terminos\/"/);
 const comunidad=await leer('comunidad/real.mjs');assert.match(comunidad,/Autorizo compartir[^<]*<a href="\/privacidad\/"/);assert.ok(comunidad.includes('href="/terminos/"'));
 assert.ok((await leer('belleza/negocio.js')).includes('href="/privacidad/"'));
});
