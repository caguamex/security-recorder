import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {randomBytes,randomUUID} from 'node:crypto';
import {entornoSocial,ids,sesiones} from './social-entorno.mjs';
import {RegistroWhatsApp} from '../build/cuentas/registro.js';
import {Contrasenas,rutasContrasenas,revisarContrasena,contrasenaTemporal,normalizarUsuario} from '../build/cuentas/contrasenas.js';
import {rutasAcceso} from '../build/cuentas/acceso.js';
import {enTransaccion} from '../build/cuentas/contexto.js';
import {intermediario} from '../../supabase/functions/agendappx-registro/intermediario.mjs';
const origen='https://agendappx.test',url='https://zkqwephmuflbuagevvxj.supabase.co';
const identidad=(u='nueva',aal='aal2')=>({usuarioId:ids[u],sesionId:sesiones[u],aal});

// Supabase Auth simulado: contraseñas en memoria, sesiones reales en auth.sessions.
async function entorno(t){
 const e=await entornoSocial();t.after(()=>e.cerrar());
 const sql=async(q,args)=>{const c=await e.pool.connect();try{return await c.query(q,args);}finally{c.release();}};
 await sql('ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email text');
 await sql(await readFile(new URL('../../supabase/migrations/20261030160000_usuarios_contrasena.sql',import.meta.url),'utf8'));
 const operacionKey=randomBytes(32).toString('base64'),claves=new Map(),llamadas=[];let captcha=true;
 const token=(u,s,aal='aal1')=>['tok',u,s,aal].join('.');
 const jwt={async verificar(t){const p=String(t).split('.');if(p[0]!=='tok')throw Object.assign(new Error(),{status:401});return {usuarioId:p[1],sesionId:p[2],aal:p[3]};}};
 const usuarioPor=async d=>(await sql(d.phone?'SELECT id FROM auth.users WHERE phone=$1':'SELECT id FROM auth.users WHERE email=$1',[d.phone?d.phone.replace(/^\+/,''):d.email])).rows[0];
 const admin=async(u,init)=>{const p=new URL(u).pathname.replace('/auth/v1/admin/','');const d=init.body?JSON.parse(init.body):{};llamadas.push(['admin',init.method,p]);
  if(p==='users'&&init.method==='POST'){if(d.phone)return Response.json({id:ids.nueva});const id=randomUUID();await sql('INSERT INTO auth.users(id,email) VALUES($1,$2)',[id,d.email]);claves.set(id,d.password);return Response.json({id});}
  const id=p.split('/')[1],u2=(await sql('SELECT id,phone,email FROM auth.users WHERE id=$1',[id])).rows[0];if(!u2)return Response.json({},{status:404});
  if(init.method==='GET')return Response.json(u2);claves.set(id,d.password);return Response.json(u2);};
 const edge=intermediario({key:operacionKey,url,adminKey:'admin-solo-prueba',fetch:admin});
 const red=async(u,init={})=>{
  if(u.endsWith('/siteverify')){llamadas.push(['captcha']);return Response.json({success:captcha,hostname:'agendappx.test',action:JSON.parse(init.body).response==='registro'?'registro':'acceso'});}
  if(u.endsWith('/agendappx-registro'))return edge(new Request(u,init));
  const ruta=u.replace(url+'/auth/v1/',''),d=init.body?JSON.parse(init.body):{},bearer=(init.headers?.Authorization||'').slice(7);llamadas.push([ruta]);
  if(ruta==='token?grant_type=password'){const f=await usuarioPor(d);if(!f||claves.get(f.id)!==d.password)return Response.json({error_code:'invalid_credentials'},{status:400});
   const s=randomUUID();await sql('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)',[s,f.id]);return Response.json({access_token:token(f.id,s),refresh_token:'r',user:{id:f.id}});}
  const yo=await jwt.verificar(bearer);
  if(ruta==='user'&&init.method==='PUT'){if(claves.get(yo.usuarioId)===d.password)return Response.json({error_code:'same_password'},{status:422});claves.set(yo.usuarioId,d.password);return Response.json({id:yo.usuarioId});}
  if(ruta==='logout?scope=others'){await sql('DELETE FROM auth.sessions WHERE user_id=$1 AND id<>$2',[yo.usuarioId,yo.sesionId]);return new Response(null,{status:204});}
  if(ruta==='logout'){await sql('DELETE FROM auth.sessions WHERE id=$1',[yo.sesionId]);return new Response(null,{status:204});}
  if(ruta==='user')return Response.json({id:yo.usuarioId,phone:'525511111111',phone_confirmed_at:new Date().toISOString()});
  throw new Error('Red inesperada '+u);};
 const config={habilitado:true,key:e.key,operacionKey,turnstileKey:'secreto',turnstileSiteKey:'sitio',origen,supabaseURL:url,llavePublica:'sb_publishable_prueba',ip:()=> 'ip-local',fetch:red,ahora:e.now};
 const c=new Contrasenas(e.poolAPI,jwt,config),registro=new RegistroWhatsApp(e.poolAPI,config);
 async function codigo(){e.avanzar(1);const a=await e.solicitudes.crear('whatsapp','525511111111','ip-'+randomUUID()),v=e.evento('525511111111','482913',{user:{id:ids.nueva,phone:'525511111111'}});await e.codigos.entregar(v.raw,v.headers);await e.solicitudes.intento(a.id,a.prueba,'482913');await sql('DELETE FROM ritmo.acceso_sesiones WHERE sesion_id=$1',[sesiones.nueva]);await e.solicitudes.admitir(identidad(),a.id);await e.solicitudes.resultado(a.id,true);}
 return {...e,sql,c,registro,config,jwt,token,claves,llamadas,codigo,setCaptcha(v){captcha=v;}};
}
async function llamar(ruta,datos,{origin=origen,token,metodo='POST'}={}){
 const req=Readable.from(datos===undefined?[]:[Buffer.from(JSON.stringify(datos))]);req.method=metodo;req.headers={'content-type':'application/json',origin,...(token?{authorization:'Bearer '+token}:{})};
 let estado=0,cuerpo='';const res={writeHead(s){estado=s;return this;},end(b){cuerpo=b;}};
 const handler=await ruta;const ok=await handler(req,res,new URL('https://agendappx.test'+datos?.__ruta));return {ok,estado,data:cuerpo?JSON.parse(cuerpo):null};
}

