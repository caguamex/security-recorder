// Verificación del destino real: solo lectura de citas y sesión temporal propia revocada al terminar.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const args=process.argv.slice(2), ruta=args[args.indexOf('--secretos')+1];
let etapa='configuración', cookie='', base='', token='';
const request=(path,options={})=>fetch(new URL(path,base),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000),...options});
const resumen=data=>createHash('sha256').update(JSON.stringify([...data.records].sort((a,b)=>a.id.localeCompare(b.id)))).digest('hex');
try {
  assert.ok(args.includes('--secretos')&&ruta);
  const config=JSON.parse(await readFile(ruta,'utf8')); token=config.APP_TOKEN;
  base=config.PUBLIC_URL||'https://ritmo-belleza.antonio-t-22.workers.dev';
  assert.ok(token?.length>=32); assert.equal(new URL(base).protocol,'https:');
  const master={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  etapa='privacidad pública';
  assert.equal((await request('/api/estado')).status,401);
  assert.equal((await request('/api/dispositivos/enlaces',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
  const session=await request('/api/dispositivos/sesion'); assert.equal(session.status,200); assert.deepEqual(await session.json(),{conectado:false});
  const before=await request('/api/estado',{headers:master}); assert.equal(before.status,200); const original=await before.json();
  etapa='enlace temporal de verificación';
  const issued=await request('/api/dispositivos/enlaces',{method:'POST',headers:master,body:'{}'}); assert.equal(issued.status,201);
  const invitation=await issued.json(), url=new URL(invitation.activacionUrl);
  assert.equal(url.origin,new URL(base).origin); assert.equal(url.search,'');
  const enlace=url.hash.split('=')[1]; assert.match(enlace,/^[a-f0-9]{64}$/);
  etapa='activación y cookie segura';
  const response=await request('/api/dispositivos/activar',{method:'POST',headers:{'Content-Type':'application/json',Origin:new URL(base).origin},body:JSON.stringify({enlace})});
  assert.equal(response.status,200); const set=response.headers.get('set-cookie');
  assert.match(set,/^__Host-agendappx_sesion=[a-f0-9]{64};/); assert.match(set,/HttpOnly/); assert.match(set,/SameSite=Strict/); assert.match(set,/Secure/);
  cookie=set.split(';')[0]; assert.deepEqual(await response.json(),{conectado:true});
  const headers={Cookie:cookie};
  const state=await request('/api/estado',{headers}); assert.equal(state.status,200); assert.equal(resumen(await state.json()),resumen(original));
  const reuse=await request('/api/dispositivos/activar',{method:'POST',headers:{'Content-Type':'application/json',Origin:new URL(base).origin},body:JSON.stringify({enlace})}); assert.equal(reuse.status,410);
  etapa='suscripción y CSRF';
  const info=await request('/api/conexiones',{headers}); assert.equal(info.status,200); const connections=await info.json();
  const calendarUrl=new URL(connections.calendarioUrl); assert.equal(calendarUrl.origin,new URL(base).origin);
  const feed=await request(calendarUrl.pathname); assert.equal(feed.status,200); assert.match(feed.headers.get('content-type'),/text\/calendar/);
  const ics=await feed.text(); assert.match(ics,/BEGIN:VCALENDAR/); assert.match(ics,/X-WR-CALNAME:Agendappx/); assert.equal(ics.includes('DESCRIPTION:'),false);
  assert.equal((await request('/api/calendario/renovar',{method:'POST',headers:{...headers,Origin:'https://otro.example','Content-Type':'application/json'},body:'{}'})).status,403);
  etapa='revocación de la sesión de prueba';
  const out=await request('/api/dispositivos/sesion',{method:'DELETE',headers:{...headers,Origin:new URL(base).origin,'Content-Type':'application/json'},body:'{}'}); assert.equal(out.status,200);
  assert.equal((await request('/api/estado',{headers})).status,401); cookie='';
  const after=await request('/api/estado',{headers:master}); assert.equal(after.status,200); assert.equal(resumen(await after.json()),resumen(original));
  console.log('Producción verificada: acceso privado, activación de un solo uso, cookie segura, calendario .ics y revocación. Las citas y ajustes del salón no cambiaron.');
} catch { console.error('La verificación no terminó en la etapa: '+etapa+'. No se mostraron credenciales ni datos del salón.'); process.exitCode=1; }
finally {
  if(cookie) { try { await request('/api/dispositivos/sesion',{method:'DELETE',headers:{Cookie:cookie,Origin:new URL(base).origin,'Content-Type':'application/json'},body:'{}'}); } catch { console.error('Revisar la sesión temporal de verificación; no se revocaron otros dispositivos.'); } }
}