test('reglas: usuario, contraseña común y temporal fácil de dictar con suficiente azar',()=>{
 assert.equal(normalizarUsuario(' AB.Beauty_Room '),'ab.beauty_room');assert.throws(()=>normalizarUsuario('ab'),x=>x.status===400);assert.throws(()=>normalizarUsuario('ab beauty'),x=>x.status===400);
 assert.match(revisarContrasena('corta1'),/8/);assert.match(revisarContrasena('soloLetras'),/número/);assert.match(revisarContrasena('12345678'),/letra|común/);assert.match(revisarContrasena('Password1'.toLowerCase()),/común/);assert.match(revisarContrasena('abbeauty2026','abbeauty'),/usuario/);assert.equal(revisarContrasena('Rosa-Luna-2026'),null);
 const t=contrasenaTemporal();assert.match(t,/^[A-Z][a-z]+-[A-Z][a-z]+-\d{3}-[A-Z][a-z]+$/);assert.equal(revisarContrasena(t),null);assert.ok(new Set(Array.from({length:50},contrasenaTemporal)).size>45);
});

test('registro en orden: usuario apartado, código, contraseña y datos del salón al final',async t=>{
 const e=await entorno(t);
 const ticket=await e.registro.crear({usuario:'MarianaSalon',telefono:'5511111111',consentimiento:true,captchaToken:'registro'},'ip');
 assert.equal((await e.sql("SELECT count(*)::int AS n FROM ritmo.usuarios_apartados WHERE usuario='marianasalon'")).rows[0].n,1);
 await assert.rejects(()=>e.registro.crear({usuario:'marianasalon',telefono:'5522222222',consentimiento:true,captchaToken:'registro'},'ip-2'),x=>x.status===409);
 assert.equal(await e.c.disponible('marianasalon'),false);
 // Antes de confirmar el código, el usuario apartado no es de esta cuenta.
 await assert.rejects(()=>e.c.cambiar(e.token(ids.nueva,sesiones.nueva),{usuario:'marianasalon',contrasena:'Mariana-2026'}),x=>x.status===409);
 await e.codigo();await e.registro.verificar(identidad('nueva','aal1'),e.token(ids.nueva,sesiones.nueva),ticket);
 await assert.rejects(()=>e.c.cambiar(e.token(ids.nueva,sesiones.nueva),{usuario:'marianasalon',contrasena:'12345678'}),x=>x.status===400);
 const g=await e.c.cambiar(e.token(ids.nueva,sesiones.nueva),{usuario:'marianasalon',contrasena:'Mariana-2026'});assert.equal(g.usuario,'marianasalon');
 assert.equal((await e.sql("SELECT count(*)::int AS n FROM ritmo.usuarios_apartados")).rows[0].n,0);
 assert.equal(e.claves.get(ids.nueva),'Mariana-2026');assert.ok(e.llamadas.some(x=>x[0]==='logout?scope=others'));
 await assert.rejects(()=>e.registro.finalizar(identidad(),ticket),x=>x.status===400);
 const r=await e.registro.finalizar(identidad(),{...ticket,nombre:'Mariana',salon:"Salón Mariána"});
 assert.equal((await e.sql('SELECT slug FROM ritmo.negocios_enlaces WHERE negocio_id=$1',[r.negocioId])).rows[0].slug,'salon-mariana');
 assert.equal((await e.sql('SELECT nombre FROM ritmo.miembros WHERE negocio_id=$1',[r.negocioId])).rows[0].nombre,'Mariana');
 // Entrar con usuario o con WhatsApp; la sesión queda admitida.
 for(const cuenta of ['marianasalon','MarianaSalon','55 1111 1111']){const s=await e.c.entrar({cuenta,contrasena:'Mariana-2026'},'ip-'+cuenta);const i=await e.jwt.verificar(s.access_token);assert.equal(i.usuarioId,ids.nueva);assert.equal(s.cambiarContrasena,undefined);
  assert.equal((await e.sql('SELECT count(*)::int AS n FROM ritmo.acceso_sesiones WHERE sesion_id=$1',[i.sesionId])).rows[0].n,1);}
});

test('entrar: mismo mensaje si no existe, CAPTCHA desde el 3.º fallo y bloqueo de 15 minutos al 5.º',async t=>{
 const e=await entorno(t);e.claves.set(ids.nueva,'Mariana-2026');await e.sql("INSERT INTO ritmo.usuarios_acceso(usuario_id,usuario,con_contrasena) VALUES($1,'mariana',true)",[ids.nueva]);
 const sinCuenta=await e.c.entrar({cuenta:'nadie_aqui',contrasena:'x1234567'},'ip-a').catch(x=>x),mal=await e.c.entrar({cuenta:'mariana',contrasena:'x1234567'},'ip-a').catch(x=>x);
 assert.equal(sinCuenta.status,400);assert.equal(sinCuenta.message,mal.message);
 await e.c.entrar({cuenta:'mariana',contrasena:'x1234567'},'ip-b').catch(()=>{});await e.c.entrar({cuenta:'mariana',contrasena:'x1234567'},'ip-c').catch(()=>{});
 await assert.rejects(()=>e.c.entrar({cuenta:'mariana',contrasena:'Mariana-2026'},'ip-d'),x=>x.status===428);
 e.setCaptcha(false);await assert.rejects(()=>e.c.entrar({cuenta:'mariana',contrasena:'Mariana-2026',captchaToken:'t'},'ip-d'),x=>x.status===428);e.setCaptcha(true);
 await e.c.entrar({cuenta:'mariana',contrasena:'mala-123',captchaToken:'t'},'ip-e').catch(()=>{});await e.c.entrar({cuenta:'mariana',contrasena:'mala-123',captchaToken:'t'},'ip-e').catch(()=>{});
 await assert.rejects(()=>e.c.entrar({cuenta:'mariana',contrasena:'Mariana-2026',captchaToken:'t'},'ip-f'),x=>x.status===429);
 e.avanzar(15*60000+1);const ok=await e.c.entrar({cuenta:'mariana',contrasena:'Mariana-2026'},'ip-g');assert.ok(ok.access_token);
 // Un acierto limpia los fallos de la cuenta.
 assert.equal((await e.c.entrar({cuenta:'mariana',contrasena:'Mariana-2026'},'ip-h')).user.id,ids.nueva);
});

test('cambiar: una sesión con contraseña necesita código reciente; al cambiar se cierran las otras sesiones',async t=>{
 const e=await entorno(t);e.claves.set(ids.nueva,'Mariana-2026');await e.sql("INSERT INTO ritmo.usuarios_acceso(usuario_id,usuario,con_contrasena) VALUES($1,'mariana',true)",[ids.nueva]);
 const s=await e.c.entrar({cuenta:'mariana',contrasena:'Mariana-2026'},'ip');
 await assert.rejects(()=>e.c.cambiar(s.access_token,{contrasena:'Nueva-2027'}),x=>x.status===403);
 await e.codigo();e.avanzar(1000);const r=await e.c.cambiar(e.token(ids.nueva,sesiones.nueva),{contrasena:'Nueva-2027'});assert.equal(r.guardada,true);
 const i=await e.jwt.verificar(s.access_token);assert.equal((await e.sql('SELECT count(*)::int AS n FROM auth.sessions WHERE id=$1',[i.sesionId])).rows[0].n,0);
 await assert.rejects(()=>e.c.cambiar(e.token(ids.nueva,sesiones.nueva),{contrasena:'Nueva-2027'}),x=>x.status===400);
 e.avanzar(16*60000);await assert.rejects(()=>e.c.cambiar(e.token(ids.nueva,sesiones.nueva),{contrasena:'Otra-2028'}),x=>x.status===403);
});

test('restablecer por usuario: el código va al WhatsApp de la cuenta y la respuesta no revela si existe',async t=>{
 const e=await entorno(t);await e.sql("INSERT INTO ritmo.usuarios_acceso(usuario_id,usuario,con_contrasena) VALUES($1,'mariana',true)",[ids.nueva]);
 const otp=[];const rutas=rutasAcceso(e.poolAPI,e.jwt,{registro:true,habilitado:true,correo:false,key:e.key,origen,supabaseURL:url,llavePublica:'sb_publishable_prueba',salones:new Set(),ip:()=> 'ip-r',fetch:async(u,init)=>{otp.push(JSON.parse(init.body));return Response.json({});}});
 const existe=await llamar(rutas,{__ruta:'/api/acceso/solicitar',canal:'whatsapp',usuario:'Mariana'}),noExiste=await llamar(rutas,{__ruta:'/api/acceso/solicitar',canal:'whatsapp',usuario:'nadie_aqui'});
 assert.equal(existe.estado,200);assert.equal(noExiste.estado,200);assert.deepEqual(Object.keys(existe.data).sort(),Object.keys(noExiste.data).sort());assert.equal(JSON.stringify(existe.data).includes('5511'),false);
 assert.equal(otp.length,1);assert.equal(otp[0].phone,'+525511111111');assert.equal(otp[0].create_user,false);
});

test('equipo: Admin crea un acceso con temporal; la sesión temporal no ve datos hasta cambiarla',async t=>{
 const e=await entorno(t);
 await assert.rejects(()=>e.c.crearMiembro(identidad('admin','aal1'),ids.salon,{nombre:'Sofía',usuario:'sofia.ab',rol:'especialista'}),x=>x.status===403);
 await assert.rejects(()=>e.c.crearMiembro(identidad('recepcion','aal2'),ids.salon,{nombre:'Sofía',usuario:'sofia.ab',rol:'especialista'}),x=>x.status===403);
 await assert.rejects(()=>e.c.crearMiembro(identidad('admin'),ids.salon,{nombre:'Sofía',usuario:'sofia.ab',rol:'admin'}),x=>x.status===400);
 const r=await e.c.crearMiembro(identidad('admin'),ids.salon,{nombre:'Sofía',usuario:'Sofia.AB',rol:'especialista'});
 assert.equal(r.usuario,'sofia.ab');assert.match(r.contrasenaTemporal,/-\d{3}-/);assert.ok(Date.parse(r.venceEn)-e.now()<=72*3600000);
 const correo=(await e.sql('SELECT email,phone FROM auth.users WHERE id=$1',[r.id])).rows[0];assert.match(correo.email,/^miembro-[a-f0-9-]{36}@agendappx\.invalid$/);assert.equal(correo.phone,null);
 await assert.rejects(()=>e.c.crearMiembro(identidad('admin'),ids.salon,{nombre:'Otra',usuario:'sofia.ab',rol:'especialista'}),x=>x.status===409);
 const s=await e.c.entrar({cuenta:'sofia.ab',contrasena:r.contrasenaTemporal},'ip-s');assert.equal(s.cambiarContrasena,true);
 const i=await e.jwt.verificar(s.access_token);await assert.rejects(()=>enTransaccion(e.poolAPI,i,ids.salon,async()=>{}),x=>x.status===401);
 await e.c.cambiar(s.access_token,{contrasena:'Sofia-Propia-1'});await enTransaccion(e.poolAPI,i,ids.salon,async()=>{});
 assert.equal((await e.c.entrar({cuenta:'sofia.ab',contrasena:'Sofia-Propia-1'},'ip-s2')).cambiarContrasena,undefined);
 // Contraseña nueva por Admin: vuelve a temporal y corta sus sesiones al momento.
 const n=await e.c.nuevaTemporal(identidad('admin'),ids.salon,r.id);assert.notEqual(n.contrasenaTemporal,r.contrasenaTemporal);
 await assert.rejects(()=>enTransaccion(e.poolAPI,i,ids.salon,async()=>{}),x=>x.status===401);
 await assert.rejects(()=>e.c.entrar({cuenta:'sofia.ab',contrasena:'Sofia-Propia-1'},'ip-s3'),x=>x.status===400);
 e.avanzar(72*3600000+1);await assert.rejects(()=>e.c.entrar({cuenta:'sofia.ab',contrasena:n.contrasenaTemporal},'ip-s4'),x=>x.status===400&&/venció/.test(x.message));
 // Personas que entran con WhatsApp no reciben temporal desde aquí.
 await assert.rejects(()=>e.c.nuevaTemporal(identidad('admin'),ids.salon,ids.especialista),x=>x.status===404);
 const lista=await e.c.accesosEquipo(identidad('admin'),ids.salon);assert.deepEqual(lista.accesos.map(a=>a.usuario),['sofia.ab']);
});

test('equipo: el plan Salón permite 5 personas y la sexta se bloquea aunque se llame directo',async t=>{
 const e=await entorno(t);await e.sql("INSERT INTO ritmo.negocios_planes(negocio_id,plan,estado,prueba_inicio,prueba_fin) VALUES($1,'salon','prueba',now(),now()+interval '30 days') ON CONFLICT(negocio_id) DO UPDATE SET plan='salon',estado='prueba',prueba_inicio=EXCLUDED.prueba_inicio,prueba_fin=EXCLUDED.prueba_fin",[ids.salon]);
 await e.c.crearMiembro(identidad('admin'),ids.salon,{nombre:'Quinta',usuario:'quinta.ab',rol:'recepcion'});
 await assert.rejects(()=>e.c.crearMiembro(identidad('admin'),ids.salon,{nombre:'Sexta',usuario:'sexta.ab',rol:'recepcion'}),x=>x.status===402);
 const antes=(await e.sql('SELECT count(*)::int AS n FROM auth.users')).rows[0].n;
 await assert.rejects(()=>enTransaccion(e.poolAPI,identidad('admin'),ids.salon,async c=>{const u=randomUUID();await c.query('RESET ROLE');await c.query('INSERT INTO auth.users(id) VALUES($1)',[u]);await c.query('SET ROLE ritmo_api');await c.query('SELECT ritmo.alta_miembro_usuario($1,$2,$3,$4,$5,$6)',[ids.salon,u,'Sexta','recepcion','sexta.ab',new Date(e.now()+3600000)]);}),x=>/limite_plan/.test(x.message));
 assert.equal((await e.sql('SELECT count(*)::int AS n FROM auth.users')).rows[0].n,antes);
});

test('intermediario: no cambia la contraseña de cuentas con WhatsApp ni acepta propósitos ajenos',async t=>{
 const e=await entorno(t);
 await assert.rejects(()=>e.c.firmarIntermediario('contrasena-miembro-v1',{usuario:ids.nueva,password:'Rosa-Luna-482-Sol'}),x=>x.status===503);
 await e.sql("UPDATE auth.users SET email='antonio@example.test' WHERE id=$1",[ids.admin]);
 await assert.rejects(()=>e.c.firmarIntermediario('contrasena-miembro-v1',{usuario:ids.admin,password:'Rosa-Luna-482-Sol'}),x=>x.status===503);
 await assert.rejects(()=>e.c.firmarIntermediario('alta-miembro-v1',{email:'antonio@example.test',password:'Rosa-Luna-482-Sol'}),x=>x.status===503);
 await assert.rejects(()=>e.c.firmarIntermediario('borrar-v1',{usuario:ids.admin}),x=>x.status===503);
 assert.equal(e.claves.has(ids.admin),false);
});

test('rutas: origen ajeno rechazado y usuario disponible sin sesión',async t=>{
 const e=await entorno(t),rutas=rutasContrasenas(e.poolAPI,e.jwt,e.config);
 assert.equal((await llamar(rutas,{__ruta:'/api/acceso/contrasena',cuenta:'x',contrasena:'y'},{origin:'https://ajeno.test'}).catch(x=>x)).status,403);
 const r=await llamar(rutas,{__ruta:'/api/acceso/usuario-disponible',usuario:'nuevo.salon'});assert.equal(r.data.disponible,true);
 assert.equal(await (await rutas)({method:'GET',headers:{}},{},new URL('https://agendappx.test/api/otra')),false);
});
